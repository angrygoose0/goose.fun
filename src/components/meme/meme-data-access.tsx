'use client'

import { getMemeProgram, getMemeProgramId } from '@project/anchor';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AccountInfo, SystemProgram, Cluster, Transaction, Keypair, PublicKey, SYSVAR_RENT_PUBKEY, ComputeBudgetProgram } from '@solana/web3.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useCluster } from '../cluster/cluster-data-access';
import { useAnchorProvider } from '../solana/solana-provider';
import { useTransactionToast } from '../ui/ui-layout';
import { useGetTokenAccounts } from '../account/account-data-access';
import { getAssociatedTokenAddress, InterestBearingMintInstruction, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { ASSOCIATED_PROGRAM_ID, associatedAddress } from '@coral-xyz/anchor/dist/cjs/utils/token';
import { Metaplex } from "@metaplex-foundation/js";
import { constants } from 'fs/promises';
import { BN } from '@coral-xyz/anchor';
import { sha256 } from "js-sha256";
import axios from 'axios';
import bs58 from 'bs58';
import { create } from 'domain';
import {ZERO, EMPTY_PUBLIC_KEY, BILLION, TOKEN_SUPPLY_BEFORE_BONDING, INITIAL_PRICE, INITIAL_SOL_AMOUNT, RAYDIUM_DEVNET_CPMM_PROGRAM_ID} from './meme-helper-functions';


export interface InitTokenParams {
  name: string; // Token name
  symbol: string; // Token symbol
  uri: string; // Metadata URI
  decimals: number;
}

const TREASURY_PRIVATE_KEY = "BunM9iycBamZzKVCpnsKEK3924UR6KY8vRWQ4dF3ysaq1McXWAJCDsuGXroVSG3k8ETyY3nGLirTyTxetXgdRyB"
const treasuryKeypair = Keypair.fromSecretKey(bs58.decode(TREASURY_PRIVATE_KEY));

const METADATA_SEED = "metadata";
const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");


export function getMetadataAddress(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(METADATA_SEED),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  )[0];
}

export function useCreateMemeToken() {
  const { cluster } = useCluster();
  const { connection } = useConnection();
  const programId = useMemo(() => getMemeProgramId(cluster.network as Cluster), [cluster]);
  const provider = useAnchorProvider();
  const program = getMemeProgram(provider);
  const transactionToast = useTransactionToast();
  const { publicKey, sendTransaction } = useWallet();

  const createMemeToken = useMutation<
    string,
    Error,
    { metadata: InitTokenParams }
  >({ //publicKey is user's key
    mutationKey: ["createMemeTokenEntry"],
    mutationFn: async ({ metadata }) => {
      try {

        if (publicKey === null) {
          throw new Error('Wallet not connected');
        }
        const tokenMetadata = {
          name: metadata.name,
          symbol: metadata.symbol,
          uri: metadata.uri,
          decimals: metadata.decimals,
        };

        const mintSeeds = [
          Buffer.from("mint"),
          Buffer.from(metadata.symbol),
          Buffer.from(metadata.name),

        ];

        const mint = PublicKey.findProgramAddressSync(
          mintSeeds,
          programId
        )[0];

        console.log(programId.toString(), 'programid');

        const metadataAddress = getMetadataAddress(mint);

        const initTokenInstruction = await program.methods
          .initMemeToken(tokenMetadata)
          .accounts({
            metadata: metadataAddress,
            mint: mint,
            treasury: treasuryKeypair.publicKey,
            signer: publicKey,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          })
          .instruction();

        const mintTokenInstruction = await program.methods
          .mintMemeToken(metadata.symbol, metadata.name)
          .accounts({
            treasury: treasuryKeypair.publicKey,
            mint: mint,
            signer: publicKey,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
          })
          .instruction();

        
        const blockhashContext = await connection.getLatestBlockhashAndContext();

        const transaction = new Transaction({
          feePayer: publicKey,
          blockhash: blockhashContext.value.blockhash,
          lastValidBlockHeight: blockhashContext.value.lastValidBlockHeight,
        })
          .add(initTokenInstruction)
          .add(mintTokenInstruction);

        
        const signature = await sendTransaction(transaction, connection, {
        });

        return signature;
        
      } catch (error) {
        console.error("Error during transaction processing:", error);
        throw error;
      }
    },

    onSuccess: (signature) => {
      transactionToast(signature);
      console.log(signature);
    },
    onError: (error) => {
      toast.error(`Error creating entry: ${error.message}`);
      console.error("Toast error:", error);
    },

  });

  return {
    createMemeToken,
  }
}

export function useProcessedAccountsQuery({
  currentPage,
  sortBy,
  searchBy,
}: {
  currentPage: number;
  sortBy: string;
  searchBy: string;
}) {
  const { connection } = useConnection();
  const { cluster } = useCluster();
  const { program } = useMemeProgram();
  const programId = useMemo(() => getMemeProgramId(cluster.network as Cluster), [cluster]);

  const processedAccountsQuery = useQuery({
    queryKey: ['getMemeTokenEntry', { currentPage, sortBy, searchBy }],
    queryFn: async () => {
      const pageSize = 10;
      const MemeAccountDiscriminator = Buffer.from(sha256.digest('account:MemeAccount')).slice(
        0,
        8
      );

      const filters = [
        {
          memcmp: { offset: 0, bytes: bs58.encode(MemeAccountDiscriminator) },
        },
        
        {
          memcmp: { offset: 40, bytes: bs58.encode(bs58.decode(searchBy)) },
        },
        
      ];

      let offset = 0; // Offset for creation_time (8 + 32 + 32 + 8)
      let length = 0; // i64 is 8 bytes
      if (sortBy === 'creation_time') {
        offset = 80;
        length = 8;
      }
      if (sortBy === 'bonded_time') {
        offset = 88;
        length = 8;
        filters.push({
          memcmp: { offset: 95, bytes: bs58.encode(Buffer.from([0x00])) }, // MSB = 0 for positive
        });
      }
      if (sortBy === 'locked_amount') {
        offset = 72;
        length = 8;
        filters.push({
          memcmp: { offset: 95, bytes: bs58.encode(Buffer.from([0x00])) }, // MSB = 0 for positive
        });
      }
      if (sortBy === 'invested_amount') {
        offset = 72;
        length = 8;
        filters.push({
          memcmp: { offset: 88, bytes: bs58.encode(Buffer.from([0xff])) }, // MSB = 1 for negative
        });
      }

      // Fetch accounts with `dataSlice` targeting `creation_time`
      const accounts = await connection.getProgramAccounts(programId, {
        dataSlice: { offset, length },
        filters,
      });

      console.log('accounts', accounts);

      // Parse `creation_time` and sort accounts
      const accountsWithSpecific = accounts.map(({ pubkey, account }) => {
        const specific = new BN(account.data, 'le'); // Parse `creation_time` as BigInt
        return { pubkey, specific };
      });

      // Sort accounts by `creation_time` in descending order (most recent first)
      const sortedAccounts = accountsWithSpecific.sort((a, b) => b.specific.cmp(a.specific));

      // Paginate results
      const paginatedAccounts = sortedAccounts.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
      );

      const accountPublicKeys = paginatedAccounts.map((account) => account.pubkey);

      console.log('accountPublicKeys', accountPublicKeys);

      return accountPublicKeys;
    },
    enabled: !!currentPage && !!sortBy,
  });

  return {
    processedAccountsQuery,
  };
}

export function useMemeProgram() {
  const { connection } = useConnection();
  const { cluster } = useCluster();
  const provider = useAnchorProvider();
  const programId = useMemo(() => getMemeProgramId(cluster.network as Cluster), [cluster]);
  const program = getMemeProgram(provider);


  const getProgramAccount = useQuery({
    queryKey: ["get-program-account", { cluster }],
    queryFn: () => connection.getParsedAccountInfo(programId),
  });

  return {
    program,
    programId,
    getProgramAccount,
    connection,
  };
}

export function useMetadataQuery({
  mint,
}: {
  mint: PublicKey;
}) {
  const { connection } = useConnection();
  const metaplex = Metaplex.make(connection);

  const metadataQuery = useQuery({
    queryKey: ['metadata', { mint }],
    queryFn: async () => {
      const metadataAddress = getMetadataAddress(mint);

      const accountInfo = await connection.getAccountInfo(metadataAddress);
      if (!accountInfo) {
        throw new Error('Metadata account not found');
      }

      const token = await metaplex.nfts().findByMint({ mintAddress: mint });

      const response = await fetch(token.uri);
      if (!response.ok) {
        throw new Error(`Failed to fetch metadata JSON from ${token.uri}`);
      }
      return response.json();
    },
    enabled: !!mint, // Run only if mint is provided
  });

  return {
    metadataQuery,
  };
}

export function useBuySellTokenMutation() {
  const { program } = useMemeProgram();
  const transactionToast = useTransactionToast();
  const { connection } = useConnection();
  const { sendTransaction, publicKey } = useWallet();
  const buySellToken = useMutation<
    string,
    Error,
    { amount: BN; mint: PublicKey }
  >({
    mutationKey: ['buySellToken'],
    mutationFn: async ({ mint, amount }) => {
      try {
        if (publicKey === null) {
          throw new Error('Wallet not connected');
        }
        const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
          units: 16000,
        });

        const recentPriorityFees = await connection.getRecentPrioritizationFees({
        });
        const minFee = Math.min(...recentPriorityFees.map(fee => fee.prioritizationFee));

        const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: minFee + 1,
        });

        const buySell = await program.methods
          .buySell(amount)
          .accounts({
            signer: publicKey,
            mint,
            treasury: treasuryKeypair.publicKey,
          })
          .signers([treasuryKeypair])
          .instruction();

        const blockhashContext = await connection.getLatestBlockhashAndContext();

        const transaction = new Transaction({
          feePayer: publicKey,
          blockhash: blockhashContext.value.blockhash,
          lastValidBlockHeight: blockhashContext.value.lastValidBlockHeight,
        })
          //.add(modifyComputeUnits)
          //.add(addPriorityFee)
          .add(buySell);
        transaction.sign(treasuryKeypair)

        const signature = await sendTransaction(transaction, connection, {
        });

        return signature;

      } catch (error) {
        console.error("Error during transaction processing:", error);
        throw error;
      }
    },

    onSuccess: (signature) => {
      transactionToast(signature);
      console.log(signature);
    },
    onError: (error) => {
      toast.error(`Error buy/selling token: ${error.message}`);
      console.error('Toast error:', error);
    },
  });

  return {
    buySellToken,
  };
}

export function useLockClaimTokenMutation() {
  const { program } = useMemeProgram();
  const transactionToast = useTransactionToast();
  const { connection } = useConnection();
  const { sendTransaction, publicKey } = useWallet();
  const lockClaimToken = useMutation<
    string,
    Error,
    { amount: BN; mint: PublicKey }
  >({
    mutationKey: ['lockClaimToken'],
    mutationFn: async ({ mint, amount }) => {
      try {
        if (publicKey === null) {
          throw new Error('Wallet not connected');
        }
        const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
          units: 16000,
        });

        const recentPriorityFees = await connection.getRecentPrioritizationFees({
        });
        const minFee = Math.min(...recentPriorityFees.map(fee => fee.prioritizationFee));

        const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: minFee + 1,
        });

        const lockClaim = await program.methods
          .lockClaim(amount)
          .accounts({
            signer: publicKey,
            mint,
            treasury: treasuryKeypair.publicKey,
          })
          .signers([treasuryKeypair])
          .instruction();

        const blockhashContext = await connection.getLatestBlockhashAndContext();

        const transaction = new Transaction({
          feePayer: publicKey,
          blockhash: blockhashContext.value.blockhash,
          lastValidBlockHeight: blockhashContext.value.lastValidBlockHeight,
        })
          //.add(modifyComputeUnits)
          //.add(addPriorityFee)
          .add(lockClaim);
        transaction.sign(treasuryKeypair)

        const signature = await sendTransaction(transaction, connection, {
        });

        return signature;

      } catch (error) {
        console.error("Error during transaction processing:", error);
        throw error;
      }
    },

    onSuccess: (signature) => {
      transactionToast(signature);
      console.log(signature);
    },
    onError: (error) => {
      toast.error(`Error lock/claiming token: ${error.message}`);
      console.error('Toast error:', error);
    },
  });

  return {
    lockClaimToken,
  };
}

export function useBondToRaydium() {
  const { program } = useMemeProgram();
  const transactionToast = useTransactionToast();

  const bondToRaydium = useMutation<
    string,
    Error,
    { mint: PublicKey, poolId: PublicKey }
  >({
    mutationKey: ['bondToRaydium'],
    mutationFn: async ({ mint, poolId }) => {
      try {

        const signature = await program.methods
          .bondToRaydium(poolId)
          .accounts({
            mint,
            treasury: treasuryKeypair.publicKey,
          })
          .signers([treasuryKeypair])
          .rpc();
        return signature;

        //return signature;
      } catch (error) {
        console.error('Error in bondToRaydium', error);
        throw error;
      }
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      console.log('Bonded to Raydium', signature);
    },
    onError: (error) => {
      toast.error(`Error bonding to Raydium or creating pool: ${error.message}`);
      console.error('Error bonding to Raydium or creating pool:', error);
    },
  });

  return {
    bondToRaydium,
  };
}

export function useUserAccountsByMintQuery({
  mint,
}: {
  mint: PublicKey;
}) {
  const { cluster } = useCluster();
  const { program } = useMemeProgram();
  const { connection } = useConnection();
  const programId = useMemo(() => getMemeProgramId(cluster.network as Cluster), [cluster]);

  const userAccountsByMintQuery = useQuery({
    queryKey: ['getUserAccountsByMint', { mint }],
    queryFn: async () => {
      const userAccountDiscriminator = Buffer.from(sha256.digest("account:UserAccount")).slice(
        0,
        8
      );

      const mintOffset = 40;
      const mintLength = 32;

      // Fetch accounts with `dataSlice` targeting `creation_time`
      const accounts = await connection.getProgramAccounts(programId, {
        dataSlice: { offset: mintOffset, length: mintLength },
        filters: [

          {
            memcmp: { offset: 0, bytes: bs58.encode(userAccountDiscriminator) },
          },

        ],
      });

      const targetMintBytes = Buffer.from(mint.toBytes());
      const filteredAccounts = accounts.filter((account) =>
        account.account.data.equals(targetMintBytes)
      );

      const accountPublicKeys = filteredAccounts.map((account) => account.pubkey);
      const accountsWithData = await program.account.userAccount.fetchMultiple(accountPublicKeys);

      const userAccountsByMintQuery = useQuery({
        queryKey: ['getUserAccountsByMint', { mint }],
        queryFn: async () => {
          const userAccountDiscriminator = Buffer.from(sha256.digest("account:UserAccount")).slice(
            0,
            8
          );

          const mintOffset = 40;
          const mintLength = 32;

          // Fetch accounts with `dataSlice` targeting `creation_time`
          const accounts = await connection.getProgramAccounts(programId, {
            dataSlice: { offset: mintOffset, length: mintLength },
            filters: [

              {
                memcmp: { offset: 0, bytes: bs58.encode(userAccountDiscriminator) },
              },

            ],
          });

          const targetMintBytes = Buffer.from(mint.toBytes());
          const filteredAccounts = accounts.filter((account) =>
            account.account.data.equals(targetMintBytes)
          );

          const accountPublicKeys = filteredAccounts.map((account) => account.pubkey);
          const accountsWithData = await program.account.userAccount.fetchMultiple(accountPublicKeys);

          return accountsWithData;
        },
        enabled: !!mint,
      });

      const accountsWithOrderedData = accountsWithData.map((account, index) => {
        if (account != null) {
          const { getSpecificTokenBalance } = useGetTokenAccounts({ address: account.user, mint });
          const tokenBalance = new BN(
            getSpecificTokenBalance.data?.balance ?? 0 // Default to 0 if balance is undefined or query fails
          );
          const total: BN = account.lockedAmount.add(account.claimmable).add(tokenBalance);

          return {
            user: account.user,
            lockedAmount: account.lockedAmount,
            claimmable: account.claimmable,
            tokenBalance,
            total,
          };
        }
      });

      return accountsWithOrderedData
    },
    enabled: !!mint,
  });

  return {
    userAccountsByMintQuery,
  }
}

export function useUserAccountQuery({
  publicKey,
  mint,
}: {
  publicKey: PublicKey;
  mint: PublicKey;
}) {
  const { cluster } = useCluster();
  const programId = useMemo(() => getMemeProgramId(cluster.network as Cluster), [cluster]);
  const { program } = useMemeProgram();
  const { connection } = useConnection();
  const queryClient = useQueryClient();


  const userAccountSeeds = [
    Buffer.from("user_account"),
    mint.toBuffer(),
    publicKey.toBuffer()
  ];
  const userAccountKey = PublicKey.findProgramAddressSync(
    userAccountSeeds,
    programId
  )[0];

  // Fetch the user account
  const userAccountQuery = useQuery({
    queryKey: ['userAccount', { cluster, userAccountKey }],
    queryFn: async () => {
      return program.account.userAccount.fetch(userAccountKey);
    }
  });

  useEffect(() => {
    const subscriptionId = connection.onAccountChange(
      userAccountKey,
      async (updatedAccountInfo) => {
        try {
          const updatedData = await program.account.userAccount.fetch(userAccountKey);
          // Update the query with the new data
          queryClient.setQueryData(['userAccount', { cluster, userAccountKey }], updatedData);
        } catch (error) {
          console.error('Failed to fetch updated user account data:', error);
        }
      }
    );

    // Cleanup the subscription when the component unmounts or dependencies change
    return () => {
      connection.removeAccountChangeListener(subscriptionId);
    };
  }, [connection, userAccountKey, program, cluster, queryClient]);

  return {
    userAccountQuery,
  };
}

export function useMemeAccountQuery({
  accountKey
}: {
  accountKey: PublicKey;
}) {
  const { cluster } = useCluster();
  const { program } = useMemeProgram();
  const { connection } = useConnection();
  const queryClient = useQueryClient();


  // Fetch the meme account
  const memeAccountQuery = useQuery({
    queryKey: ['memeAccount', { cluster, accountKey }],
    queryFn: async () => {
      return program.account.memeAccount.fetch(accountKey);
    },
  });

  useEffect(() => {
    const subscriptionId = connection.onAccountChange(
      accountKey,
      async (updatedAccountInfo) => {
        try {
          const updatedData = await program.account.memeAccount.fetch(accountKey);
          // Update the query with the new data
          queryClient.setQueryData(['memeAccount', { cluster, accountKey }], updatedData);
        } catch (error) {
          console.error('Failed to fetch updated meme account data:', error);
        }
      }
    );

    // Cleanup the subscription when the component unmounts or dependencies change
    return () => {
      connection.removeAccountChangeListener(subscriptionId);
    };
  }, [connection, accountKey, program, cluster, queryClient]);

  return {
    memeAccountQuery,
  };
}

export function useSolPriceQuery() {
  // Fetch the Solana price in USD
  const solPriceQuery = useQuery({
    queryKey: ['solPrice'],
    queryFn: async () => {
      try {
        const response = await axios.get(
          'https://api.coingecko.com/api/v3/simple/price',
          {
            params: { ids: 'solana', vs_currencies: 'usd' },
          }
        );
        const priceInUsd = response.data.solana.usd;
        return priceInUsd;
      } catch (error) {
        console.error('Error fetching Solana price:', error);
        throw new Error('Failed to fetch Solana price.');
      }
    },
  });

  return {
    solPriceQuery,
  };
}

export function useTransactionsQuery({
  mint,
}: {
  mint: PublicKey;
}) {
  const { connection } = useConnection();
  const { cluster } = useCluster();

  
  const transactionsQuery = useQuery({
    queryKey: ['getTransactions', { mint }],
    queryFn: async () => {

      const signatures = await connection.getSignaturesForAddress(RAYDIUM_DEVNET_CPMM_PROGRAM_ID, {
        limit: 50, // Limit the number of transactions to fetch
      });

      const filteredTransactions: any[] = [];
      for (const signatureInfo of signatures) {
        const tx = await connection.getTransaction(signatureInfo.signature, {
          maxSupportedTransactionVersion: 0,

        });

        if (tx && tx.meta && tx.meta.postTokenBalances && tx.meta.preTokenBalances) {
          const involvesMint = tx.meta.postTokenBalances.some(
            (balance) => balance.mint === mint.toBase58()
          );
          if (involvesMint) {
            const userPublicKey = tx.transaction.message.accountKeys[0];
            const signature = signatureInfo.signature;

            const solChange = tx.meta.postBalances[0] - tx.meta.preBalances[0];
            const postToken = tx.meta.postTokenBalances.find(
              (balance) => balance.mint === mint.toBase58()
            );
            
            const preToken = tx.meta.preTokenBalances.find(
              (balance) => balance.mint === mint.toBase58()
            );
            
            const tokenChange = postToken
              ? 
                (postToken.uiTokenAmount.uiAmount || 0) -
                (preToken?.uiTokenAmount.uiAmount || 0)
                
              : 0;

            const type = solChange < 0 ? 'buy' : 'sell';


            filteredTransactions.push({
              userPublicKey,
              signature,
              time: signatureInfo.blockTime,
              type,
              solChange,
              tokenChange,
            });
          }
        }
      }
      console.log('filteredTransactions', filteredTransactions);
      
     return filteredTransactions
    },
    refetchInterval: 10000, enabled: false, //enabled: !!mint,
  });

  return {
    transactionsQuery,
  };
}




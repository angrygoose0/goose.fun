
'use client'

import { getMemeProgram, getMemeProgramId } from '@project/anchor';
import * as crypto from 'crypto';
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
import {MINT_SEED, RAYDIUM_DEVNET_CPMM_PROGRAM_ID, TOKEN_METADATA_PROGRAM_ID, TOKENS_PER_PAGE, TREASURY_PUBLIC_KEY, ZERO} from './meme-helper-functions';
import { sleep } from '@raydium-io/raydium-sdk-v2';


export interface InitTokenParams {
  name: string; // Token name
  symbol: string; // Token symbol
  uri: string; // Metadata URI
  decimals: number;
}

export function getMetadataAddress(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
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
          Buffer.from(MINT_SEED),
        ];
          
          const mint = PublicKey.findProgramAddressSync(mintSeeds, programId)[0];

        // Generate random seed (you can use any random data here)


        const metadataAddress = getMetadataAddress(mint);

        const initTokenInstruction = await program.methods
          .initMemeToken(tokenMetadata, MINT_SEED)
          .accounts({
            metadata: metadataAddress,
            treasury: TREASURY_PUBLIC_KEY,
            signer: publicKey,
            mint: mint,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          } as any)
          .instruction();

        const mintTokenInstruction = await program.methods
          .mintMemeToken(MINT_SEED)
          .accounts({
            treasury: TREASURY_PUBLIC_KEY,
            signer: publicKey,
            mint: mint,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
          } as any)
          .instruction();
        
        
        const blockhashContext = await connection.getLatestBlockhashAndContext();

        const transaction = new Transaction({
          feePayer: publicKey,
          blockhash: blockhashContext.value.blockhash,
          lastValidBlockHeight: blockhashContext.value.lastValidBlockHeight,
        })
          .add(initTokenInstruction)
          .add(mintTokenInstruction);

          const simulationResult = await connection.simulateTransaction(transaction);
          console.log('Simulation Result:', simulationResult);
  
          if (simulationResult.value.err) {
              console.error('Simulation Error:', simulationResult.value.err);
              throw new Error('Transaction simulation failed');
          }
        

      
                
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
    },
    onError: (error) => {
      toast.error(`Error creating entry: ${error.message}`);
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


      // Parse `creation_time` and sort accounts
      const accountsWithSpecific = accounts.map(({ pubkey, account }) => {
        const specific = new BN(account.data, 'le'); // Parse `creation_time` as BigInt
        return { pubkey, specific };
      });

      // Sort accounts by `creation_time` in descending order (most recent first)
      const sortedAccounts = accountsWithSpecific.sort((a, b) => b.specific.cmp(a.specific));

      // Paginate results
      const paginatedAccounts = sortedAccounts.slice(
        (currentPage - 1) * TOKENS_PER_PAGE,
        currentPage * TOKENS_PER_PAGE,
      );

      const accountPublicKeys = paginatedAccounts.map((account) => account.pubkey);


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



export function useBuyTokenMutation() {
  const { program } = useMemeProgram();
  const transactionToast = useTransactionToast();
  const { connection } = useConnection();
  const { sendTransaction, publicKey } = useWallet();
  const buyToken = useMutation<
    string,
    Error,
    { amount: BN; mint: PublicKey }
  >({
    mutationKey: ['buyToken'],
    mutationFn: async ({ mint, amount }) => {
      try {
        if (publicKey === null) {
          throw new Error('Wallet not connected');
        }

        if (amount.lte(ZERO)) {
          throw new Error('Invalid Amount');
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

        const buy = await program.methods
          .buy(amount)
          .accounts({
            signer: publicKey,
            mint,
            treasury: TREASURY_PUBLIC_KEY,
          })
          .instruction();

        const blockhashContext = await connection.getLatestBlockhashAndContext();

        const transaction = new Transaction({
          feePayer: publicKey,
          blockhash: blockhashContext.value.blockhash,
          lastValidBlockHeight: blockhashContext.value.lastValidBlockHeight,
        })
          //.add(modifyComputeUnits)
          //.add(addPriorityFee)
          .add(buy);
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
    },
    onError: (error) => {
      toast.error(`Error buy/selling token: ${error.message}`);
      console.error('Toast error:', error);
    },
  });

  return {
    buyToken,
  };
}

export function useLockTokenMutation() {
  const { program } = useMemeProgram();
  const transactionToast = useTransactionToast();
  const { connection } = useConnection();
  const { sendTransaction, publicKey } = useWallet();
  const lockToken = useMutation<
    string,
    Error,
    { amount: BN; mint: PublicKey }
  >({
    mutationKey: ['lockToken'],
    mutationFn: async ({ mint, amount }) => {
      try {
        if (publicKey === null) {
          throw new Error('Wallet not connected');
        }
        if (amount.lte(ZERO)) {
          throw new Error ('Invalid Amount')
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

        const lock = await program.methods
          .lock(amount)
          .accounts({
            signer: publicKey,
            mint,
            treasury: TREASURY_PUBLIC_KEY,
          })
          .instruction();

        const blockhashContext = await connection.getLatestBlockhashAndContext();

        const transaction = new Transaction({
          feePayer: publicKey,
          blockhash: blockhashContext.value.blockhash,
          lastValidBlockHeight: blockhashContext.value.lastValidBlockHeight,
        })
          //.add(modifyComputeUnits)
          //.add(addPriorityFee)
          .add(lock);

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
    },
    onError: (error) => {
      toast.error(`Error locking tokens: ${error.message}`);
      console.error('Toast error:', error);
    },
  });

  return {
    lockToken,
  };
}



/*
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
*/

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
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Automatically refetch data every 10 minutes
    refetchInterval: 10 * 60 * 1000, // 10 minutes
    // Fetch on mount to ensure data is available when the component loads
    refetchOnMount: true,
    // Optionally fetch in the background when the user revisits the page/tab
    refetchOnWindowFocus: false,
  });

  return {
    metadataQuery,
  };
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


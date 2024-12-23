'use client'

import { getMemeProgram, getMemeProgramId } from '@project/anchor';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AccountInfo, SystemProgram, Cluster, Transaction, Keypair, PublicKey, SYSVAR_RENT_PUBKEY, ComputeBudgetProgram } from '@solana/web3.js';
import { useMutation, useQuery } from '@tanstack/react-query';
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
import bs58 from 'bs58';
import { create } from 'domain';
import { fetchRpcPoolInfo } from '../raydium/fetchRpcPoolInfo';


export interface InitTokenParams {
  name: string; // Token name
  symbol: string; // Token symbol
  uri: string; // Metadata URI
  decimals: number;
}

const TREASURY_PRIVATE_KEY = "5rhVcMHjqcjHLhdwajDnHW6PeWFheR29wMg1vrCAs6GSgihy3giwwFxW1CCSSskKbNvUKUJ7otF144oH4f8RAuSs"
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
            mint: mint,
            treasury: treasuryKeypair.publicKey,
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
}: {
  currentPage: number,
  sortBy: string,
}
) {
  const { connection } = useConnection();
  const { cluster } = useCluster();
  const { program } = useMemeProgram();
  const programId = useMemo(() => getMemeProgramId(cluster.network as Cluster), [cluster]);

  const processedAccountsQuery = useQuery({
    queryKey: ['getMemeTokenEntry', { currentPage }, { sortBy }],
    queryFn: async () => {

      const pageSize = 5;
      const memeEntryDiscriminator = Buffer.from(sha256.digest("account:MemeEntryState")).slice(
        0,
        8
      );

      const creationTimeOffset = 80; // Offset for creation_time (8 + 32 + 32 + 8)
      const creationTimeLength = 8; // i64 is 8 bytes

      // Fetch accounts with `dataSlice` targeting `creation_time`
      const accounts = await connection.getProgramAccounts(programId, {
        dataSlice: { offset: creationTimeOffset, length: creationTimeLength },
        filters: [

          {
            memcmp: { offset: 0, bytes: bs58.encode(memeEntryDiscriminator) },
          },

        ],
      });

      const accounts1 = program.account.memeEntryState.all()

      console.log(accounts);
      console.log(accounts1);

      // Parse `creation_time` and sort accounts
      const accountsWithCreationTime = accounts.map(({ pubkey, account }) => {
        const creationTime = new BN(account.data, "le"); // Parse `creation_time` as BigInt
        return { pubkey, creationTime };
      });

      // Sort accounts by `creation_time` in descending order (most recent first)
      const sortedAccounts = accountsWithCreationTime.sort((a, b) =>
        b.creationTime.cmp(a.creationTime)
      );

      // Paginate results
      const paginatedAccounts = sortedAccounts.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
      );

      const accountPublicKeys = paginatedAccounts.map((account) => account.pubkey);
      const accountsWithData = await program.account.memeEntryState.fetchMultiple(accountPublicKeys);

      return accountsWithData;
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

export function useBondToRaydium() {
  const { program } = useMemeProgram();
  const transactionToast = useTransactionToast();

  const bondToRaydium = useMutation<
    string,
    Error,
    { mint: PublicKey }
  >({
    mutationKey: ['bondToRaydium'],
    mutationFn: async ({ mint }) => {
      try {
        // Call the bondToRaydium method first

        const signature = await program.methods
          .bondToRaydium()
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


export function useAccountQuery({
  publicKey,
  mint,
}: {
  publicKey: PublicKey;
  mint: PublicKey;
}) {
  const { cluster } = useCluster();
  const { program } = useMemeProgram();
  const { connection } = useConnection();
  const programId = useMemo(() => getMemeProgramId(cluster.network as Cluster), [cluster]);

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


  const memeAccountSeeds = [
    Buffer.from("user_account"),
    mint.toBuffer(),
    publicKey.toBuffer()
  ];
  const memeAccountKey = PublicKey.findProgramAddressSync(
    memeAccountSeeds,
    programId
  )[0];
  const memeEntryQuery = useQuery({
    queryKey: ['memeEntry', { cluster, memeAccountKey }],
    queryFn: async () => {
      return program.account.memeEntryState.fetch(memeAccountKey);
    }
  });




  return {
    userAccountQuery,
    memeEntryQuery,
  };
}



/*
const updateMemeToken = useMutation<string, Error, CreateMemeTokenArgs>({
  mutationKey: [`memeEntry`, `update`, (cluster)],
  mutationFn: async ({ mint, twitter_link, telegram_link, website_link }) => {
    return program.methods.updateMemeEntry(mint, twitter_link, telegram_link, website_link).rpc();
  },
  onSuccess: (signature) => {
    transactionToast(signature);
    accounts.refetch();
  },
  onError: (error) => {
    toast.error(`Error updating entry: ${error.message}`);
  },
});
*/



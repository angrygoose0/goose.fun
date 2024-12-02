'use client'

import { getMemeProgram, getMemeProgramId } from '@project/anchor';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AccountInfo, SystemProgram, Cluster, Transaction, Keypair, PublicKey, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useCluster } from '../cluster/cluster-data-access';
import { useAnchorProvider } from '../solana/solana-provider';
import { useTransactionToast } from '../ui/ui-layout';
import { getAssociatedTokenAddress, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { ASSOCIATED_PROGRAM_ID, associatedAddress } from '@coral-xyz/anchor/dist/cjs/utils/token';
import { Metaplex } from "@metaplex-foundation/js";
import { constants } from 'fs/promises';


export interface InitTokenParams {
  name: string; // Token name
  symbol: string; // Token symbol
  uri: string; // Metadata URI
  decimals: number;
}

type ProgramAccount = {
  pubkey: PublicKey;
  account: AccountInfo<Buffer>;
};

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

export function useMemeProgram() {
  const { connection } = useConnection();
  const { cluster } = useCluster();
  const transactionToast = useTransactionToast();
  const provider = useAnchorProvider();
  const programId = useMemo(() => getMemeProgramId(cluster.network as Cluster), [cluster]);
  const program = getMemeProgram(provider);

  enum SortBy {
    CreationTime = "creationTime",
    LockedAmount = "lockedAmount",
  }
  const [sortBy, setSortBy] = useState<SortBy>(SortBy.CreationTime); // Default sorting by creationTime
  const [paginatedKeys, setPaginatedKeys] = useState<PublicKey[]>([]);

  const [currentPage, setCurrentPage] = useState(1); // Track current page
  const pageSize = 5; // Number of accounts per page

  // Fetch and process accounts
  useEffect(() => {
    const fetchAndProcessAccounts = async () => {
      try {
        const { offset, length } = (() => {
          if (sortBy === SortBy.CreationTime) {
            return { offset: 72, length: 8 }; // creation_time
          } else if (sortBy === SortBy.LockedAmount) {
            return { offset: 64, length: 8 }; // locked_amount
          }
          return { offset: 0, length: 0 }; // Default (handle edge case)
        })();

        // Calculate paginated slice based on currentPage and pageSize
        const paginatedOffset = (currentPage - 1) * pageSize;
        const accounts = await connection.getProgramAccounts(programId, {
          dataSlice: { offset: paginatedOffset + offset, length }, // Dynamic offset
        });

        const accountsArray: Array<ProgramAccount> = Array.from(accounts);

        /*
        accountsArray.sort((a, b) => {
          try {
            const valueA = a.account.data.readBigUInt64LE(0); // Use offset 0 from the slice
            const valueB = b.account.data.readBigUInt64LE(0);

            return valueB > valueA ? -1 : 1; // Descending order
          } catch (error) {
            console.error("Error sorting accounts: ", error);
            return 0;
          }
        });
        */

        const accountKeys = accountsArray.map((account) => account.pubkey);
        setPaginatedKeys(accountKeys.slice(0, pageSize)); // Update state with keys for the current page
      } catch (error) {
        console.error("Error fetching program accounts: ", error);
      }
    };

    fetchAndProcessAccounts();
  }, [connection, programId, sortBy, currentPage]); // Add currentPage as a dependency



  const getProgramAccount = useQuery({
    queryKey: ["get-program-account", { cluster }],
    queryFn: () => connection.getParsedAccountInfo(programId),
  });

  const createMemeToken = useMutation<string, Error, { metadata: InitTokenParams, publicKey: PublicKey }>({ //publicKey is user's key
    mutationKey: ["memeTokenEntry", "create", { cluster }],
    mutationFn: async ({ metadata, publicKey }) => {

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

      const transaction = new Transaction();

      const initTokenInstruction = await program.methods
        .initMemeToken(tokenMetadata)
        .accounts({
          metadata: metadataAddress,
          mint: mint,
          signer: publicKey,
          treasury: treasury,
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
          signer: publicKey,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
          treasuryTokenAccount: treasury_token_account,
          treasury: treasury,
        })
        .instruction();

      transaction.add(initTokenInstruction, mintTokenInstruction);
      transaction.feePayer = publicKey;

      const { value } = await connection.simulateTransaction(transaction);
      console.log("Simulation result:", value);
      if (value.err) {
        console.error("Simulation error:", value.err);
      }

      try {
        const tx1 = await program.methods
          .initMemeToken(tokenMetadata)
          .accounts({
            metadata: metadataAddress,
            mint: mint,
            signer: publicKey,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          })
          .rpc();
        const tx2 = await program.methods
          .mintMemeToken(metadata.symbol, metadata.name)
          .accounts({
            mint: mint,
            signer: publicKey,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
          })
          .rpc();
      } catch (err) {
        console.error("Detailed error:", err);
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

  const getUserAccount = useMutation<string, Error, { publicKey: PublicKey, mint: PublicKey }>({
    mutationKey: ["userAccount", "get", { cluster }],
    mutationFn: async ({ mint, publicKey }) => {

      const mintAccountInfo = await connection.getAccountInfo(mint);
      if (!mintAccountInfo) {
        console.log("Account not found.");
        return false;
      }

      const userSeeds = [
        Buffer.from("user_account"),
        mint.toBuffer(),
        publicKey.toBuffer(),
      ];

      const user = PublicKey.findProgramAddressSync(
        userSeeds,
        programId,
      )[0];



    }
  });

  return {
    program,
    programId,
    paginatedKeys, // Paginated keys are updated asynchronously via useState
    getProgramAccount,
    createMemeToken,
    connection,
  };
}

type AccountType = 'MemeEntryState' | 'UserAccount';


export function useMemeProgramAccount({ account, accountType }: { account: PublicKey, accountType: AccountType }) {
  const { cluster } = useCluster();
  const { program } = useMemeProgram();
  const { connection } = useConnection();

  // Fetch the meme entry state
  const accountQuery = useQuery({
    queryKey: ['account', { cluster, account, accountType }],
    queryFn: async () => {
      if (accountType === 'MemeEntryState') {
        return program.account.memeEntryState.fetch(account);
      } else if (accountType === 'UserAccount') {
        return program.account.userAccount.fetch(account);
      } else {
        throw new Error('Unknown account type');
      }
    },
  });

  const metaplex = Metaplex.make(connection);

  // Fetch metadata JSON
  const metadataQuery = useQuery({
    queryKey: ["metadata", { account }],
    queryFn: async () => {

      if (accountType !== 'MemeEntryState') {
        throw new Error('Metadata query is only valid for MemeEntryState accounts');
      }

      if (!accountQuery.data) {
        throw new Error("Account data not yet loaded");
      }

      // Derive the metadata address
      const metadataAddress = getMetadataAddress(accountQuery.data.mint);


      // Fetch metadata account info
      const accountInfo = await connection.getAccountInfo(metadataAddress);
      if (!accountInfo) {
        throw new Error("Metadata account not found");
      }

      const token = await metaplex.nfts().findByMint({ mintAddress: accountQuery.data.mint })

      // Fetch the JSON metadata from the URI
      const response = await fetch(token.uri);
      if (!response.ok) {
        throw new Error(`Failed to fetch metadata JSON from ${token.uri}`);
      }

      const metadataJSON = await response.json();
      return metadataJSON;
    },
    enabled: accountType === 'MemeEntryState' && !!accountQuery.data, // Only run if accountQuery.data is available, and accountData is memenetry
  });


  return {
    accountQuery, // Query for the account data
    metadataQuery, // Query for the metadata JSON
  };
};


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



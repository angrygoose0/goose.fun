'use client'

import { getMemeProgram, getMemeProgramId } from '@project/anchor';
import { useConnection } from '@solana/wallet-adapter-react';
import { AccountInfo, Cluster, Connection, PublicKey, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useCluster } from '../cluster/cluster-data-access';
import { useAnchorProvider } from '../solana/solana-provider';
import { useTransactionToast } from '../ui/ui-layout';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { ASSOCIATED_PROGRAM_ID } from '@coral-xyz/anchor/dist/cjs/utils/token';
import { Metaplex } from "@metaplex-foundation/js";

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
            return { offset: 80, length: 8 }; // creation_time
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

  const createMemeToken = useMutation<string, Error, { metadata: InitTokenParams, publicKey: PublicKey }>({
    mutationKey: ["memeTokenEntry", "create", { cluster }],
    mutationFn: async ({ metadata, publicKey }) => {
      const hardCodedTreasury = new PublicKey("4ArWvAzbFV3JRbC3AepcyMKp5bvum18bBSFH3FgXZbXZ"); // Replace with the actual public key

      const tokenMetadata = {
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.uri,
        decimals: metadata.decimals,
      };

      const mintSeeds = [
        Buffer.from(metadata.name),
        Buffer.from(metadata.symbol)
      ];

      const mint = PublicKey.findProgramAddressSync(
        mintSeeds,
        programId
      )[0];

      const metadataAddress = getMetadataAddress(mint);

      const treasuryTokenAccount = await getAssociatedTokenAddress(mint, hardCodedTreasury);

      return program.methods
        .createMemeToken(tokenMetadata, hardCodedTreasury)
        .accounts({
          payer: publicKey,
          rent: SYSVAR_RENT_PUBKEY,
          metadata: metadataAddress,
          mint: mint,
          treasury_token_account: treasuryTokenAccount,
          treasury: hardCodedTreasury,
          systemProgram: PublicKey.default,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
        })
        .rpc();
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      console.log("done");
    },
    onError: (error) => {
      toast.error(`Error creating entry: ${error.message}`);
      console.error("Toast error:", error);
    },
  });

  return {
    program,
    programId,
    paginatedKeys, // Paginated keys are updated asynchronously via useState
    getProgramAccount,
    createMemeToken,
  };
}



export function useMemeProgramAccount({ account }: { account: PublicKey }) {
  const { cluster } = useCluster();
  const { program } = useMemeProgram();
  const { connection } = useConnection();

  // Fetch the meme entry state
  const accountQuery = useQuery({
    queryKey: ["meme", "fetch", { cluster, account }],
    queryFn: () => program.account.memeEntryState.fetch(account),
  });

  const metaplex = Metaplex.make(connection);

  // Fetch metadata JSON
  const metadataQuery = useQuery({
    queryKey: ["metadata", { account }],
    queryFn: async () => {
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
    enabled: !!accountQuery.data, // Only run if accountQuery.data is available
  });


  return {
    accountQuery, // Query for the account data
    metadataQuery, // Query for the metadata JSON
    account, // The account PublicKey
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



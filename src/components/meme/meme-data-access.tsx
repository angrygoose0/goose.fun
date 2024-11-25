'use client'

import { getMemeProgram, getMemeProgramId } from '@project/anchor';
import { useConnection } from '@solana/wallet-adapter-react';
import { Cluster, Connection, PublicKey, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
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


const METADATA_SEED = "metadata";
const MINT_SEED = "mint";
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
  const { connection } = useConnection()
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const provider = useAnchorProvider()
  const programId = useMemo(() => getMemeProgramId(cluster.network as Cluster), [cluster])
  const program = getMemeProgram(provider)

  const accounts = useQuery({
    queryKey: ['meme', 'all', { cluster }],
    queryFn: () => program.account.memeEntryState.all(),
  })

  const getProgramAccount = useQuery({
    queryKey: ['get-program-account', { cluster }],
    queryFn: () => connection.getParsedAccountInfo(programId),
  })


  const createMemeToken = useMutation<string, Error, { metadata: InitTokenParams, publicKey: PublicKey }>({
    mutationKey: ['memeTokenEntry', 'create', { cluster }],
    mutationFn: async ({ metadata, publicKey }) => {
      const hardCodedTreasury = new PublicKey("4ArWvAzbFV3JRbC3AepcyMKp5bvum18bBSFH3FgXZbXZ"); // Replace with the actual public key

      const tokenMetadata = {
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.uri,
        decimals: metadata.decimals,
      };




      const mint = PublicKey.findProgramAddressSync(
        [Buffer.from(MINT_SEED)],
        programId
      )[0];

      const metadataAddress = getMetadataAddress(mint);

      const treasury_token_account = await getAssociatedTokenAddress(mint, hardCodedTreasury);

      console.log("did");
      return program.methods
        .createMemeToken(tokenMetadata, hardCodedTreasury)
        .accounts({
          payer: publicKey,
          rent: SYSVAR_RENT_PUBKEY,
          metadata: metadataAddress,
          mint: mint,
          treasury_token_account: treasury_token_account,
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
      accounts.refetch();
    },
    onError: (error) => {
      toast.error(`Error creating entry:" ${error.message}`);
      console.log("toast error");
    },

  });

  return {
    program,
    programId,
    accounts,
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



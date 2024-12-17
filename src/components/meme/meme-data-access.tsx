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
import { getAssociatedTokenAddress, InterestBearingMintInstruction, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { ASSOCIATED_PROGRAM_ID, associatedAddress } from '@coral-xyz/anchor/dist/cjs/utils/token';
import { Metaplex } from "@metaplex-foundation/js";
import { constants } from 'fs/promises';
import { BN } from '@coral-xyz/anchor';
import { utf8 } from '@project-serum/anchor/dist/cjs/utils/bytes';


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

const getDiscriminator = (name: string) => {
  return Buffer.from(utf8.encode(`account:${name}`)).slice(0, 8);
};

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
  const [paginatedAccounts, setPaginatedAccounts] = useState<any[]>([]); // To store sorted and paginated accounts
  const [currentPage, setCurrentPage] = useState(1); // Track current page
  const pageSize = 5; // Number of accounts per page
  const [loading, setLoading] = useState(false); // Loading state

  // Fetch and process accounts
  useEffect(() => {
    const fetchAndProcessAccounts = async () => {
      try {
        setLoading(true);

        // Fetch all accounts using Anchor
        const allAccounts = await program.account.memeEntryState.all([]);

        // Sort accounts based on selected criteria
        const sortedAccounts = allAccounts.sort((a, b) => {
          if (sortBy === SortBy.CreationTime) {
            const valueA = a.account.creationTime;
            const valueB = b.account.creationTime;
            return valueB.cmp(valueA); // Sort in descending order
          } else if (sortBy === SortBy.LockedAmount) {
            const valueA = Number(a.account.lockedAmount); // Convert BigInt to number
            const valueB = Number(b.account.lockedAmount);
            return valueB - valueA; // Descending order
          }
          return 0;
        });

        // Paginate the sorted accounts
        const startIndex = (currentPage - 1) * pageSize;
        const paginated = sortedAccounts.slice(startIndex, startIndex + pageSize);

        // Update state with paginated accounts
        setPaginatedAccounts(paginated);
      } catch (error) {
        console.error("Error fetching and sorting accounts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAndProcessAccounts();
  }, [program, sortBy, currentPage]); // Dependencies: program, sortBy, currentPage

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

      const treasurySeeds = [
        Buffer.from("treasury"),
      ];

      const treasury = PublicKey.findProgramAddressSync(
        treasurySeeds,
        programId,
      )[0];

      const treasury_token_account = await associatedAddress({
        mint: mint,
        owner: treasury,
      })

      const metadataAddress = getMetadataAddress(mint);

      const transaction = new Transaction();

      const initTokenInstruction = await program.methods
        .initMemeToken(tokenMetadata)
        .accounts({
          metadata: metadataAddress,
          mint: mint,
          //treasury: treasury,
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
          signer: publicKey,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
          //treasuryTokenAccount: treasury_token_account,
          //treasury: treasury,
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


  return {
    program,
    programId,
    paginatedAccounts, // Paginated keys are updated asynchronously via useState
    getProgramAccount,
    createMemeToken,
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

  const metadataQuery =  useQuery({
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

  const buySellToken = useMutation<
    string,
    Error,
    { publicKey: PublicKey; amount: number; mint: PublicKey }
  >({
    mutationKey: ['buySellToken'],
    mutationFn: ({ publicKey, mint, amount }) => {
      return program.methods
        .buySell(new BN(amount))
        .accounts({
          signer: publicKey,
          mint,
        })
        .rpc();
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

export function useUserAccountQuery({
  publicKey,
  mint,
}: {
  publicKey: PublicKey;
  mint: PublicKey;
}) {
  const { cluster } = useCluster();
  const { program } = useMemeProgram();
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

  // Fetch the meme entry state
  const userAccountQuery = useQuery({
    queryKey: ['userAccount', { cluster, userAccountKey }],
    queryFn: async () => {
      return program.account.userAccount.fetch(userAccountKey);
    }
  });

  /*
  const memeEntryQuery = useQuery({
    queryKey: ['memeEntry', { cluster, memeEntryAccountKey }],
    queryFn: async () => {
      return program.account.memeEntryState.fetch(memeEntryAccountKey);
    }
  });
  */

  return {
    userAccountQuery
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



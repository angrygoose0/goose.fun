'use client'

import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  TransactionSignature,
  VersionedTransaction,
} from '@solana/web3.js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useTransactionToast } from '../ui/ui-layout'
import { associatedAddress } from '@coral-xyz/anchor/dist/cjs/utils/token'


export function useGetBalance({ address }: { address: PublicKey | null }) {
  const { connection } = useConnection();

  const balanceQuery = useQuery({
    queryKey: ['get-balance', { endpoint: connection.rpcEndpoint, address }],
    queryFn: async () => {
      if (!address) {
        throw new Error('Address is required');
      }
      return connection.getBalance(address);
    },
    // Ensure the query is considered fresh for 5 minutes
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Automatically refetch data every 10 minutes
    refetchInterval: 10 * 60 * 1000, // 10 minutes
    // Fetch on mount to ensure data is available when the component loads
    refetchOnMount: true,
    // Optionally fetch in the background when the user revisits the page/tab
    refetchOnWindowFocus: false,
  });

  return { balanceQuery };
}

export function useGetSignatures({ address }: { address: PublicKey }) {
  const { connection } = useConnection()

  return useQuery({
    queryKey: ['get-signatures', { endpoint: connection.rpcEndpoint, address }],
    queryFn: () => connection.getSignaturesForAddress(address),
  })
}

export function useGetTokenBalance({address, mint} : { address: PublicKey, mint: PublicKey }) {
  const { connection } = useConnection();

  const getSpecificTokenBalance = useQuery({
    queryKey: ['get-token-balance', { address, mint }],
    queryFn: async () => {

      const userTokenAccount = await associatedAddress({
        mint: mint,
        owner: address,
      })

      const info = await connection.getTokenAccountBalance(userTokenAccount);
      if (info.value.uiAmount == null) {
        return {
          uiAmount: 0,
          balance: 0,
          decimals: 0,
        };
      }

      return {
        uiAmount: info.value.uiAmount,
        balance: info.value.amount,
        decimals: info.value.decimals,
      };

      // Return 0 balance if no matching account is found
      
    },
    // Ensure the query is considered fresh for 5 minutes
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Automatically refetch data every 10 minutes
    refetchInterval: 10 * 60 * 1000, // 10 minutes
    // Fetch on mount to ensure data is available when the component loads
    refetchOnMount: true,
    // Optionally fetch in the background when the user revisits the page/tab
    refetchOnWindowFocus: false,
  });

  return { getSpecificTokenBalance}
}

export function useGetTokenAccounts({ address, mint }: { address: PublicKey, mint?: PublicKey }) {
  const { connection } = useConnection();

  // Fetch all token accounts
  const getAllTokenAccounts = useQuery({
    queryKey: ['get-token-accounts', { endpoint: connection.rpcEndpoint, address }],
    queryFn: async () => {
      // Fetch token accounts for both program IDs
      const [tokenAccounts, token2022Accounts] = await Promise.all([
        connection.getParsedTokenAccountsByOwner(address, {
          programId: TOKEN_PROGRAM_ID,
        }),
        connection.getParsedTokenAccountsByOwner(address, {
          programId: TOKEN_2022_PROGRAM_ID,
        }),
      ]);

      const allTokenAccounts = [...tokenAccounts.value, ...token2022Accounts.value];
      return allTokenAccounts;
    },
  });



  return {
    getAllTokenAccounts,
  };
}


export function useTransferSol({ address }: { address: PublicKey }) {
  const { connection } = useConnection()
  const transactionToast = useTransactionToast()
  const wallet = useWallet()
  const client = useQueryClient()

  return useMutation({
    mutationKey: ['transfer-sol', { endpoint: connection.rpcEndpoint, address }],
    mutationFn: async (input: { destination: PublicKey; amount: number }) => {
      let signature: TransactionSignature = ''
      try {
        const { transaction, latestBlockhash } = await createTransaction({
          publicKey: address,
          destination: input.destination,
          amount: input.amount,
          connection,
        })

        // Send transaction and await for signature
        signature = await wallet.sendTransaction(transaction, connection)

        // Send transaction and await for signature
        await connection.confirmTransaction({ signature, ...latestBlockhash }, 'confirmed')

        console.log(signature)
        return signature
      } catch (error: unknown) {
        console.log('error', `Transaction failed! ${error}`, signature)

        return
      }
    },
    onSuccess: (signature) => {
      if (signature) {
        transactionToast(signature)
      }
      return Promise.all([
        client.invalidateQueries({
          queryKey: ['get-balance', { endpoint: connection.rpcEndpoint, address }],
        }),
        client.invalidateQueries({
          queryKey: ['get-signatures', { endpoint: connection.rpcEndpoint, address }],
        }),
      ])
    },
    onError: (error: unknown) => {
      toast.error(`Transaction failed! ${error}`)
    },
  })
}

export function useRequestAirdrop({ address }: { address: PublicKey }) {
  const { connection } = useConnection()
  const transactionToast = useTransactionToast()
  const client = useQueryClient()

  return useMutation({
    mutationKey: ['airdrop', { endpoint: connection.rpcEndpoint, address }],
    mutationFn: async (amount: number = 1) => {
      const [latestBlockhash, signature] = await Promise.all([
        connection.getLatestBlockhash(),
        connection.requestAirdrop(address, amount * LAMPORTS_PER_SOL),
      ])

      await connection.confirmTransaction({ signature, ...latestBlockhash }, 'confirmed')
      return signature
    },
    onSuccess: (signature) => {
      transactionToast(signature)
      return Promise.all([
        client.invalidateQueries({
          queryKey: ['get-balance', { endpoint: connection.rpcEndpoint, address }],
        }),
        client.invalidateQueries({
          queryKey: ['get-signatures', { endpoint: connection.rpcEndpoint, address }],
        }),
      ])
    },
  })
}

async function createTransaction({
  publicKey,
  destination,
  amount,
  connection,
}: {
  publicKey: PublicKey
  destination: PublicKey
  amount: number
  connection: Connection
}): Promise<{
  transaction: VersionedTransaction
  latestBlockhash: { blockhash: string; lastValidBlockHeight: number }
}> {
  // Get the latest blockhash to use in our transaction
  const latestBlockhash = await connection.getLatestBlockhash()

  // Create instructions to send, in this case a simple transfer
  const instructions = [
    SystemProgram.transfer({
      fromPubkey: publicKey,
      toPubkey: destination,
      lamports: amount * LAMPORTS_PER_SOL,
    }),
  ]

  // Create a new TransactionMessage with version and compile it to legacy
  const messageLegacy = new TransactionMessage({
    payerKey: publicKey,
    recentBlockhash: latestBlockhash.blockhash,
    instructions,
  }).compileToLegacyMessage()

  // Create a new VersionedTransaction which supports legacy and v0
  const transaction = new VersionedTransaction(messageLegacy)

  return {
    transaction,
    latestBlockhash,
  }
}

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {Transaction, SystemProgram, Keypair } from "@solana/web3.js";
import { useMutation, useQuery } from "@tanstack/react-query";
import BN from "bn.js";
import { useTransactionToast } from "../ui/ui-layout";

import { db } from '../../db/index';
import { eq } from "drizzle-orm";
import { usersTable, tokensTable } from "@/db/schema";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";


const ZERO = new BN(0);
const BILLION = new BN(1000000000)

const TREASURY_PRIVATE_KEY = process.env.NEXT_PUBLIC_TREASURY_PRIVATE_KEY || "";
const treasuryKeypair = Keypair.fromSecretKey(bs58.decode(TREASURY_PRIVATE_KEY));
export const mint = "THEMINTKEY"
export const SOL_GOAL = new BN(117).mul(BILLION)


export function useInvestInTokenMutation() {
    const transactionToast = useTransactionToast();
    const { connection } = useConnection();
    const { sendTransaction, publicKey } = useWallet();

    const investInToken = useMutation<
      string, 
      Error, 
      { amount: BN; }
    >({
      mutationKey: ['buySellToken'],
      mutationFn: async ({ amount }) => {
        try {
            if (publicKey === null) {
                throw new Error('Wallet not connected');
            }
            if (!amount || amount.isZero() || amount.lte(ZERO)) {
                throw new Error("Invalid amount specified.");
            }

            const token = await db
              .select()
              .from(tokensTable)
              .where(eq(tokensTable.mint, mint))
              .limit(1);

            if (token[0].bonded_time != 0) {
              throw new Error ("phase 2 has already started... you're too late.")
            }
            

            const blockhashContext = await connection.getLatestBlockhashAndContext();
    
            const transaction = new Transaction({
                feePayer: publicKey,
                blockhash: blockhashContext.value.blockhash,
                lastValidBlockHeight: blockhashContext.value.lastValidBlockHeight,
            });

            transaction.add(
                SystemProgram.transfer({
                fromPubkey: publicKey,
                toPubkey: treasuryKeypair.publicKey,
                lamports: amount.toNumber(),
                })
            );
    
            const signature = await sendTransaction(transaction, connection, {});
            const confirmation = await connection.confirmTransaction({
                signature,
                blockhash: blockhashContext.value.blockhash,
                lastValidBlockHeight: blockhashContext.value.lastValidBlockHeight,
            }, 'confirmed');
            
            if (confirmation.value.err) {
                throw new Error('Transaction failed during confirmation.');
            }
            return signature;
  
        } catch (error) {
          console.error("Error during transaction processing:", error);
          throw error;
        }
      },
      onSuccess: (signature) => {
        transactionToast(signature);
        console.log("Transaction signature:", signature);
      },
    });
  
    return {
      investInToken,
    };
};

export function useCreateUpdateDB() {
    const {publicKey } = useWallet();

    const createUpdateDB = useMutation<
      string,
      Error,
      { amount: BN;} //solana lamports
    >({
      mutationKey: ['createUpdateDB'],
      mutationFn: async ({amount }) => {
        try {
            if (publicKey === null) {
                throw new Error('Wallet not connected');
            }
            if (!amount || amount.isZero() || amount.lte(ZERO)) {
                throw new Error("Invalid amount specified.");
            }

            const user = await db
                .select()
                .from(usersTable)
                .where(eq(usersTable.public_key, publicKey.toString()))
                .limit(1);

            if (user.length === 0) {
                const new_user: typeof usersTable.$inferInsert = {
                    public_key: publicKey.toString(),
                    invested_amount:amount.toNumber(),
                };
                await db.insert(usersTable).values(new_user);
            } else {
                const newInvestedBalance = user[0].invested_amount + amount.toNumber();
                await db
                .update(usersTable)
                .set({
                    invested_amount:newInvestedBalance
                })
                .where(eq(usersTable.public_key, publicKey.toString()));
            }

            const token = await db
                .select()
                .from(tokensTable)
                .where(eq(tokensTable.mint, mint))
                .limit(1);

            const newGlobalInvestedBalance = token[0].invested_amount + amount.toNumber();

            let bonded_time = 0;
            if (new BN(newGlobalInvestedBalance).gte(SOL_GOAL)) {
              bonded_time=Date.now()
            }
            await db
            .update(tokensTable)
            .set({
                invested_amount:newGlobalInvestedBalance,
                bonded_time:bonded_time
            })
            .where(eq(tokensTable.mint, mint.toString()));

            return "Updated database successfully.";
  
        } catch (error) {
          console.error("Error during updating database", error);
          throw error;
        }
      },
    });
  
    return {
      createUpdateDB,
    };
};

export function usePreUserQuery() {
    const { publicKey } = useWallet();

    const preUserQuery = useQuery({
      queryKey: ['preUserQuery', { publicKey }],
      queryFn: async () => {
        
        if (!publicKey) {
            throw new Error('Wallet not connected');
        }

        const result = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.public_key, publicKey.toString()))
            .limit(1)
        

        if (result.length === 0) {
            throw new Error('Token not found');
        }

        return result[0];

      },
      enabled: !!publicKey,
      // Ensure the query is considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000, // 5 minutes
      // Automatically refetch data every 10 minutes
      refetchInterval: 10 * 60 * 1000, // 10 minutes
      // Fetch on mount to ensure data is available when the component loads
      refetchOnMount: true,
      // Optionally fetch in the background when the user revisits the page/tab
      refetchOnWindowFocus: false,
    });
  
    return {
      preUserQuery,
    };
}
export function usePreTokenQuery() {

    const preTokenQuery = useQuery({
        queryKey: ['preTokenQuery'],
        queryFn: async () => {

        const result = await db
            .select()
            .from(tokensTable)
            .where(eq(tokensTable.mint, mint))
            .limit(1)

        if (result.length === 0) {
            throw new Error('Token not found');
        }

        return result[0];

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

    return {
        preTokenQuery,
    };
}
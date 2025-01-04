import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {Transaction, SystemProgram, Keypair } from "@solana/web3.js";
import { useMutation, useQuery } from "@tanstack/react-query";
import BN from "bn.js";
import { useTransactionToast } from "../ui/ui-layout";
import toast from "react-hot-toast";

import { db } from '../../db/index';
import { eq } from "drizzle-orm";
import { usersTable, tokensTable } from "@/db/schema";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";


const ZERO = new BN(0);

const TREASURY_PRIVATE_KEY = process.env.NEXT_PUBLIC_TREASURY_PRIVATE_KEY || "";
const treasuryKeypair = Keypair.fromSecretKey(bs58.decode(TREASURY_PRIVATE_KEY));
const mint = process.env.NEXT_PUBLIC_MINT || "";


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
      onError: (error) => {
        toast.error(`Error buy/selling token: ${error.message}`);
        console.error('Toast error:', error);
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
                await db
                .update(tokensTable)
                .set({
                    invested_amount:newGlobalInvestedBalance
                })
                .where(eq(tokensTable.mint, mint.toString()));

            return "Updated database successfully.";
  
        } catch (error) {
          console.error("Error during updating database", error);
          throw error;
        }
      },
  
      onSuccess: (signature) => {
        toast.success(`Transaction sent: ${signature}`);
        console.log(signature);

      },
      onError: (error) => {
        toast.error(`Error buy/selling token: ${error.message}`);
        console.error('Toast error:', error);
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
      enabled: !!publicKey
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
    });

    return {
        preTokenQuery,
    };
}
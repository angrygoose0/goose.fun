import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { createTransferCheckedInstruction, createTransferInstruction, getAssociatedTokenAddress} from '@solana/spl-token';
import {Transaction, SystemProgram, Keypair, PublicKey } from "@solana/web3.js";
import { useMutation, useQuery } from "@tanstack/react-query";
import BN from "bn.js";
import { useTransactionToast } from "../ui/ui-layout";

import { db } from '../../db/index';
import { eq, and } from "drizzle-orm";
import { usersTable, tokensTable } from "@/db/schema";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { TOKEN_SUPPLY_BEFORE_BONDING } from "../meme/meme-helper-functions";


const ZERO = new BN(0);
const BILLION = new BN(1000000000)

const TREASURY_PRIVATE_KEY = process.env.NEXT_PUBLIC_TREASURY_PUBLIC_KEY || "";
const treasuryKeypair = Keypair.fromSecretKey(bs58.decode(TREASURY_PRIVATE_KEY));
export const mint = "THEMINTKEY"
export const SOL_GOAL = new BN(117).mul(BILLION)


export function usePreBuyTokenMutation() {
    const transactionToast = useTransactionToast();
    const { connection } = useConnection();
    const { sendTransaction, publicKey } = useWallet();

    const preBuyToken = useMutation<
      string, 
      Error, 
      { amount: BN; }
    >({
      mutationKey: ['preBuyToken'],
      mutationFn: async ({ amount }) => {
        try {
            if (publicKey === null) {
                throw new Error('Wallet not connected');
            }
            if (!amount || amount.lte(ZERO)) {
                throw new Error("Invalid amount specified.");
            }

            const token = await db
              .select()
              .from(tokensTable)
              .where(eq(tokensTable.mint, mint))
              .limit(1);

            if (token[0].bonded_time > 0) {
              throw new Error ("already bonded")
            }
            if (token[0].creation_time < 0) {
              throw new Error ("only tokens created on goose are eligible")
            }

            const user = await db
            .select()
            .from(usersTable)
            .where(
              and(
                eq(usersTable.public_key, publicKey.toString()),
                eq(usersTable.mint, mint.toString())
              )
            )
            .limit(1);

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

            if (user.length === 0) { //first time buying
              const new_user: typeof usersTable.$inferInsert = {
                public_key: publicKey.toString(),
                mint: mint.toString(),
                locked_amount:amount.toString(),
              };
              await db.insert(usersTable).values(new_user);
            } else {
              const newLockedAmount = new BN(user[0].locked_amount).add(amount);

              await db
              .update(usersTable)
              .set({
                  locked_amount:newLockedAmount.toString()
              })
              .where(
                and(
                  eq(usersTable.public_key, publicKey.toString()),
                  eq(usersTable.mint, mint.toString())
                )
              );
            }

            const newGlobalLockedBalance = new BN(token[0].locked_amount).add(amount);

            await db
            .update(tokensTable)
            .set({
                locked_amount:newGlobalLockedBalance.toString(),
            })
            .where(eq(tokensTable.mint, mint.toString()));

            
  
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
      preBuyToken,
    };
};

export function usePreLockTokenMutation() {
  const transactionToast = useTransactionToast();
  const { connection } = useConnection();
  const { sendTransaction, publicKey } = useWallet();

  const preLockClaimToken = useMutation<
    string, 
    Error, 
    { amount: BN; }
  >({
    mutationKey: ['preLockToken'],
    mutationFn: async ({ amount }) => {
      try {
          if (publicKey === null) {
              throw new Error('Wallet not connected');
          }
          if (!amount || amount.lte(ZERO)) {
              throw new Error("Invalid amount specified.");
          }

          const token = await db
            .select()
            .from(tokensTable)
            .where(eq(tokensTable.mint, mint))
            .limit(1);

          if (token[0].creation_time > 0) {
            if (token[0].bonded_time < 0) {
              throw new Error("Token hasn't bonded from goose.fun")
            }
          }

          const user = await db
            .select()
            .from(usersTable)
            .where(
              and(
                eq(usersTable.public_key, publicKey.toString()),
                eq(usersTable.mint, mint.toString())
              )
            )
            .limit(1);

          const blockhashContext = await connection.getLatestBlockhashAndContext();
  
          const transaction = new Transaction({
              feePayer: publicKey,
              blockhash: blockhashContext.value.blockhash,
              lastValidBlockHeight: blockhashContext.value.lastValidBlockHeight,
          });

          const userTokenAccount = await getAssociatedTokenAddress(
            mint,
            publicKey,
            false,
          );

          const treasuryTokenAccount = await getAssociatedTokenAddress(
            mint,
            treasuryKeypair.publicKey,
            false,
          );

          transaction.add(
            createTransferInstruction(
              userTokenAccount,
              treasuryTokenAccount,
              publicKey,
              amount.toNumber(),
            )
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

          if (user.length === 0) { //first time buying
            const new_user: typeof usersTable.$inferInsert = {
              public_key: publicKey.toString(),
              mint: mint.toString(),
              locked_amount:amount.toString(),
            };
            await db.insert(usersTable).values(new_user);
          } else {
            const newLockedAmount = new BN(user[0].locked_amount).add(amount);

            await db
            .update(usersTable)
            .set({
                locked_amount:newLockedAmount.toString()
            })
            .where(
              and(
                eq(usersTable.public_key, publicKey.toString()),
                eq(usersTable.mint, mint.toString())
              )
            );
          }

          const newGlobalLockedBalance = new BN(token[0].locked_amount).add(amount);

          await db
          .update(tokensTable)
          .set({
              locked_amount:newGlobalLockedBalance.toString(),
          })
          .where(eq(tokensTable.mint, mint.toString()));

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
    preLockClaimToken,
  };
};





export function useBondTo() {
    const {publicKey } = useWallet();

    const createUpdateDB = useMutation<
      string,
      Error,
      { amount: BN;} //solana lamports
    >({
      mutationKey: ['createUpdateDB'],
      mutationFn: async ({amount }) => {
        try {

          const token = await db
              .select()
              .from(tokensTable)
              .where(eq(tokensTable.mint, mint))
              .limit(1);

            if (token[0].bonded_time > 0) {
              throw new Error ("already bonded")
            }
            if (token[0].creation_time < 0) {
              throw new Error ("only tokens created on goose are eligible")
            }

            const total_invested = new BN(token[0].locked_amount);
            if (total_invested.eq(ZERO)) {
              throw new Error ("0 sol invested")
            }

            const tokens_per_sol = TOKEN_SUPPLY_BEFORE_BONDING.div(new BN(token[0].locked_amount));

            const users = await db
            .select()
            .from(usersTable)
            .where(

              eq(usersTable.mint, mint.toString())
            )

            for (const user of users) {
              // Parse the locked_amount if needed
              const currentLockedAmount = new BN(user.locked_amount);

              if (currentLockedAmount.isZero()) {
                continue;
              }
            
              const newLockedAmount = currentLockedAmount.mul(tokens_per_sol); // change from sol to tokens
            
              // Update the database with the new locked amount
              await db
                .update(usersTable)
                .set({ locked_amount: newLockedAmount.toString() }) 
                .where(
                  and (
                    eq(usersTable.mint, user.mint),
                    eq(usersTable.public_key, user.public_key)
                  )
                  );
            }

            
            
        
  
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

export function useUnlockPhase() {
  const {publicKey } = useWallet();

  const createUpdateDB = useMutation<
    string,
    Error,
    { amount: BN;} //solana lamports
  >({
    mutationKey: ['createUpdateDB'],
    mutationFn: async ({amount }) => {
      try {

        const token = await db
            .select()
            .from(tokensTable)
            .where(eq(tokensTable.mint, mint))
            .limit(1);

          if (token[0].bonded_time > 0) {
            throw new Error ("already bonded")
          }
          if (token[0].creation_time < 0) {
            throw new Error ("only tokens created on goose are eligible")
          }

          const users = await db
          .select()
          .from(usersTable)
          .where(

            eq(usersTable.mint, mint.toString())
          )

          for (const user of users) {
            // Parse the locked_amount if needed
            const currentLockedAmount = new BN(user.locked_amount);

            if (currentLockedAmount.isZero()) {
              continue;
            }
          
            const newLockedAmount = currentLockedAmount.mul(new BN(9)).div(new BN(10)); // take off 10%
          
            // Update the database with the new locked amount
            await db
              .update(usersTable)
              .set({ locked_amount: newLockedAmount.toString() }) // Ensure it's saved as a string if required
              .where(eq(usersTable.mint, user.mint));
          }

          
          
      

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
      queryKey: ['preUserQuery', { publicKey, mint }],
      queryFn: async () => {
        
        if (!publicKey) {
            throw new Error('Wallet not connected');
        }

        const result = await db
            .select()
            .from(usersTable)
            .where(
              and(
                eq(usersTable.public_key, publicKey.toString()),
                eq(usersTable.mint, mint.toString())
              )
            )
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
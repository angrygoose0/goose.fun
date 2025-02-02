import { useMutation } from "@tanstack/react-query";
import { useMemeProgram } from "../meme/meme-data-access";
import { useTransactionToast } from "../ui/ui-layout";
import { Cluster, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { SOL_GOAL_BEFORE_BONDING, SOL_MINT, SUPPLY_SENT_TO_RAYDIUM, SUPPLY_SOLD_BEFORE_BONDING, TREASURY_PUBLIC_KEY } from "../meme/meme-helper-functions";
import toast from "react-hot-toast";
import { DEVNET_PROGRAM_ID, getCpmmPdaAmmConfigId, Raydium, TxVersion, ZERO } from "@raydium-io/raydium-sdk-v2";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { getMemeProgramId } from "@project/anchor";
import { useMemo } from "react";
import { sha256 } from "js-sha256";
import BN from "bn.js";

export function useBondToRaydium() {
    const { program } = useMemeProgram();
    const transactionToast = useTransactionToast();
    const {connection} = useConnection();
    const cluster = 'mainnet';
    const programId = useMemo(() => getMemeProgramId(cluster as Cluster), [cluster]);

    const { publicKey, signAllTransactions } = useWallet();


    const bondToRaydium = useMutation<
        string,
        Error,
        { accountKey: PublicKey}
    >({
      mutationKey: ['bondToRaydium'],
      mutationFn: async ({ accountKey }) => {
        try {
            if (publicKey != TREASURY_PUBLIC_KEY) {
                throw new Error('Wallet not connected to treasury');
            }

            const memeAccount = await program.account.memeAccount.fetch(accountKey);
            console.log('lockedamount', memeAccount.lockedAmount.toString());

            const sol_going_into_raydium = memeAccount.lockedAmount.sub((memeAccount.lockedAmount.mul(new BN(20))).div(new BN(100)))

            const raydium = await Raydium.load({
                owner: TREASURY_PUBLIC_KEY,
                connection,
                cluster,
                disableFeatureCheck: true,
                disableLoadToken: true,
                blockhashCommitment: 'finalized',
                signAllTransactions,
            });

            const feeConfigs = await raydium.api.getCpmmConfigs();

            // If devnet
            if (raydium.cluster === 'devnet') {
              feeConfigs.forEach((config) => {
                config.id = getCpmmPdaAmmConfigId(DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM, config.index).publicKey.toBase58()
              })
            }

            // Create the pool
            const {extInfo, execute} = await raydium.cpmm.createPool({
                programId: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
                poolFeeAccount: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC,
                mintA: await raydium.token.getTokenInfo(memeAccount.mint),
                mintB: await raydium.token.getTokenInfo(SOL_MINT),
                mintAAmount: SUPPLY_SENT_TO_RAYDIUM,
                mintBAmount: sol_going_into_raydium,
                startTime: ZERO,
                feeConfig: feeConfigs[0],
                associatedOnly: false,
                ownerInfo: {
                    useSOLBalance: true,
                },
                txVersion: TxVersion.V0,
            });

            const poolId = extInfo.address?.poolId?.toString();
            console.log("poolId", poolId.toString());

            // Execute the transaction
            const { txId } = await execute({ sendAndConfirm: true });

            console.log('Pool created:', {
                txId,
                poolKeys: Object.keys(extInfo.address).reduce(
                    (acc, cur) => ({
                        ...acc,
                        [cur]: extInfo.address[cur as keyof typeof extInfo.address].toString(),
                    }),
                    {}
                ),
            });

            
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
    
            const targetMintBytes = Buffer.from(memeAccount.mint.toBytes());
            const filteredAccounts = accounts.filter((account) =>
            account.account.data.equals(targetMintBytes)
            );
    
            const accountPublicKeys = filteredAccounts.map((account) => account.pubkey);

            const remainingAccounts = accountPublicKeys.map((accountPublicKey) => ({
                pubkey: accountPublicKey, // Public key of the user account
                isSigner: false,     // None of these are signers
                isWritable: true,    // Assuming these accounts need to be updated
              }));

            console.log(filteredAccounts);
  
            
            const bondPool = await program.methods
                .bondToRaydium(new PublicKey(poolId))
                .accounts({
                mint: memeAccount.mint,
                treasury: TREASURY_PUBLIC_KEY,
                })
                .remainingAccounts(remainingAccounts)
                .rpc();

            return bondPool;
            
  
        } catch (error) {
          console.error(error);
          throw error;
        }
      },
      onSuccess: (bondPool) => {
        transactionToast(bondPool);
        console.log();
      },
      onError: (error) => {
        toast.error(error.message);
        console.error(error);
      },
    });
  
    return {
      bondToRaydium,
    };
}

export function useUnlockPhase() {
    const { program } = useMemeProgram();
    const transactionToast = useTransactionToast();
    const {connection} = useConnection();
    const cluster = 'mainnet';

    const programId = useMemo(() => getMemeProgramId(cluster as Cluster), [cluster]);

    const {sendTransaction, publicKey} = useWallet();

    const unlockPhase = useMutation<
        string,
        Error,
        { accountKey: PublicKey}
    >({
      mutationKey: ['unlockPhase'],
      mutationFn: async ({ accountKey }) => {
        try {
            if (publicKey?.toBase58() != TREASURY_PUBLIC_KEY.toBase58()) {
                throw new Error('Wallet not connected to treasury');
            }
            const memeAccount = await program.account.memeAccount.fetch(accountKey);
            
            const userAccountDiscriminator = Buffer.from(sha256.digest("account:UserAccount")).slice(
                0,
                8
            );
        
            const mintOffset = 40;
            const mintLength = 32;
    
            const accounts = await connection.getProgramAccounts(programId, {
            dataSlice: { offset: mintOffset, length: mintLength },
            filters: [
                {
                    memcmp: { offset: 0, bytes: bs58.encode(userAccountDiscriminator) },
                },
            ],
            });
    
            const targetMintBytes = Buffer.from(memeAccount.mint.toBytes());
            const filteredAccounts = accounts.filter((account) =>
                account.account.data.equals(targetMintBytes)
            );
    
            const userAccountKeys = filteredAccounts.map((account) => account.pubkey);

            const blockhashContext = await connection.getLatestBlockhashAndContext();

            const transaction = new Transaction({
            feePayer: TREASURY_PUBLIC_KEY,
            blockhash: blockhashContext.value.blockhash,
            lastValidBlockHeight: blockhashContext.value.lastValidBlockHeight,
            })


            for (const pubkey of userAccountKeys) {
                const userAccount = await program.account.userAccount.fetch(pubkey);

                const unlock = await program.methods
                .unlockMemePhase()
                .accounts({
                mint: memeAccount.mint,
                treasury: TREASURY_PUBLIC_KEY,
                user: userAccount.user,
                })
                .instruction();

                transaction.add(unlock);

            }
            

            const simulationResult = await connection.simulateTransaction(transaction);
            console.log('Simulation Result:', simulationResult);

            if (simulationResult.value.err) {
                console.error('Simulation Error:', simulationResult.value.err);
                throw new Error('Transaction simulation failed');
            }
        
                    
            const signature = await sendTransaction(transaction, connection, {
            });
            console.log('signature', signature);

            return signature;
            
  
        } catch (error) {
          console.error(error);
          throw error;
        }
      },
      onSuccess: (unlock) => {
        transactionToast(unlock);
        console.log();
      },
      onError: (error) => {
        toast.error(error.message);
        console.error(error);
      },
    });
  
    return {
      unlockPhase,
    };
}
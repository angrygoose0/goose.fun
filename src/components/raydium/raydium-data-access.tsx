import {
    Raydium,
    TxVersion,
    getCpmmPdaAmmConfigId,
    parseTokenAccountResp,
    CREATE_CPMM_POOL_PROGRAM,
    CREATE_CPMM_POOL_FEE_ACC,
    DEVNET_PROGRAM_ID,
    PoolFetchType
} from '@raydium-io/raydium-sdk-v2';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import { useCluster } from '../cluster/cluster-data-access';
import { useConnection } from '@solana/wallet-adapter-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { clusterApiUrl, Keypair, PublicKey, SendTransactionError } from '@solana/web3.js';
import BN from 'bn.js';
import toast from 'react-hot-toast';
import { useTransactionToast } from '../ui/ui-layout';
import { INITIAL_SOL_AMOUNT, TOKEN_SUPPLY_BEFORE_BONDING } from '../meme/meme-helper-functions'

const TREASURY_PRIVATE_KEY =
    "5rhVcMHjqcjHLhdwajDnHW6PeWFheR29wMg1vrCAs6GSgihy3giwwFxW1CCSSskKbNvUKUJ7otF144oH4f8RAuSs";
// Extract owner from the secret key
export const owner: Keypair = Keypair.fromSecretKey(bs58.decode(TREASURY_PRIVATE_KEY));

export function useInitRaydiumSdk({ loadToken }: { loadToken: boolean }) {
    //const { cluster } = useCluster();
    const { connection } = useConnection();
    const cluster = 'devnet';

    // Initialize the Raydium SDK
    const initRaydiumSdk = useQuery({
        queryKey: ['initRaydiumSdk'],
        queryFn: async () => {
            let raydium: Raydium | undefined;

            raydium = await Raydium.load({
                owner,
                connection,
                cluster,
                disableFeatureCheck: true,
                disableLoadToken: !loadToken,
                blockhashCommitment: 'finalized',
            });

            return raydium;
        },
    });

    return {
        initRaydiumSdk,
    };
}

const SOL_MINT = 'So11111111111111111111111111111111111111112'

export function useCreatePool() {
    const transactionToast = useTransactionToast();
    const { initRaydiumSdk } = useInitRaydiumSdk({ loadToken: true });
    const { connection } = useConnection();
    const createPool = useMutation<
        string,
        Error,
        { mint: PublicKey; }
    >({
        mutationKey: ['createPool'],
        mutationFn: async ({ mint }) => {
            const raydium = initRaydiumSdk.data; // Access the Raydium instance
            if (!raydium) {
                throw new Error("Raydium SDK is not initialized.");
            }
            try {
                console.log('1');
                const feeConfigs = await raydium.api.getCpmmConfigs();

                console.log('2');

                // if devnet
                feeConfigs.forEach((config) => {
                    config.id = getCpmmPdaAmmConfigId(
                        DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
                        config.index
                    ).publicKey.toBase58();
                });
                //.

                console.log('3');
                // Create the pool
                const { execute, extInfo } = await raydium.cpmm.createPool({
                    programId: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM, //mainnet: CREATE_CPMM_POOL_PROGRAM,
                    poolFeeAccount: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC, //mainnet: CREATE_CPMM_POOL_FEE_ACC
                    mintA: await raydium.token.getTokenInfo(mint.toString()),
                    mintB: await raydium.token.getTokenInfo(SOL_MINT),
                    mintAAmount: TOKEN_SUPPLY_BEFORE_BONDING,
                    mintBAmount: INITIAL_SOL_AMOUNT,
                    startTime: new BN(0),
                    feeConfig: feeConfigs[0],
                    associatedOnly: false,
                    ownerInfo: {
                        useSOLBalance: true,
                    },
                    txVersion: TxVersion.V0,
                });

                console.log('4');
                // Execute the transaction
                try {
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

                    return txId;
                } catch (txError) {
                    if (txError instanceof SendTransactionError) {
                        console.log("transaction:", txError)
                        console.log("Transaction logs:", txError.getLogs(connection));
                    }
                }

            } catch (error) {
                console.error('Error creating pool:', error);
                throw error;
            }
        },
        onSuccess: (signature) => {
            transactionToast(signature);
            console.log('Transaction Signature:', signature);
        },
        onError: (error) => {
            toast.error(`Error creating pool: ${error.message}`);
            console.error('Toast error:', error);
        },
    });

    return {
        createPool,
    };
}

export function useFetchPools({
    mint,
}: {
    mint: PublicKey,
}
) {
    const { initRaydiumSdk } = useInitRaydiumSdk({ loadToken: true });

    const fetchPoolListByMint = useQuery({
        queryKey: ['fetchPoolListByMint', { mint }],
        queryFn: async () => {
            const raydium = initRaydiumSdk.data; // Access the Raydium instance
            if (!raydium) {
                throw new Error("Raydium SDK is not initialized.");
            }
            const list = await raydium.api.fetchPoolByMints({
                mint1: mint.toString(),
                mint2: SOL_MINT,
                type: PoolFetchType.All,

            })

            return list;
        },
        enabled: !!mint,
    });

    /*
    const fetchRpcPoolInfo = useQuery({
        queryKey: ['fetchRpcPoolInfo', { pool }],
        queryFn: async () => {
            const raydium = initRaydiumSdk.data; // Access the Raydium instance
            if (!raydium) {
                throw new Error("Raydium SDK is not initialized.");
            }
            const res = await raydium.cpmm.getRpcPoolInfos([pool]);
            const poolInfo = res[pool];

            return poolInfo;
        },
            enabled: !!fetchPoolListByMint,
    });
    */

    return {
        fetchPoolListByMint,
    };
}
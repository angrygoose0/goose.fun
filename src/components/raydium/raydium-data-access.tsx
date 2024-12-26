import {
    Raydium,
    TxVersion,
    getCpmmPdaAmmConfigId,
    parseTokenAccountResp,
    CREATE_CPMM_POOL_PROGRAM,
    CREATE_CPMM_POOL_FEE_ACC,
    DEVNET_PROGRAM_ID,
    PoolFetchType,
    CurveCalculator,
    ApiV3PoolInfoStandardItemCpmm,
    CpmmKeys,
    CpmmRpcData
} from '@raydium-io/raydium-sdk-v2';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, NATIVE_MINT } from '@solana/spl-token';
import bs58 from 'bs58';
import { useCluster } from '../cluster/cluster-data-access';
import { useConnection } from '@solana/wallet-adapter-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Cluster, clusterApiUrl, Keypair, PublicKey, SendTransactionError } from '@solana/web3.js';
import BN from 'bn.js';
import toast from 'react-hot-toast';
import { useTransactionToast } from '../ui/ui-layout';
import { INITIAL_SOL_AMOUNT, TOKEN_SUPPLY_BEFORE_BONDING } from '../meme/meme-helper-functions'
import { getMemeProgramId } from 'anchor/src/meme-exports';
import { useMemo } from 'react';

const TREASURY_PRIVATE_KEY =
    "5rhVcMHjqcjHLhdwajDnHW6PeWFheR29wMg1vrCAs6GSgihy3giwwFxW1CCSSskKbNvUKUJ7otF144oH4f8RAuSs";
// Extract owner from the secret key
export const owner: Keypair = Keypair.fromSecretKey(bs58.decode(TREASURY_PRIVATE_KEY));
const cluster = 'devnet';

let raydium: Raydium | undefined;
export function useInitRaydiumSdk({ loadToken }: { loadToken: boolean }) {
    //const { cluster } = useCluster();
    const { connection } = useConnection();


    // Initialize the Raydium SDK
    const initRaydiumSdk = useQuery({
        queryKey: ['initRaydiumSdk'],
        queryFn: async () => {
            if (raydium) {
                return true;
            }
            try {
                raydium = await Raydium.load({
                    owner,
                    connection,
                    cluster,
                    disableFeatureCheck: true,
                    disableLoadToken: !loadToken,
                    blockhashCommitment: 'finalized',
                });
                console.log('Raydium SDK initialized successfully');
                return true; // Indicate successful initialization
            } catch (error) {
                console.error('Error initializing Raydium SDK:', error);
                throw error; // Let react-query handle the error state
            }
        },
    });

    return {
        initRaydiumSdk,
    };
}

const SOL_MINT = 'So11111111111111111111111111111111111111112'

export function useCreatePool() {
    const transactionToast = useTransactionToast();
    const { connection } = useConnection();
    const { cluster } = useCluster();
    const programId = useMemo(() => getMemeProgramId(cluster.network as Cluster), [cluster]);
    const createPool = useMutation<
        { txId: string; poolId: string | undefined }, // Updated return type
        Error,
        { mint: PublicKey }
    >({
        mutationKey: ['createPool'],
        mutationFn: async ({ mint }) => {
            try {
                console.log('1');
                const feeConfigs = await raydium.api.getCpmmConfigs();

                console.log('2');

                // If devnet
                feeConfigs.forEach((config) => {
                    config.id = getCpmmPdaAmmConfigId(
                        DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
                        config.index
                    ).publicKey.toBase58();
                });

                // Create the pool
                const { execute, extInfo } = await raydium.cpmm.createPool({
                    programId: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
                    poolFeeAccount: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC,
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
                const createdPoolId = extInfo.address?.poolId?.toString();
                console.log('Pool created with ID:', createdPoolId);

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

                // Return both txId and poolId
                return { txId, poolId: createdPoolId };
            } catch (error) {
                console.error('Error creating pool:', error);
                throw error; // Ensure the error propagates to `onError`
            }
        },
        onSuccess: ({ txId, poolId }) => {
            transactionToast(txId);
            console.log('Transaction Signature:', txId);
            console.log('Pool ID:', poolId);
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

export function useFetchRpcPoolInfo({
    poolId,
}: {
    poolId: PublicKey,
}
) {
    const fetchRpcPoolInfo = useQuery({
        queryKey: ['fetchRpcPoolInfo'],
        queryFn: async () => {
            if (!raydium) {
                throw new Error("Raydium SDK is not initialized.");
            }
            const data = await raydium.cpmm.getPoolInfoFromRpc(poolId.toString());

            return data;
        },

    });

    return {
        fetchRpcPoolInfo,
    };
}

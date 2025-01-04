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
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Cluster, clusterApiUrl, Keypair, PublicKey, SendTransactionError } from '@solana/web3.js';
import BN from 'bn.js';
import toast from 'react-hot-toast';
import { useTransactionToast } from '../ui/ui-layout';
import { INITIAL_SOL_AMOUNT, TOKEN_SUPPLY_BEFORE_BONDING, SOL_MINT } from '../meme/meme-helper-functions'
import { getMemeProgramId } from 'anchor/src/meme-exports';
import { useMemo } from 'react';

const cluster = 'devnet';

const TREASURY_PRIVATE_KEY = process.env.NEXT_PUBLIC_TREASURY_PRIVATE_KEY || "";
const treasuryKeypair = Keypair.fromSecretKey(bs58.decode(TREASURY_PRIVATE_KEY));

let raydium: Raydium | undefined;
export function useInitRaydiumSdk({ loadToken }: { loadToken: boolean }) {
    //const { cluster } = useCluster();
    const { connection } = useConnection();
    const {publicKey, signAllTransactions} = useWallet();


    // Initialize the Raydium SDK
    const initRaydiumSdk = useQuery({
        queryKey: ['initRaydiumSdk'],
        queryFn: async () => {
            if (raydium) {
                return true;
            }
            if (!publicKey) {
                throw new Error('Wallet not connected');
            }
            try {
                raydium = await Raydium.load({
                    owner:publicKey,
                    //owner: treasuryKeypair,
                    connection,
                    cluster,
                    disableFeatureCheck: true,
                    disableLoadToken: !loadToken,
                    blockhashCommitment: 'finalized',
                    signAllTransactions,
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
                if (!raydium) {
                    throw new Error('Raydium SDK not initialized');
                }
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


export function useRaydiumPoolQuery({
    poolId,
}: {
    poolId: PublicKey,
}
) {
    const transactionToast = useTransactionToast();

    const raydiumPoolQuery = useQuery({
        queryKey: ['raydiumPoolQuery', poolId],
        queryFn: async () => {
            if (!raydium) {
                throw new Error("Raydium SDK is not initialized.");
            }
            const data = await raydium.cpmm.getPoolInfoFromRpc(poolId.toString());

            return data;
        },

    });

    const raydiumSwap = useMutation<
        string,
        Error,
        { inputMint: PublicKey; inputAmount: BN, }
    >({
        mutationKey: ['swapIn'],
        mutationFn: async ({ inputMint, inputAmount }) => {
            if (!raydium) {
                throw new Error('Raydium SDK not initialized');
            }

            try {
                let poolInfo: ApiV3PoolInfoStandardItemCpmm;
                let poolKeys: CpmmKeys;
                let rpcData: CpmmRpcData

                const poolData = await raydium.cpmm.getPoolInfoFromRpc(poolId.toString());
                poolInfo = poolData.poolInfo;
                poolKeys = poolData.poolKeys;
                rpcData = poolData.rpcData;

                console.log('Pool Info:', poolInfo);

                if (
                    inputMint.toString() !== poolInfo.mintA.address &&
                    inputMint.toString() !== poolInfo.mintB.address
                ) {
                    throw new Error('Input mint does not match pool');
                }

                const baseIn = inputMint.toString() === poolInfo.mintA.address;

                // Perform swap calculation
                const swapResult = CurveCalculator.swap(
                    inputAmount,
                    baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
                    baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
                    rpcData.configInfo!.tradeFeeRate
                );

                const { execute } = await raydium.cpmm.swap({
                    poolInfo,
                    poolKeys,
                    inputAmount,
                    swapResult,
                    slippage: 0.001, // 0.1%
                    baseIn,
                });

                // Execute the swap and confirm the transaction
                const { txId } = await execute({ sendAndConfirm: true });
                console.log(`Swapped: ${poolInfo.mintA.symbol} to ${poolInfo.mintB.symbol}`, {
                    txId: `https://explorer.solana.com/tx/${txId}`,
                });

                return txId; // Return txId as string
            } catch (error) {
                console.error('Error creating pool:', error);
                throw error;
            }
        },
        onSuccess: (txId) => {
            transactionToast(txId); // Handle txId as string
            console.log(txId);
        },
        onError: (error) => {
            toast.error(`Error performing swap: ${error.message}`);
            console.error('Swap error:', error);
        },
    });

    return {
        raydiumPoolQuery,
        raydiumSwap,
    }
};

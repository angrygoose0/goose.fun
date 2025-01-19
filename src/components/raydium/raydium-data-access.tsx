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
import {SOL_GOAL_BEFORE_BONDING, SOL_MINT, SUPPLY_SOLD_BEFORE_BONDING } from '../meme/meme-helper-functions'
import { getMemeProgramId } from 'anchor/src/meme-exports';
import { useMemo } from 'react';

const cluster = 'devnet';

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

import { Raydium, TxVersion, parseTokenAccountResp } from '@raydium-io/raydium-sdk-v2'
import { Keypair, clusterApiUrl } from '@solana/web3.js'
import bs58 from 'bs58'
import { useConnection } from '@solana/wallet-adapter-react';
import { useCluster } from '../cluster/cluster-data-access';

export const owner: Keypair = Keypair.fromSecretKey(bs58.decode('<YOUR_WALLET_SECRET_KEY>'))
const { connection } = useConnection()
const { cluster } = useCluster();
// export const connection = new Connect;ion(clusterApiUrl('devnet')) //<YOUR_RPC_URL>
export const txVersion = TxVersion.V0 // or TxVersion.LEGACY


let raydium: Raydium | undefined
export const initSdk = async (params?: { loadToken?: boolean }) => {
    if (raydium) return raydium
    if (connection.rpcEndpoint === clusterApiUrl('mainnet-beta'))
        console.warn('using free rpc node might cause unexpected error, strongly suggest uses paid rpc node')
    console.log(`connect to rpc ${connection.rpcEndpoint} in ${cluster}`)
    raydium = await Raydium.load({
        owner,
        connection,
        cluster,
        disableFeatureCheck: true,
        disableLoadToken: !params?.loadToken,
        blockhashCommitment: 'finalized',
        // urlConfigs: {
        //   BASE_HOST: '<API_HOST>', // api url configs, currently api doesn't support devnet
        // },
    })

    /**
     * By default: sdk will automatically fetch token account data when need it or any sol balace changed.
     * if you want to handle token account by yourself, set token account data after init sdk
     * code below shows how to do it.
     * note: after call raydium.account.updateTokenAccount, raydium will not automatically fetch token account
     */

    /*  
    raydium.account.updateTokenAccount(await fetchTokenAccountData())
    connection.onAccountChange(owner.publicKey, async () => {
        raydium!.account.updateTokenAccount(await fetchTokenAccountData())
    })
    */

    return raydium
}

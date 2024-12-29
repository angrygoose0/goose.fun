// Here we export some useful types and functions for interacting with the Anchor program.
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { Cluster, PublicKey } from '@solana/web3.js'
import MemeIDL from '../target/idl/meme.json'
import type { Meme } from '../target/types/meme'

// Re-export the generated IDL and type
export { Meme, MemeIDL }

// The programId is imported from the program IDL.
export const MEME_PROGRAM_ID = new PublicKey(MemeIDL.address)

// This is a helper function to get the Counter Anchor program.
export function getMemeProgram(provider: AnchorProvider) {
  return new Program(MemeIDL as Meme, provider)
}

// This is a helper function to get the program ID for the Meme program depending on the cluster.
export function getMemeProgramId(cluster: Cluster) {
  switch (cluster) {
    case 'devnet':
    case 'testnet':
      // This is the program ID for the Meme program on devnet and testnet.
      return new PublicKey('6uhUTWZRFWtf7WhKLmni9x1K3hiwxDaFP8WnpsZuVDw8')
    case 'mainnet-beta':
    default:
      return MEME_PROGRAM_ID
  }
}

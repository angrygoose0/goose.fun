'use client'

import { Connection } from '@solana/web3.js'
import { atom, useAtomValue } from 'jotai'
import { createContext, ReactNode, useContext } from 'react'

export interface Cluster {
  name: string
  endpoint: string
  network: ClusterNetwork
}

export enum ClusterNetwork {
  Mainnet = 'mainnet-beta',
}

export const defaultCluster: Cluster = {
  name: 'mainnet',
  endpoint: `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`, // Replace with your mainnet endpoint if different
  network: ClusterNetwork.Mainnet,
}

// Atom for managing the active cluster (fixed to Mainnet)
const clusterAtom = atom<Cluster>(defaultCluster)

// Context for providing cluster information
export interface ClusterProviderContext {
  cluster: Cluster
  getExplorerUrl(path: string): string
}

const Context = createContext<ClusterProviderContext>({} as ClusterProviderContext)

export function ClusterProvider({ children }: { children: ReactNode }) {
  const cluster = useAtomValue(clusterAtom)

  const value: ClusterProviderContext = {
    cluster,
    getExplorerUrl: (path: string) => `https://explorer.solana.com/${path}`,
  }

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useCluster() {
  return useContext(Context)
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as React from 'react'
import { ReactNode, Suspense, useEffect, useRef } from 'react'
import toast, { Toaster } from 'react-hot-toast'

import { AccountChecker } from '../account/account-ui'
import { ClusterChecker, ClusterUiSelect, ExplorerLink } from '../cluster/cluster-ui'
import { WalletButton } from '../solana/solana-provider'
import { TokenCard } from '../meme/meme-ui'


export function UiLayout({ children }: { children: ReactNode }) {

  return (
    <div className="h-full flex">
      {/* Sidebar (Vertical Navbar) */}
      <div
        className="navbar bg-white text-black border-2 items-start border-black flex flex-col space-y-4 p-4"
        style={{ width: '256px', minHeight: '100vh', position: 'fixed' }}
      >
        <div className="flex-none">
          <Link className="btn btn-ghost normal-case text-xl" href="/">
            <img className="h-6" alt="Logo" src="/logo.png" />
          </Link>
        </div>


        <p className="text-sm font-medium text-gray-700">Creation Time</p>
        <div className="flex space-x-4">
          <input
            type="number"
            className="w-1/2 border-2 border-gray-300 p-2 text-xs focus:outline-none focus:border-black"
            placeholder="Min"
          />
          <input
            type="number"
            className="w-1/2 border-2 border-gray-300 p-2 text-xs focus:outline-none focus:border-black"
            placeholder="Max"
          />
        </div>
        <p className="text-sm font-medium text-gray-700">Volume</p>
        <div className="flex space-x-4">
          <input
            type="number"
            className="w-1/2 border-2 border-gray-300 p-2 text-xs focus:outline-none focus:border-black"
            placeholder="Min"
          />
          <input
            type="number"
            className="w-1/2 border-2 border-gray-300 p-2 text-xs focus:outline-none focus:border-black"
            placeholder="Max"
          />
        </div>
        <p className="text-sm font-medium text-gray-700">Featured</p>
        <div className="flex space-x-4">
          <input
            type="number"
            className="w-1/2 border-2 border-gray-300 p-2 text-xs focus:outline-none focus:border-black"
            placeholder="Min"
          />
          <input
            type="number"
            className="w-1/2 border-2 border-gray-300 p-2 text-xs focus:outline-none focus:border-black"
            placeholder="Max"
          />
        </div>

        <div className="flex w-full py-4">
          <button className="w-1/2 p-2 border-2 border-black text-sm font-medium text-black hover:bg-gray-200">
            Apply
          </button>
          <button className="w-1/2 p-2 border-2 border-grey-500 text-sm font-medium text-black hover:bg-gray-200">
            Reset
          </button>
        </div>









      </div>

      {/* Floating Buttons */}
      <div className="fixed top-4 right-4 flex space-x-4 z-50">

        <WalletButton />
        <ClusterUiSelect />
      </div>

      {/* Main Content */}
      <div className="flex flex-col flex-grow overflow-auto" style={{ marginLeft: '256px' }}>
        {/* Hero Section */}
        <div className="hero py-[64px]">
          <div className="hero-content text-center">
            <div className="max-w-2xl">
              <h1 className="text-5xl font-bold">Goose.fun</h1>
              <p className="py-6">subtitle</p>
              {/* Search Bar */}

              <input
                type="text"
                className="w-96 border-2 border-black p-2 text-l focus:outline-none"
                placeholder="Search"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6">
          <TokenCard name="goos" />
          <TokenCard name="duck" />
          <TokenCard name="goos" />
          <TokenCard name="duck" />
          <TokenCard name="goos" />
          <TokenCard name="duck" />
          <TokenCard name="goos" />
          <TokenCard name="duck" />
          <TokenCard name="goos" />
          <TokenCard name="duck" />
          <TokenCard name="goos" />
          <TokenCard name="duck" />
          <TokenCard name="goos" />
          <TokenCard name="duck" />
          <TokenCard name="goos" />
          <TokenCard name="duck" />
          <TokenCard name="goos" />
          <TokenCard name="duck" />

        </div>



        {/* Dynamic Content */}
        <ClusterChecker>
          <AccountChecker />
        </ClusterChecker>
        <div className="flex-grow mx-4 lg:mx-auto">
          <Suspense
            fallback={
              <div className="text-center my-32">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            }
          >
            {children}
          </Suspense>
          <Toaster position="bottom-right" />
        </div>

        {/* Footer */}
        <footer className="footer footer-center p-4 bg-base-300 text-base-content">
          <p className="inline">
            &copy; {new Date().getFullYear()} goose.fun |
            <a href="/privacy-policy" className="link link-hover"> Privacy Policy</a> |
            <a href="/terms-of-service" className="link link-hover"> Terms of Service</a>
          </p>
        </footer>
      </div>
    </div>


  )
}

export function AppModal({
  children,
  title,
  hide,
  show,
  submit,
  submitDisabled,
  submitLabel,
}: {
  children: ReactNode
  title: string
  hide: () => void
  show: boolean
  submit?: () => void
  submitDisabled?: boolean
  submitLabel?: string
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)

  useEffect(() => {
    if (!dialogRef.current) return
    if (show) {
      dialogRef.current.showModal()
    } else {
      dialogRef.current.close()
    }
  }, [show, dialogRef])

  return (
    <dialog className="modal" ref={dialogRef}>
      <div className="modal-box space-y-5">
        <h3 className="font-bold text-lg">{title}</h3>
        {children}
        <div className="modal-action">
          <div className="join space-x-2">
            {submit ? (
              <button className="btn btn-xs lg:btn-md btn-primary" onClick={submit} disabled={submitDisabled}>
                {submitLabel || 'Save'}
              </button>
            ) : null}
            <button onClick={hide} className="btn">
              Close
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}


export function ellipsify(str = '', len = 4) {
  if (str.length > 30) {
    return str.substring(0, len) + '..' + str.substring(str.length - len, str.length)
  }
  return str
}

export function useTransactionToast() {
  return (signature: string) => {
    toast.success(
      <div className={'text-center'}>
        <div className="text-lg">Transaction sent</div>
        <ExplorerLink path={`tx/${signature}`} label={'View Transaction'} className="btn btn-xs btn-primary" />
      </div>,
    )
  }
}

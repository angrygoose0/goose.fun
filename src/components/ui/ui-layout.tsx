'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as React from 'react'
import { ReactNode, Suspense, useEffect, useRef, useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'

import { AccountChecker } from '../account/account-ui'
import { ClusterChecker, ClusterUiSelect, ExplorerLink } from '../cluster/cluster-ui'
import { WalletButton } from '../solana/solana-provider'
//import { MemeCreate, MemeList, TokenCard } from '../meme/meme-ui'
import { PrimaryButton } from './extra-ui/button'
import {PreCard} from'../pre/pre-ui'
import { FaGlobe, FaTelegramPlane } from 'react-icons/fa'
import { FaXTwitter } from 'react-icons/fa6'


export function UiLayout({ children }: { children: ReactNode }) {

  return (
    <div className="h-full flex">

      <div className="fixed top-4 left-4 flex space-x-4 z-50">
        {/*<MemeCreate />*/}

      </div>
      {/* Floating Buttons */}
      <div className="fixed top-4 right-4 flex space-x-4 z-50">
        <WalletButton />
        <ClusterUiSelect />
      </div>

      {/* Main Content */}
      <div className="flex flex-col flex-grow overflow-auto" /*style={{ marginLeft: '256px' }} bc of navbar*/>
        {/* Hero Section */}
        <div className="hero mt-[64px]">
          <div className="hero-content text-center">
            <div className="max-w-2xl">
              <h1 className="text-5xl font-bold">Geese.fun</h1>
                <div className="flex justify-center items-center mt-2 space-x-2">
                              {/* Telegram Icon */}
                  <a
                      href="t.me/goosedotfun"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-5 h-5 text-gray-500 dark:text-white hover:text-purple-300"
                      onClick={(e) => e.stopPropagation()}
                  >
                      <FaTelegramPlane />
                  </a>
  
                  {/* Twitter (X) Icon */}
  
                  <a
                      href="https://x.com/goosedotfun"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-5 h-5 text-gray-500 dark:text-white hover:text-purple-300"
                      onClick={(e) => e.stopPropagation()}
                  >
                      <FaXTwitter />
                  </a>
  
                  <a
                      href="geese.fun"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-5 h-5 text-gray-500 dark:text-white hover:text-purple-300"
                      onClick={(e) => e.stopPropagation()}
                  >
                      <FaGlobe />
                  </a>
                </div>
              <p className="py-6">phase 1: send to 1B.</p>
            </div>
          </div>
          
        </div>
        
        {/*<MemeList /> */}

        
        <PreCard/>




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
        <footer className="footer footer-center border-t-2 border-black dark:border-white p-4 text-gray-500 dark:text-white">
          <p className="inline-flex items-center space-x-2">
            <a>&copy; {new Date().getFullYear()} goose.fun</a>|<PrivacyPolicy/>|<TermsOfService/>
          </p>
        </footer>
      </div>

    </div>

  );
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

export function PrivacyPolicy() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <>
      <a onClick={openModal} className="link link-hover">privacy policy</a>
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-10"
          onClick={closeModal}
        >
          <div
            className="relative dualbox  p-6 z-15"
            onClick={(e) => e.stopPropagation()}
          >
           <p>privacy policy</p>
          </div>
        </div >
      )}
    </>
  );
}
export function TermsOfService() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <>
      <a onClick={openModal} className="link link-hover">terms of service</a>
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-10"
          onClick={closeModal}
        >
          <div
            className="relative dualbox  p-6 z-15"
            onClick={(e) => e.stopPropagation()}
          >
           <p>terms of service</p>
          </div>
        </div >
      )}
    </>
  );
}

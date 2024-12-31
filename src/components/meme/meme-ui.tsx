'use client'

import { ChangeEvent, useCallback, useMemo, useState, useEffect, use } from 'react'
import { useMemeProgram, useMetadataQuery, useBuySellTokenMutation, useUserAccountQuery, useCreateMemeToken, useProcessedAccountsQuery, useUserAccountsByMintQuery, useBondToRaydium, useMemeAccountQuery, useSolPriceQuery, useTransactionsQuery, useLockClaimTokenMutation } from './meme-data-access'
import { useGetBalance, useGetTokenAccounts } from '../account/account-data-access';
import { toLamports, fromLamports, calculatePercentage, simplifyBN, fromLamportsDecimals, ToLamportsDecimals, ZERO, EMPTY_PUBLIC_KEY, BILLION, SOL_MINT, INITIAL_PRICE } from './meme-helper-functions';
import axios from "axios";
import toast from "react-hot-toast";
import { useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { FaTelegramPlane, FaTwitter, FaGlobe, } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { BN } from '@coral-xyz/anchor';
import { WalletButton } from '../solana/solana-provider'
import { useCreatePool, useRaydiumPoolQuery, useInitRaydiumSdk } from '../raydium/raydium-data-access'
import { ApiV3PoolInfoStandardItemCpmm, CpmmKeys, CpmmRpcData } from '@raydium-io/raydium-sdk-v2';
import { time } from 'console';

import {PrimaryBar, PrimaryButton, PrimaryInput, PrimarySelect} from '../ui/extra-ui/button'

export function MemeCreate() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const [token, setToken] = useState<{
    name: string;
    symbol: string;
    image: string | null; // Allow null
    description: string;
    twitter_link: string;
    telegram_link: string;
    website_link: string;
  }>({
    name: "",
    symbol: "",
    image: null, // Default to null
    description: "",
    twitter_link: "",
    telegram_link: "",
    website_link: "",
  });

  const [loading, setLoading] = useState(false);

  const { createMemeToken } = useCreateMemeToken();

  const { publicKey } = useWallet();

  const isFormValid = Object.values(token).every(
    (field) => field !== null && field.trim() !== ""
  );

  //IMAGE UPLOAD IPFS
  const handleImageChange: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const fileList = event.target.files; // FileList | null
    if (fileList && fileList.length > 0) { // Ensure it’s not null and has files
      const file = fileList[0];
      try {
        const imgUrl = await uploadImagePinata(file);
        if (imgUrl) {
          setToken({ ...token, image: imgUrl });
        } else {
          toast.error("Failed to upload image");
        }
      } catch (error) {
        console.error("Error uploading image:", error);
      }
    }
  };

  const uploadImagePinata = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await axios({
        method: "post",
        url: "https://api.pinata.cloud/pinning/pinFileToIPFS",
        data: formData,
        headers: {
          pinata_api_key: "c8919bd933af805cbad6",
          pinata_secret_api_key: "3737c94c30b81183f3046e68e7b55fba955a579be50562b1e5e9baae680aa44b",
          "Content-Type": "multipart/form-data",
        },
      });

      return `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
    } catch (error) {
      console.error("Image upload failed:", error);
      toast.error("Failed to upload image");
      return null; // Explicitly return null
    }
  };


  //METADATA
  const uploadMetadata = async (token: any) => {
    const data = JSON.stringify({
      name: token.name,
      symbol: token.symbol,
      description: token.description,
      image: token.image,
      twitter_link: token.twitter_link,
      telegram_link: token.telegram_link,
      website_link: token.website_link,
    });

    try {
      const response = await axios({
        method: "POST",
        url: "https://api.pinata.cloud/pinning/pinJSONToIPFS",
        data: data,
        headers: {
          pinata_api_key: "c8919bd933af805cbad6",
          pinata_secret_api_key: "3737c94c30b81183f3046e68e7b55fba955a579be50562b1e5e9baae680aa44b",
          "Content-Type": "application/json",
        }
      });

      const url = `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
      return url;

    } catch (error) {
      toast.error("Failed to upload metadata");
      console.error(error);
    }
  };

  const handleFormFieldChange = (fieldName: string, e: ChangeEvent<HTMLInputElement>) => {
    setToken({ ...token, [fieldName]: e.target.value });
  };

  const handleFormSubmit = useCallback(
    async () => {
      setLoading(true); // Set loading state to true at the start

      try {
        if (!isFormValid) {
          throw new Error("Form not valid");
        }
        if (!publicKey) {
          throw new Error("Wallet is not connected.");
        }

        // Upload metadata and check if the URL is valid
        const metadataUrl = await uploadMetadata(token);
        if (!metadataUrl) {
          throw new Error("Failed to upload metadata.");
        }

        // Prepare metadata object
        const metadata = {
          name: token.name,
          symbol: token.symbol,
          uri: metadataUrl,
          decimals: 9,
        };

        // Await the mutation to ensure the process completes before showing success toast
        await createMemeToken.mutateAsync({ metadata });

        // Show success message
        toast.success("Meme token created successfully!");
        closeModal();
      } catch (error: any) {
        // Log error and show error message
        console.error("Error creating meme token:", error);
        toast.error("Failed to create meme token.");
      } finally {
        // Reset loading state
        setLoading(false);
      }
    },
    [token, createMemeToken, isFormValid] // Ensure dependencies are included in the dependency array
  );

  return (
    <div>
      <PrimaryButton name='createModal' disabled={false} active={false} onClick={openModal} extraCss="" value="Create"/>

      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-10"
          onClick={closeModal}
        >
          <div
            className="relative dualbox  p-6 z-15"
            onClick={(e) => e.stopPropagation()}
          >
            {token.image ? (
              <img
                src={token.image}
                alt="token"
                className="w-20 h-20 object-cover"
              />
            ) : (
              <label htmlFor="file" className="custom-file-upload">
                <span>image</span>
                <input type="file" id="file" onChange={handleImageChange} />
              </label>
            )}

            <PrimaryInput name="name" onChange={(e) => handleFormFieldChange("name", e)} value={token.name} placeholder="name" type="text" extraCss="w-full block mt-4" disabled={false}/>
            <PrimaryInput name="symbol" onChange={(e) => handleFormFieldChange("symbol", e)} value={token.symbol} placeholder="symbol" type="text" extraCss="w-full block mt-4" disabled={false}/>
            <PrimaryInput name="description" onChange={(e) => handleFormFieldChange("description", e)} value={token.description} placeholder="description" type="text" extraCss="w-full block mt-4" disabled={false}/>
            <PrimaryInput name="twitter_link" onChange={(e) => handleFormFieldChange("twitter_link", e)} value={token.twitter_link} placeholder="twitter link" type="text" extraCss="w-full block mt-4" disabled={false}/>
            <PrimaryInput name="telegram_link" onChange={(e) => handleFormFieldChange("telegram_link", e)} value={token.telegram_link} placeholder="telegram link" type="text" extraCss="w-full block mt-4" disabled={false}/>
            <PrimaryInput name="website_link" onChange={(e) => handleFormFieldChange("website_link", e)} value={token.website_link} placeholder="website link" type="text" extraCss="w-full block mt-4" disabled={false}/>

            <PrimaryButton name='create_token' disabled={!isFormValid} active={false} onClick={handleFormSubmit} extraCss="mt-4" value="Create Token"/>
          </div>
        </div >
      )}
    </div>
  );
}

export function MemeList() {
  const [currentPage, setCurrentPage] = useState(1);

  const [sortBy, setSortBy] = useState("creation_time");
  const [searchBy, setSearchBy] = useState("");

  const { processedAccountsQuery } = useProcessedAccountsQuery({ currentPage, sortBy, searchBy });

  const { initRaydiumSdk } = useInitRaydiumSdk({ loadToken: true });

  // Handle loading and error states with a message, but keep the pagination controls visible
  let content;

  if (processedAccountsQuery.isLoading || initRaydiumSdk.isLoading) {
    content = (
      <div>
        <span className="loading loading-spinner"></span>
        <p>Loading...</p>
      </div>
    );
  } else if (processedAccountsQuery.error || initRaydiumSdk.isError) {
    content = (
      <div>
        <p>{processedAccountsQuery.error?.message || "No error with accounts"}</p>
        <p>{initRaydiumSdk.error?.message || "No error with raydium"}</p>
      </div>
    );
  } else if (!initRaydiumSdk || !processedAccountsQuery || (processedAccountsQuery.data ?? []).length == 0) {
    content = <p>No accounts found.</p>;
  } else {
    content = (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6">
        {processedAccountsQuery.data?.map((accountKey, index) => (
          accountKey != null ? (
            <TokenCard key={index} accountKey={accountKey} />
          ) : null
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Search Bar with Filters Button */}
      <div className="flex items-center justify-center space-x-2">
        <PrimaryInput name="SearchBar" onChange={(e) => setSearchBy(e.target.value)} value={searchBy} placeholder="Search by mint" type="text" extraCss="w-96" disabled={false}/>
        <PrimarySelect 
          name="sortBy" 
          disabled={false} 
          options={[
            {label:"Creation Time", value:"creation_time"},
            {label:"Locked Amount", value:"locked_amount"},
            {label:"Invested Amount", value:"invested_amount"},
            {label:"Bonded Time", value:"bonded_time"},
          ]} 
          onChange={(e) => setSortBy(e.target.value)} 
          extraCss="" 
          value={sortBy}
        />
      </div>
      <div className="space-y-6">
        {content}
      </div>

      {/* Pagination controls */}
      <div className="flex justify-center py-4 space-x-4">
        <PrimaryButton name='prev' disabled={currentPage === 1} active={false} onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} extraCss="btn-xs" value="Previous"/>
        <span>Page {currentPage}</span>
        <PrimaryButton name='next' disabled={!processedAccountsQuery || (processedAccountsQuery.data ?? []).length < 10} active={false} onClick={() => setCurrentPage((prev) => prev + 1)} extraCss="btn-xs" value="Next"/>
      </div>
    </div >
  );
}




// Define an enum for action types
export enum ActionType {
  Buy = "Buy",
  Sell = "Sell",
  RaydiumBuy = "RaydiumBuy",
  RaydiumSell = "RaydiumSell",
  Lock = "Lock",
  Claim = "Claim"
}




export function BalanceCard({ publicKey, memeAccount, memeMetadata, userAccount, tokenDistribution, userTokenBalance, raydiumSwap, tokensToSol, solToTokens, solToUsd, tokensToUsd }: { publicKey: PublicKey, memeAccount: any, memeMetadata: any, userAccount: any, tokenDistribution: any, userTokenBalance:BN, raydiumSwap:any, tokensToSol:any, solToTokens:any, solToUsd:any, tokensToUsd:any }) {
  const { buySellToken } = useBuySellTokenMutation();
  const {lockClaimToken} = useLockClaimTokenMutation();

  const [solBalance, setSolBalance] = useState(ZERO);

  const balanceQuery = useGetBalance({ address: publicKey })
  

  useEffect(() => {
    if (balanceQuery.data) {
      setSolBalance(new BN(balanceQuery.data));
    }
  }, [balanceQuery.data]);


  useEffect(() => {
    if (memeAccount.bondedTime.lt(new BN(0))) {
      handleActionChange(ActionType.Buy);
    } else {
      handleActionChange(ActionType.RaydiumBuy);
    }
  }, [memeAccount.bondedTime]);

  const [selectedAction, setSelectedAction] = useState<ActionType>(ActionType.Buy);

  const handleActionChange = (action: ActionType) => {
    setSelectedAction(action);
    console.log(action);
    setAmount(ZERO);
  };

  const [amount, setAmount] = useState(ZERO);
  const [showingSol, setShowingSol] = useState(true); // true for showing SOL, false for showing token
  const toggleSolOrToken = () => {
    setShowingSol((prevMode) => {
      const newMode = !prevMode;
      const convertedAmount = newMode
        ? tokensToSol(amount) // Convert Tokens to SOL
        : solToTokens(amount); // Convert SOL to Tokens
      setAmountWithLimits(convertedAmount, newMode); // Use limits to ensure the value is valid
      return newMode; // Toggle the mode
    });
  };


  const setAmountWithLimits = (numericValue: BN, showingSolOverride?: boolean) => {
    const useShowingSol = showingSolOverride !== undefined ? showingSolOverride : showingSol;

    if (numericValue < ZERO) {
      setAmount(ZERO);
      return;
    }

    if (selectedAction === ActionType.Buy || selectedAction === ActionType.RaydiumBuy) {
      if (useShowingSol) {
        setAmount(numericValue.cmp(solBalance) === -1 ? numericValue : solBalance);
      } else {
        setAmount(numericValue.cmp(solToTokens(solBalance)) === -1 ? numericValue : solToTokens(solBalance));
      }
    } else if (selectedAction === ActionType.Sell) {
      if (useShowingSol) {
        setAmount(numericValue.cmp(tokensToSol(userAccount.lockedAmount)) === -1 ? numericValue : tokensToSol(userAccount.lockedAmount));
      } else {
        setAmount(numericValue.cmp(userAccount.lockedAmount) === -1 ? numericValue : userAccount.lockedAmount);
      }
    } else if (selectedAction === ActionType.RaydiumSell) {
      if (useShowingSol) {
        setAmount(numericValue.cmp(tokensToSol(userTokenBalance)) === -1 ? numericValue : tokensToSol(userTokenBalance));
      } else {
        setAmount(numericValue.cmp(userTokenBalance) === -1 ? numericValue : userTokenBalance);
      }

    } else if (selectedAction === ActionType.Lock){
      if (useShowingSol) {
        setAmount(numericValue.cmp(tokensToSol(userAccount.claimmable.add(userTokenBalance))) === -1 ? numericValue : tokensToSol(userAccount.claimmable.add(userTokenBalance)));
      } else {
        setAmount(numericValue.cmp(userAccount.claimmable.add(userTokenBalance)) === -1 ? numericValue : userAccount.claimmable.add(userTokenBalance));
      }

    } else if (selectedAction === ActionType.Claim) {
      if (useShowingSol) {
        setAmount(numericValue.cmp(tokensToSol(userAccount.claimmable)) === -1 ? numericValue : tokensToSol(userAccount.claimmable));
      } else {
        setAmount(numericValue.cmp(userAccount.claimmable) === -1 ? numericValue : userAccount.claimmable);
      }
    } else {
      setAmount(numericValue);
    }
  };
  

  const handleFormFieldChange = (event: { target: { value: any; }; }) => {
    const value = event.target.value;

    if (value === "") {
      setAmount(ZERO); // You might want to keep ZERO or a null state
      return;
    }
    setAmountWithLimits(ToLamportsDecimals(value));
  };


  const handleBuySellFormSubmit = useCallback(async () => {
    try {
      let amountSentToSolana: BN; //sol lamports

      // Validate amount based on selected action
      if (selectedAction === ActionType.Buy) {

        const solRequiredBN = showingSol ? amount : tokensToSol(amount);

        if (solRequiredBN.gte(solBalance)) {
          console.log('required', solRequiredBN.toString());
          console.log('balance', solBalance.toString());
          throw new Error("SOL balance too low1.");
        }

        amountSentToSolana = solRequiredBN;
      } else if (selectedAction === ActionType.Sell) {
        const tokensRequiredBN = showingSol ? solToTokens(amount) : amount;

        if (tokensRequiredBN.gte(userAccount.lockedAmount)) {
          throw new Error("You can't claim more than you invested.");
        }

        amountSentToSolana = showingSol ? amount.neg() : tokensToSol(amount).neg();
      }
      else {
        throw new Error("wrong action type");
      }

      // Perform the buy/sell operation
      await buySellToken.mutateAsync({ amount: amountSentToSolana, mint: memeAccount.mint });
      toast.success("Success!");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "An error occurred.");
    }
  }, [amount, showingSol, selectedAction, solBalance, memeAccount.mint, buySellToken]);

  const handleLockClaimFormSubmit = useCallback(async () => {
    try {
      let amountSentToSolana: BN; //token lamports

      // Validate amount based on selected action
      if (selectedAction === ActionType.Lock) {
        const tokensRequiredBN = showingSol ? solToTokens(amount) : amount;

        if (tokensRequiredBN.gte(userTokenBalance.add(userAccount.claimmable))) {
          throw new Error("Token balance too low.");
        }

        amountSentToSolana = tokensRequiredBN;
      } else if (selectedAction === ActionType.Claim) {
        const tokensRequiredBN = showingSol ? solToTokens(amount) : amount;

        if (tokensRequiredBN.gte(userAccount.claimmable)) {
          throw new Error("You can't claim more than you can claim.");
        }

        amountSentToSolana = tokensRequiredBN.neg()
      }
      else {
        throw new Error("wrong action type");
      }

      // Perform the lock/claim operation
      await lockClaimToken.mutateAsync({ amount: amountSentToSolana, mint: memeAccount.mint });
      toast.success("Success!");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "An error occurred.");
    }
  }, [amount, showingSol, selectedAction, userTokenBalance, userAccount.claimmable, memeAccount.mint, lockClaimToken]);
  
  
  const handleRaydiumBuySellFormSubmit = useCallback(async () => {
    try {
          let amountSentToSolana: BN; //sol lamports

        // Validate amount based on selected action
        if (selectedAction === ActionType.RaydiumBuy) {

        const solRequiredBN = showingSol ? amount : tokensToSol(amount);

        if (solRequiredBN.gte(solBalance)) {
          throw new Error("SOL balance too low.");
        }

        amountSentToSolana = solRequiredBN;
      } else if (selectedAction === ActionType.RaydiumSell) {
        const tokensRequiredBN = showingSol ? solToTokens(amount) : amount;

        if (tokensRequiredBN.gte(userTokenBalance)) {
          throw new Error("You can't sell more than you have");
        }

        amountSentToSolana = showingSol ? amount.neg() : tokensToSol(amount).neg();
      }
        else {
        throw new Error("wrong action type");
      }

        // Perform the buy/sell operation
        await raydiumSwap.mutateAsync({inputMint:SOL_MINT, inputAmount: amountSentToSolana,});
        toast.success("Success!");
    } catch (error: any) {
          console.error(error);
        toast.error(error.message || "An error occurred.");
    }
  }, [publicKey, amount, showingSol, selectedAction, solBalance, userTokenBalance, raydiumSwap]);


  return (
    <div
      key="right-top"
      className="dualbox p-6  flex flex-col"
      style={{
        gridRow: "1 / 2",
        gridColumn: "3 / 4",
      }}
    >
      <div className="flex mb-4">
        {memeAccount.bondedTime < ZERO ? (
          <>
            {/* Two buttons: Buy and Sell */}
            <PrimaryButton name="selectBuy" disabled={false} active={selectedAction === ActionType.Buy} onClick={() => handleActionChange(ActionType.Buy)} extraCss="w-1/2" value="Buy"/>
            <PrimaryButton name="selectSell" disabled={false} active={selectedAction === ActionType.Sell} onClick={() => handleActionChange(ActionType.Sell)} extraCss="w-1/2" value="Sell"/>
          </>
        ) : (
          <>
            {/* Four buttons: Buy, Sell, Lock, and Claim */}
            <PrimaryButton name="selectRaydiumBuy" disabled={false} active={selectedAction === ActionType.RaydiumBuy} onClick={() => handleActionChange(ActionType.RaydiumBuy)} extraCss="w-1/4" value="Buy"/>
            <PrimaryButton name="selectRaydiumSell" disabled={false} active={selectedAction === ActionType.RaydiumSell} onClick={() => handleActionChange(ActionType.RaydiumSell)} extraCss="w-1/4" value="Sell"/> 
            <PrimaryButton name="selectLock" disabled={false} active={selectedAction === ActionType.Lock} onClick={() => handleActionChange(ActionType.Lock)} extraCss="w-1/4" value="Lock"/> 
            <PrimaryButton name="selectClaim" disabled={false} active={selectedAction === ActionType.Claim} onClick={() => handleActionChange(ActionType.Claim)} extraCss="w-1/4" value="Claim"/>
          </>
        )}
      </div>


      <div className="mb-4">
        <div className="flex items-baseline space-x-2">
          <div className="text-sm font-semibold">{fromLamportsDecimals(solBalance)} SOL</div>
          <div className="text-sm text-gray-500 dark:text-white">~ ${solToUsd(solBalance)}</div>
        </div>

        <PrimaryBar
          extraCss="mt-1"
          values={[
            {label:"", percentage:100, value:"", color:"bg-black dark:bg-white"},
          ]}
          labels={false}
        />
      </div>

      <div className="flex flex-col space-y-2 mt-2">
        {memeAccount.bondedTime < ZERO ? (
          <>
            {/* When bondedTime is negative so hasnt bonded */}
            <div className="flex items-baseline space-x-2">
              <div className="text-sm font-semibold">
                {simplifyBN(fromLamports(userAccount.lockedAmount))} {memeMetadata.symbol}
              </div>
              <div className="text-sm text-gray-500 dark:text-white">~ ${tokensToUsd(userAccount.lockedAmount)}</div>
            </div>

            <PrimaryBar
              extraCss=""
              values={[
                {label:"Invested", percentage:100, value:simplifyBN(fromLamports(userAccount.lockedAmount)), color:"bg-purple-300"},
              ]}
              labels={true}
            />
          </>
        ) : (
          <>
            {/* When bondedTime is positive */}
            <div className="flex items-baseline space-x-2">
              <div className="text-sm font-semibold">
                {simplifyBN(fromLamports(tokenDistribution.totalTokens))} {memeMetadata.symbol}
              </div>
              <div className="text-sm text-gray-500 dark:text-white">~ ${tokensToUsd(tokenDistribution.totalTokens)}</div>
            </div>

            <PrimaryBar
              extraCss=""
              values={[
                {label:"Locked", percentage:tokenDistribution.lockedPercentage, value:simplifyBN(fromLamports(userAccount.lockedAmount)), color:"bg-purple-800 dark:bg-purple-300"},
                {label:"Unlocked", percentage:tokenDistribution.unlockedPercentage, value:simplifyBN(fromLamports(userTokenBalance)), color:"bg-purple-600"},
                {label:"Claimmable", percentage:tokenDistribution.claimmablePercentage, value:simplifyBN(fromLamports(userAccount.claimmable)), color:"bg-purple-300 dark:bg-purple-800"},
              ]}
              labels={true}
            />
          </>
        )}
      </div>


      <div className="relative flex items-center mb-2 mt-2">
        <PrimaryInput name="amountField" onChange={handleFormFieldChange} value={amount === ZERO ? "" : fromLamportsDecimals(amount)} placeholder={fromLamportsDecimals(solBalance).toString()} type="number" extraCss="w-full" disabled={false}/>


        <PrimaryButton name="toggle" disabled={false} active={false} onClick={toggleSolOrToken} extraCss="btn-xs absolute right-2" value={showingSol ? "SOL" : "Tokens"}/>
        

      </div>
      <div className="text-sm text-gray-500 dark:text-white mb-2">~ ${showingSol ? solToUsd(amount) : tokensToUsd(amount)}</div>
      
      <div className="flex space-x-4 mb-4">
      {(selectedAction === ActionType.Buy || selectedAction === ActionType.RaydiumBuy) && (
        <div>
          {showingSol ? (
            <>
              <button 
                onClick={() => setAmountWithLimits(BILLION.div(new BN(10)))}
                className={"text-dark btn btn-xs mr-2"}>
                0.1
              </button>
              <button 
                onClick={() => setAmountWithLimits(BILLION)}
                className={"text-dark btn btn-xs mr-2"}>
                1
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => setAmountWithLimits(BILLION.mul(new BN(1000000)))}
                className={"text-dark btn btn-xs mr-2"}>
                1m
              </button>
              <button 
                onClick={() => setAmountWithLimits(BILLION.mul(new BN(2000000)))}
                className={"text-dark btn btn-xs mr-2"}>
                2m
              </button>
            </>
          )}
        </div>
      )}

      {selectedAction === ActionType.Sell && (
        // Render component or UI for Sell
        <div>
          <button 
          onClick={() => setAmountWithLimits(showingSol ? tokensToSol(userAccount.lockedAmount.div(new BN(2))) : userAccount.lockedAmount.div(new BN(2)))}
          className={"text-dark btn btn-xs mr-2"}>
            50%
          </button>
          <button 
          onClick={() => setAmountWithLimits(showingSol ? tokensToSol(userAccount.lockedAmount) : userAccount.lockedAmount)}
          className={"text-dark btn btn-xs mr-2"}>
            100%
          </button>
        </div>
      )}

      {(selectedAction === ActionType.RaydiumSell) && (
        <div>
          <button 
          onClick={() => setAmountWithLimits(showingSol ? tokensToSol(userTokenBalance.div(new BN(2))) : userTokenBalance.div(new BN(2)))}
          className={"text-dark btn btn-xs mr-2"}>
            50%
          </button>
          <button 
          onClick={() => setAmountWithLimits(showingSol ? tokensToSol(userTokenBalance) : userTokenBalance)}
          className={"text-dark btn btn-xs mr-2"}>
            100%
          </button>
        </div>
      )}

      {selectedAction === ActionType.Lock && (
        (() => {
          const totalLockable = userAccount.claimmable.add(userTokenBalance);  // Compute totalLockable here

          return (
            <div>
              <button 
                onClick={() => setAmountWithLimits(showingSol ? tokensToSol(totalLockable.div(new BN(2))) : totalLockable.div(new BN(2)))}
                className="text-dark btn btn-xs mr-2">
                50%
              </button>
              <button 
                onClick={() => setAmountWithLimits(showingSol ? tokensToSol(totalLockable) : totalLockable)}
                className="text-dark btn btn-xs mr-2">
                100%
              </button>
              <button 
                onClick={() => setAmountWithLimits(showingSol ? tokensToSol(userAccount.claimmable) : userAccount.claimmable)}
                className="text-dark btn btn-xs mr-2">
                Lock all claimmable
              </button>
              <p className="mt-2 text-xs text-gray-500 dark:text-white">PS: claimmable tokens will be locked first.</p>
            </div>
          );
        })()
      )}

      {selectedAction === ActionType.Claim&& (
        // Render component or UI for Sell
        <div>
          <button 
          onClick={() => setAmountWithLimits(showingSol ? tokensToSol(userAccount.claimmable.div(new BN(2))) : userAccount.claimmable.div(new BN(2)))}
          className={"text-dark btn btn-xs mr-2"}>
            50%
          </button>
          <button 
          onClick={() => setAmountWithLimits(showingSol ? tokensToSol(userAccount.claimmable) : userAccount.claimmable)}
          className={"text-dark btn btn-xs mr-2"}>
            100%
          </button>
        </div>
      )}

      </div>

        <PrimaryButton name='Transact' disabled={amount === ZERO} active={false} extraCss="" value='Transact' onClick={() => {
          if (selectedAction === ActionType.Buy || selectedAction === ActionType.Sell) {
            handleBuySellFormSubmit();
          } else if (selectedAction === ActionType.RaydiumBuy || selectedAction === ActionType.RaydiumSell) {
            handleRaydiumBuySellFormSubmit();
          } else if (selectedAction === ActionType.Lock || selectedAction === ActionType.Claim) {
            handleLockClaimFormSubmit();
          } else {
            console.warn('No handler for selected action');
          }
        }}/>
    </div>
  );
}


export function TokenCard({ accountKey }: { accountKey: PublicKey }) {
  const { publicKey } = useWallet()

  const [isVisible, setIsVisible] = useState(true);
  const [hideLeft, setHideLeft] = useState(false);
  const [hideRight, setHideRight] = useState(false);

  const [memeAccount, setMemeAccount] = useState<{
    dev: PublicKey;
    mint: PublicKey;
    lockedAmount: BN;
    creationTime: BN;
    bondedTime: BN;
    poolId: PublicKey;
  }>({
    dev: EMPTY_PUBLIC_KEY,
    mint: EMPTY_PUBLIC_KEY,
    lockedAmount: ZERO,
    creationTime: ZERO,
    bondedTime: ZERO,
    poolId: EMPTY_PUBLIC_KEY,
  });

  const [memeMetadata, setMemeMetadata] = useState<{
    name: string;
    symbol: string;
    image: string;
    description: string;
    twitterLink: string;
    telegramLink: string;
    websiteLink: string;
  }>({
    name: "",
    symbol: "",
    image: "", // Default to null
    description: "",
    twitterLink: "",
    telegramLink: "",
    websiteLink: "",
  });

  const [userAccount, setuserAccount] = useState<{
    lockedAmount: BN;
    claimmable: BN;
  }>({
    lockedAmount: ZERO,
    claimmable: ZERO,
  });

  const [holderData, setHolderData] = useState<Array<{
    user: PublicKey;
    lockedAmount: BN;
    claimmable: BN;
    tokenBalance: BN;
  }>>([]);

  const [transactionsData, setTransactionsData] = useState<Array<{
    user: string;
    signature: string;
    time: number;
    type: string;
    solChange: number;
    tokenChange: number;
  }>>([]);

  const [globalPercentage, setGlobalPercentage] = useState(0);

  const [userTokenBalance, setUserTokenBalance] = useState(ZERO);

  const [tokenDistribution, setTokenDistribution] = useState<{
    totalTokens: BN;
    lockedPercentage: number;
    unlockedPercentage: number;
    claimmablePercentage: number;
  }>({
    totalTokens: ZERO,
    lockedPercentage: 0,
    unlockedPercentage: 0,
    claimmablePercentage: 0,
  });

  const [currentTime, setCurrentTime] = useState(Date.now());

  const [tokenPrice, setTokensPerSol] = useState(INITIAL_PRICE); //tokens per sol
  const [solPrice, setSolPrice] = useState(0); //price per sol

  

  const tokensToSol = (tokens: BN): BN => {
    const sol = tokens === ZERO || tokenPrice === ZERO 
    ? ZERO :
    tokens.div(tokenPrice);
    return sol;
  };

  const solToTokens = (sol: BN): BN => {
    return sol.mul(tokenPrice);
  }
  
  const solToUsd = (sol: BN): number => {
    const result = fromLamportsDecimals(sol) * solPrice;
    return Math.ceil(result * 100) / 100; // Rounds up to 2 decimal places
  };
  
  const tokensToUsd = (tokens: BN): number => {
    const result = solToUsd(tokensToSol(tokens));
    return Math.ceil(result * 100) / 100; // Rounds up to 2 decimal places
  };

  const timeAgo = (from: number): string => {
    const now = Math.floor(currentTime / 1000); // Current time in seconds
    const diff = now - from;

    if (diff < 60) return `${diff}s`; // Seconds
    if (diff < 3600) return `${Math.floor(diff / 60)}m`; // Minutes
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`; // Hours
    return `${Math.floor(diff / 86400)}d`; // Days
  };
  

  const [raydiumPoolData, setRaydiumPoolData] = useState<{
    poolInfo: ApiV3PoolInfoStandardItemCpmm | null;
    poolKeys: CpmmKeys | null;
    rpcData: CpmmRpcData | null;
  }>({
    poolInfo: null,
    poolKeys: null,
    rpcData: null,
  });

  const { memeAccountQuery } = useMemeAccountQuery({ accountKey });
  const {transactionsQuery} = useTransactionsQuery({mint: memeAccount.mint});

  const { metadataQuery } = useMetadataQuery({
    mint: memeAccount.mint,
  });
  const { userAccountQuery } = useUserAccountQuery({ publicKey: publicKey || EMPTY_PUBLIC_KEY, mint:memeAccount.mint });
  const { getSpecificTokenBalance } = useGetTokenAccounts({
    address: publicKey || EMPTY_PUBLIC_KEY,
    mint: memeAccount.mint,
  });

  const { bondToRaydium } = useBondToRaydium();
  const { createPool } = useCreatePool();

  const {raydiumPoolQuery, raydiumSwap} = useRaydiumPoolQuery({poolId: memeAccount.poolId});

  

  const {solPriceQuery} = useSolPriceQuery();

  useEffect(() => {
    if (raydiumPoolQuery.data && memeAccount.bondedTime.gt(ZERO)) {
      setRaydiumPoolData({
        poolInfo: raydiumPoolQuery.data.poolInfo,
        poolKeys: raydiumPoolQuery.data.poolKeys,
        rpcData: raydiumPoolQuery.data.rpcData,
      });
      setTokensPerSol(new BN(raydiumPoolQuery.data.poolInfo.price));
    }
  }, [raydiumPoolQuery.data]);

  useEffect(() => {
    if (transactionsQuery.data) {
      console.log('transactions', transactionsQuery.data);
      const updatedTransactions = transactionsQuery.data.map((tx: any) =>({
        user: tx.userPublicKey,
        signature: tx.signature,
        time: tx.time,
        type: tx.type,
        solChange: tx.solChange,
        tokenChange: tx.tokenChange,
      }));

      setTransactionsData(updatedTransactions);
    }
  }, [transactionsQuery.data]);

  
  useEffect(() => {
    if (solPriceQuery.data) {
      setSolPrice(solPriceQuery.data)
    }
  }, [solPriceQuery.data]);
  

  useEffect(() => {
    if (memeAccountQuery.data) {
      setMemeAccount({
        dev: memeAccountQuery.data.dev,
        mint: memeAccountQuery.data.mint,
        lockedAmount: memeAccountQuery.data.lockedAmount,
        creationTime: memeAccountQuery.data.creationTime,
        bondedTime: memeAccountQuery.data.bondedTime,
        poolId: memeAccountQuery.data.poolId || EMPTY_PUBLIC_KEY,
      });

      let divisor = memeAccountQuery.data.bondedTime.isNeg() ? new BN('800000000000000000') : new BN('1000000000000000000');
      setGlobalPercentage(calculatePercentage(memeAccountQuery.data.lockedAmount, divisor));
    }
  }, [memeAccountQuery.data]); // Re-run when memeAccountQuery changes
  
  
  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTime(Date.now()); // State update
    }, 1000);

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, []);
  

  useEffect(() => {
    const handleResize = () => {
      setHideLeft(window.innerWidth < 1440);
      setHideRight(window.innerWidth < 1024); // Adjust threshold as needed
    };
    handleResize(); // Initialize on mount
    window.addEventListener("resize", handleResize);

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsVisible(true);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);
  useEffect(() => {
    if (memeAccountQuery.data) {
      setMemeAccount({
        dev: memeAccountQuery.data.dev,
        mint: memeAccountQuery.data.mint,
        lockedAmount: memeAccountQuery.data.lockedAmount,
        creationTime: memeAccountQuery.data.creationTime,
        bondedTime: memeAccountQuery.data.bondedTime,
        poolId: memeAccountQuery.data.poolId || EMPTY_PUBLIC_KEY,
      });

      let divisor = memeAccountQuery.data.bondedTime.isNeg() ? new BN('800000000000000000') : new BN('1000000000000000000');
      setGlobalPercentage(calculatePercentage(memeAccountQuery.data.lockedAmount, divisor));
    }
  }, [memeAccountQuery.data]); // Re-run when memeAccountQuery changes

  useEffect(() => {
    if (metadataQuery.data) {
      setMemeMetadata({
        name: metadataQuery.data.name,
        symbol: metadataQuery.data.symbol,
        image: metadataQuery.data.image,
        description: metadataQuery.data.description,
        twitterLink: metadataQuery.data.twitterLink,
        telegramLink: metadataQuery.data.telegramLink,
        websiteLink: metadataQuery.data.websiteLink,
      });
    } 
  }, [metadataQuery.data]); // Re-run when metadataQuery changes

  useEffect(() => {
    if (userAccountQuery.data) {
      setuserAccount({
        lockedAmount: userAccountQuery.data.lockedAmount,
        claimmable: userAccountQuery.data.claimmable,
      });

      const totalTokens = userTokenBalance.add(userAccountQuery.data.lockedAmount).add(userAccountQuery.data.claimmable);

      setTokenDistribution({
        totalTokens: totalTokens,
        lockedPercentage: calculatePercentage(userAccountQuery.data.lockedAmount, totalTokens),
        unlockedPercentage: calculatePercentage(userTokenBalance, totalTokens),
        claimmablePercentage: calculatePercentage(userAccountQuery.data.claimmable, totalTokens),
      });
    }
  }, [userAccountQuery.data]); // Re-run when userAccountQuery changes

  useEffect(() => {
    if (getSpecificTokenBalance.data) {
      const userTokenBalanceBN = getSpecificTokenBalance.data.balance
        ? new BN(getSpecificTokenBalance.data.balance)
        : ZERO;
      setUserTokenBalance(userTokenBalanceBN);

      const totalTokens = userTokenBalanceBN.add(userAccount.lockedAmount).add(userAccount.claimmable);
      setTokenDistribution({
        totalTokens: totalTokens,
        lockedPercentage: calculatePercentage(userAccount.lockedAmount, totalTokens),
        unlockedPercentage: calculatePercentage(userTokenBalanceBN, totalTokens),
        claimmablePercentage: calculatePercentage(userAccount.claimmable, totalTokens),
      }); 
    }
  }, [getSpecificTokenBalance.data]); 


  //const { userAccountsByMintQuery } = useUserAccountsByMintQuery({ mint });
  //const holderData = userAccountsByMintQuery.data ?? null;

  


  const bondButton = useCallback(async () => {
    try {

      const { txId, poolId } = await createPool.mutateAsync({
        mint: memeAccount.mint,
      });

      if (!poolId) {
        throw new Error("poolId is undefined");
      }

      // Call bondToRaydium first
      await bondToRaydium.mutateAsync({ mint: memeAccount.mint, poolId: new PublicKey(poolId) });
      toast.success("Bond to Raydium succeeded!");

      toast.success("Pool created successfully!");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "An error occurred.");
    }
  }, [memeAccount.mint]); // Ensure dependencies like `mint` are listed here


  const renderGridCards = () => {
    const cards = [];

    if (!hideLeft) {
      cards.push(
        <div
          key="left-top"
          className="dualbox p-6  flex flex-col"
          style={{
            gridRow: "1 / 2",
            gridColumn: "1 / 2",
          }}
        >
          <h2 className="font-bold text-xl mb-4">Transactions</h2>
          <div
            className="flex flex-col space-y-2 overflow-y-auto border-t py-4"
            style={{
              maxHeight: "250px", // Adjust height as needed
            }}
          >

            {transactionsData.map((entry, index) => (
              <div
                key={index}
                className="flex justify-between items-center border-b pb-2"
              >
                <div className="text-sm font-medium">{entry.user}</div>
                <div className="text-sm">{entry.type}</div>
                <div className="text-sm text-gray-500 dark:text-white">{entry.solChange}</div>
                <div className="text-sm text-gray-500 dark:text-white">{entry.tokenChange}</div> //token amount
                <div className="text-sm text-gray-500 dark:text-white">{timeAgo(entry.time)}</div>
                <div className="text-sm text-gray-500 dark:text-white">{entry.signature}</div>
              </div>
            ))}
          </div>
        </div>
      );
      cards.push(
        <div
          key="left-bottom"
          className="dualbox p-6  flex flex-col"
          style={{
            gridRow: "2 / 6",
            gridColumn: "1 / 2",
          }}
        >
          <h2 className="font-bold text-xl mb-4">Holders</h2>
          <div
            className="flex flex-col space-y-2 overflow-y-auto border-t py-4"
            style={{
              maxHeight: "1000px", // Adjust height as needed
            }}
          >
            {holderData.length === 0 ? (
              holderData.map((account, index) => (
                account !== null && account !== undefined && ( // Check if account is not null/undefined
                  <div
                    key={index}
                    className="flex justify-between items-center border-b pb-2"
                  >
                    <div className="text-sm font-medium"># {account.user.toString()}</div>
                    <div className="text-sm">{account.lockedAmount.toString()}</div>
                    <div className="text-sm text-gray-500 dark:text-white">{account.claimmable.toString()}</div>
                    <div className="text-sm text-gray-500 dark:text-white">{account.tokenBalance.toString()}</div>
                    <div className="text-sm text-gray-500 dark:text-white">{account.lockedAmount.add(account.claimmable.add(account.tokenBalance)).toString()}</div>
                  </div>
                )
              ))
            ) : (
              <div className="text-sm text-gray-500 dark:text-white">No data available.</div>
            )}
          </div>
        </div>
      );
    }

    cards.push(
      <div
        key="middle-top"
        className="relative dualbox  p-6"
        style={{
          gridRow: "1 / 2", // Adjust position for compact view
          gridColumn: hideRight ? "1 / 4" : (hideLeft ? "1 / 3" : "2 / 3")
        }}
      >
        <button
          className="btn btn-xs lg:btn-md btn-primary"
          onClick={bondButton}
        >
          bond to ray
        </button>
        <div className="absolute top-2 right-2 text-gray-500 dark:text-white text-xs">{timeAgo(memeAccount.creationTime.toNumber())} ago</div>
        <div className="flex items-start mb-2">
          <img
            src={memeMetadata.image}
            alt="Icon"
            className="w-12 h-12 dualbox object-contain"
          />
          <div className="ml-4">
            <h2 className="text-xl font-bold">
              <span className="font-bold">{memeMetadata.symbol}</span>
              <span className="font-normal"> {memeMetadata.name}
                <span className="text-gray-500 dark:text-white text-xs ml-2">{memeAccount.mint.toString()}</span>
              </span>
            </h2>
            <p className="text-gray-500 dark:text-white text-sm mt-2">
              {memeMetadata.description}
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          {/* Telegram Icon */}
          {memeMetadata.telegramLink !== "" && (
            <a
              href={memeMetadata.telegramLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-5 h-5 text-gray-500 dark:text-white hover:text-purple-300"
              onClick={(e) => e.stopPropagation()}
            >
              <FaTelegramPlane />
            </a>
          )}

          {/* Twitter (X) Icon */}
          {memeMetadata.twitterLink !== "" && (
            <a
              href={memeMetadata.twitterLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-5 h-5 text-gray-500 dark:text-white hover:text-purple-300"
              onClick={(e) => e.stopPropagation()}
            >
              <FaXTwitter />
            </a>
          )}

          {/* Website Icon */}
          {memeMetadata.websiteLink !== "" && (
            <a
              href={memeMetadata.websiteLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-5 h-5 text-gray-500 dark:text-white hover:text-purple-300"
              onClick={(e) => e.stopPropagation()}
            >
              <FaGlobe />
            </a>
          )}
        </div>
        <div className="flex flex-col space-y-1 mt-2">
          <div className="flex items-baseline space-x-2">
            <div className="text-sm font-semibold">{globalPercentage.toString()} %</div>
            <div className="text-sm text-gray-500 dark:text-white">~ ${tokensToUsd(memeAccount.lockedAmount)}</div>
          </div>
        </div>

        <PrimaryBar
          extraCss="mt-1"
          values={[
            {label:"", percentage:globalPercentage, value:"", color:"bg-black dark:bg-white"},
          ]}
          labels={false}
        />
        <div className="flex justify-start items-center text-gray-500 dark:text-white mt-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 24 24"
            className="w-4 h-4"
          >
            <rect width="24" height="24" fill="currentColor" />
          </svg>
          <span className="text-sm ml-1">123</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 24 24"
            className="w-4 h-4 ml-4"
          >
            <rect width="24" height="24" fill="currentColor" />
          </svg>
          <span className="text-sm ml-1">456</span>
        </div>

      </div >
    );
    cards.push(
      <div
        key="middle-bottom"
        className="dualbox  p-4 flex items-center justify-center"
        style={{
          gridRow: "2 / 6", // Adjust position for compact view
          gridColumn: hideRight ? "1 / 4" : (hideLeft ? "1 / 3" : "2 / 3")
        }}
      >
        <img
          src="https://via.placeholder.com/300x400"
          alt="Large Placeholder"
          className="w-full h-full object-cover dualbox"
        />
      </div>
    );

    if (!hideRight) {
      cards.push(
        publicKey ? (
          <BalanceCard publicKey={publicKey} memeAccount={memeAccount} memeMetadata={memeMetadata} userAccount={userAccount} tokenDistribution={tokenDistribution} userTokenBalance={userTokenBalance} raydiumSwap={raydiumSwap} solToTokens={solToTokens} tokensToSol={tokensToSol} solToUsd={solToUsd} tokensToUsd={tokensToUsd} />
        ) : (
          <div
            key="right-top"
            className="dualbox p-6  flex flex-col"
            style={{
              gridRow: "1 / 2",
              gridColumn: "3 / 4",
            }}
          >
            <div className="flex justify-center items-center h-full">
              <WalletButton />
            </div>
          </div>
        )

      );

      cards.push(
        <div
          key="right-bottom"
          className="dualbox p-6  flex flex-col"
          style={{
            gridRow: "2 / 6",
            gridColumn: "3 / 4",
          }}
        >
          <h2 className="font-bold text-xl mb-4">Chat</h2>
          {/* Chat container */}
          <div
            className="flex flex-col space-y-2 overflow-y-auto border-t border-b py-4"
            style={{
              maxHeight: "1000px", // Adjust height as needed
            }}
          >
            {/* Placeholder messages */}
            {[
              { user: "Alice", message: "Hello there!", time: "10:00 AM" },
              { user: "Bob", message: "Hi, how are you?", time: "10:05 AM" },
              { user: "You", message: "I'm good, thanks!", time: "10:06 AM" },
              { user: "Alice", message: "Hello there!", time: "10:00 AM" },
              { user: "Bob", message: "Hi, how are you?", time: "10:05 AM" },
              { user: "You", message: "I'm good, thanks!", time: "10:06 AM" },
              { user: "Alice", message: "Hello there!", time: "10:00 AM" },
              { user: "Bob", message: "Hi, how are you?", time: "10:05 AM" },
              { user: "You", message: "I'm good, thanks!", time: "10:06 AM" },
              { user: "Alice", message: "Hello there!", time: "10:00 AM" },
              { user: "Bob", message: "Hi, how are you?", time: "10:05 AM" },
              { user: "You", message: "I'm good, thanks!", time: "10:06 AM" },
            ].map((chat, index) => (
              <div key={index} className="flex flex-col">
                <div className="text-sm font-medium">
                  {chat.user}{" "}
                  <span className="text-xs text-gray-500 dark:text-white">{chat.time}</span>
                </div>
                <div className="text-sm">{chat.message}</div>
              </div>
            ))}
          </div>

          {/* Message input */}
          <form
            className="flex items-center mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              console.log("Send message logic here!");
            }}
          >

            <PrimaryInput name="ChatField" onChange={(e) => e.stopPropagation()} value='' type='string' placeholder='type your message...' extraCss='w-full' disabled={false}/>
            <PrimaryButton name='Send' disabled={false} active={false} extraCss='ml-2 btn-sm' value='Send' onClick={() => console.log('Send message logic here!')}/>

            
          </form>
        </div>
      );
    }


    return cards;
  };

  return (
    <div className="relative">
      {/* Dark Overlay */}
      {!isVisible && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-10"
        >
          <div
            className={`absolute inset-0 grid "grid-cols-[1fr_3fr_1fr]"
              } gap-10 p-20 z-20`}
            style={{
              pointerEvents: "auto",
              gridTemplateRows: "repeat(5, 1fr)",
            }}
          >
            {renderGridCards()}
          </div>
        </div>
      )}

      {/* Card */}
      {isVisible && (
        <div
          className="max-w-lg mx-auto mt-10 cursor-pointer"
          onClick={() => setIsVisible(false)}
        >
          <div className="relative dualbox  p-6">
            <div className="absolute top-2 right-2 text-gray-500 dark:text-white text-xs">
              {timeAgo(memeAccount.creationTime.toNumber())} ago
            </div>
            <div className="flex items-start mb-2">
              <img
                src={memeMetadata.image}
                alt="Icon"
                className="w-12 h-12 dualbox object-contain"
              />

              <div className="ml-4">
                <h2 className="text-xl font-bold">
                  <span className="font-bold">{memeMetadata.symbol}</span>
                  <span className="font-normal"> {memeMetadata.name}
                    <span className="text-gray-500 dark:text-white text-xs ml-2">{memeAccount.mint.toString().slice(0, 10)}...</span>
                  </span>

                </h2>
                <p className="text-gray-500 dark:text-white text-sm mt-2">
                  {memeMetadata.description}
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              {/* Telegram Icon */}
              {memeMetadata.telegramLink !== "" && (
                <a
                  href={memeMetadata.telegramLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-5 h-5 text-gray-500 dark:text-white hover:text-purple-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FaTelegramPlane />
                </a>
              )}

              {/* Twitter (X) Icon */}
              {memeMetadata.twitterLink !== "" && (
                <a
                  href={memeMetadata.twitterLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-5 h-5 text-gray-500 dark:text-white hover:text-purple-300"
                  onClick={(e) => e.stopPropagation()}
                >{memeMetadata.twitterLink}
                  <FaXTwitter />
                </a>
              )}

              {/* Website Icon */}
              {memeMetadata.websiteLink !== "" && (
                <a
                  href={memeMetadata.websiteLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-5 h-5 text-gray-500 dark:text-white hover:text-purple-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FaGlobe />
                </a>
              )}
            </div>

            <div className="flex flex-col space-y-1 mt-2">
              <div className="flex items-baseline space-x-2">
                <div className="text-sm font-semibold">{globalPercentage.toString()} %</div>
                <div className="text-sm text-gray-500 dark:text-white">~ ${tokensToUsd(memeAccount.lockedAmount)}</div>
              </div>
            </div>

            <PrimaryBar
              extraCss="mt-1"
              values={[
                {label:"", percentage:globalPercentage, value:"", color:"bg-black dark:bg-white"},
              ]}
              labels={false}
            />
            <div className="flex justify-start items-center text-gray-500 dark:text-white mt-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
                viewBox="0 0 24 24"
                className="w-4 h-4"
              >
                <rect width="24" height="24" fill="currentColor" />
              </svg>
              <span className="text-sm ml-1">123</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
                viewBox="0 0 24 24"
                className="w-4 h-4 ml-4"
              >
                <rect width="24" height="24" fill="currentColor" />
              </svg>
              <span className="text-sm ml-1">456</span>
            </div>
            {/* GS Balance */}
            {publicKey != null ? (
              <div className="flex flex-col space-y-2 mt-2">
                {memeAccount.bondedTime.lt(ZERO) ? (
                  <>
                    {/* When bondedTime is negative so hasnt bonded */}
                    <div className="flex items-baseline space-x-2">
                      <div className="text-sm font-semibold ">
                        {simplifyBN(fromLamports(userAccount.lockedAmount))} {memeMetadata.symbol}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-white">~ ${tokensToUsd(memeAccount.lockedAmount)}</div>
                    </div>

                    <PrimaryBar
                      extraCss=""
                      values={[
                        {label:"Invested", percentage:100, value:simplifyBN(fromLamports(userAccount.lockedAmount)), color:"bg-purple-300"},
                      ]}
                      labels={true}
                    />
                  </>
                ) : (
                  <>
                    {/* When bondedTime is positive */}
                    <div className="flex items-baseline space-x-2">
                      <div className="text-sm font-semibold">
                        {simplifyBN(fromLamports(tokenDistribution.totalTokens))} {memeMetadata.symbol}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-white">~ ${tokensToUsd(tokenDistribution.totalTokens)}</div>
                    </div>

                    <PrimaryBar
                      extraCss=""
                      values={[
                        {label:"Locked", percentage:tokenDistribution.lockedPercentage, value:simplifyBN(fromLamports(userAccount.lockedAmount)), color:"bg-purple-800 dark:bg-purple-300"},
                        {label:"Unlocked", percentage:tokenDistribution.unlockedPercentage, value:simplifyBN(fromLamports(userTokenBalance)), color:"bg-purple-600"},
                        {label:"Claimmable", percentage:tokenDistribution.claimmablePercentage, value:simplifyBN(fromLamports(userAccount.claimmable)), color:"bg-purple-300 dark:bg-purple-800"},
                      ]}
                      labels={true}
                    />
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

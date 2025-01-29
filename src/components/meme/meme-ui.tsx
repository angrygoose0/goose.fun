
'use client'

import { ChangeEvent, useCallback, useState, useEffect } from 'react'
import {useMetadataQuery, useBuyTokenMutation, useUserAccountQuery, useCreateMemeToken, useProcessedAccountsQuery, useMemeAccountQuery, useLockTokenMutation } from './meme-data-access'
import { useGetBalance, useGetTokenAccounts, useGetTokenBalance } from '../account/account-data-access';
import {useSolPriceQuery} from '../solana/solana-data-access';
import {fromLamports, calculatePercentage, simplifyBN, fromLamportsDecimals, ToLamportsDecimals, ZERO, EMPTY_PUBLIC_KEY, BILLION, SOL_MINT, TOKENS_PER_PAGE, ActionType, SOL_GOAL_BEFORE_BONDING, MINT_SUPPLY } from './meme-helper-functions';
import axios from "axios";
import toast from "react-hot-toast";
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { FaTelegramPlane, FaGlobe, } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { BN } from '@coral-xyz/anchor';
import { WalletButton } from '../solana/solana-provider'
import {useRaydiumPoolQuery, useInitRaydiumSdk } from '../raydium/raydium-data-access'
import { AccountType, ApiV3PoolInfoStandardItemCpmm, CpmmKeys, CpmmRpcData } from '@raydium-io/raydium-sdk-v2';

import {PrimaryBar, PrimaryButton, PrimaryInput, PrimarySelect} from '../ui/extra-ui/button'
import Image from 'next/image';
import { BondButton, UnlockButton } from '../admin/admin-ui';



export function MemeCreate() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const [token, setToken] = useState<{
    name: string;
    symbol: string;
    image: string | null;
    description: string;
    twitter_link: string;
    telegram_link: string;
    website_link: string;
  }>({
    name: "",
    symbol: "",
    image: null,
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

  const handleImageChange: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const fileList = event.target.files;
    if (fileList && fileList.length > 0) {
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
      return null;
    }
  };

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
        },
      });

      const url = `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
      return url;
    } catch (error) {
      toast.error("Failed to upload metadata");
      console.error(error);
      return null;
    }
  };

  const handleFormFieldChange = (fieldName: string, e: ChangeEvent<HTMLInputElement>) => {
    setToken({ ...token, [fieldName]: e.target.value });
  };

  const handleFormSubmit = useCallback(async () => {
    setLoading(true);
    try {
      if (!isFormValid) throw new Error("Form not valid");
      if (!publicKey) throw new Error("Wallet is not connected.");

      const metadataUrl = await uploadMetadata(token);
      if (!metadataUrl) throw new Error("Failed to upload metadata.");

      const metadata = {
        name: token.name,
        symbol: token.symbol,
        uri: metadataUrl,
        decimals: 9,
      };

      await createMemeToken.mutateAsync({ metadata });

      toast.success("Meme token created successfully!");
      closeModal();
    } catch (error: any) {
      console.error("Error creating meme token:", error);
      toast.error("Failed to create meme token.");
    } finally {
      setLoading(false);
    }
  }, [token, createMemeToken, isFormValid, publicKey]);

  return (
    <div>
      <PrimaryButton
        name="createModal"
        disabled={false}
        active={false}
        onClick={openModal}
        extraCss=""
        value="Create"
      />

      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-10"
          onClick={closeModal}
        >
          <div
            className="relative dualbox p-6 z-15"
            onClick={(e) => e.stopPropagation()}
          >
            {loading && <div className="loading-spinner">Processing...</div>}

            {token.image ? (
              <Image
                src={token.image}
                alt="token"
                width={80}
                height={80}
                className="object-cover"
              />
            ) : (
              <label htmlFor="file" className="custom-file-upload">
                <span>Image</span>
                <input type="file" id="file" onChange={handleImageChange} />
              </label>
            )}
            
            <PrimaryInput name="name" onChange={(e) => handleFormFieldChange("name", e)} value={token.name} placeholder="name" type="text" extraCss="w-full block mt-4" disabled={false}/>
            <PrimaryInput name="symbol" onChange={(e) => handleFormFieldChange("symbol", e)} value={token.symbol} placeholder="symbol" type="text" extraCss="w-full block mt-4" disabled={false}/>
            <PrimaryInput name="description" onChange={(e) => handleFormFieldChange("description", e)} value={token.description} placeholder="description" type="text" extraCss="w-full block mt-4" disabled={false}/>
            <PrimaryInput name="twitter_link" onChange={(e) => handleFormFieldChange("twitter_link", e)} value={token.twitter_link} placeholder="twitter link" type="text" extraCss="w-full block mt-4" disabled={false}/>
            <PrimaryInput name="telegram_link" onChange={(e) => handleFormFieldChange("telegram_link", e)} value={token.telegram_link} placeholder="telegram link" type="text" extraCss="w-full block mt-4" disabled={false}/>
            <PrimaryInput name="website_link" onChange={(e) => handleFormFieldChange("website_link", e)} value={token.website_link} placeholder="website link" type="text" extraCss="w-full block mt-4" disabled={false}/>


            {/* Repeat for other fields */}
            <PrimaryButton
              name="create_token"
              disabled={!isFormValid || loading}
              active={false}
              onClick={handleFormSubmit}
              extraCss="mt-4"
              value={loading ? "Creating..." : "Create Token"}
            />
          </div>
        </div>
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

  if (processedAccountsQuery.isLoading) {
    content = (
      <div>
        <span className="loading loading-spinner"></span>
        <p>Loading...</p>
      </div>
    );
  } else if (processedAccountsQuery.error) {
    content = (
      <div>
        <p>{processedAccountsQuery.error.message}</p>
      </div>
    );
  } else if (!processedAccountsQuery || (processedAccountsQuery.data ?? []).length == 0) {
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
      <div className="flex justify-center py-4 space-x-4">
        <PrimaryButton name='prev' disabled={currentPage === 1} active={false} onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} extraCss="btn-xs" value="Previous"/>
        <span>Page {currentPage}</span>
        <PrimaryButton name='next' disabled={!processedAccountsQuery || (processedAccountsQuery.data ?? []).length < TOKENS_PER_PAGE} active={false} onClick={() => setCurrentPage((prev) => prev + 1)} extraCss="btn-xs" value="Next"/>
      </div>
    </div >
  );
}


export function BalanceCard({ publicKey, memeAccount, memeMetadata, userAccount, tokenDistribution, totalTokens, userTokenBalance, raydiumSwap, tokensToSol, solToTokens, solToUsd, tokensToUsd }: { publicKey: PublicKey, memeAccount: any, memeMetadata: any, userAccount: any, tokenDistribution: any, totalTokens:BN, userTokenBalance:BN, raydiumSwap:any, tokensToSol:any, solToTokens:any, solToUsd:any, tokensToUsd:any }) {
  const {buyToken} = useBuyTokenMutation();
  const {lockToken} = useLockTokenMutation();

  const [solBalance, setSolBalance] = useState(ZERO);

  const {balanceQuery} = useGetBalance({ address: publicKey })
  

  useEffect(() => {
    if (balanceQuery.data) {
      setSolBalance(new BN(balanceQuery.data));
    }
  }, [balanceQuery.data]);


  useEffect(() => {
    if (memeAccount.bondedTime.lt(ZERO) && memeAccount.creationTime.gte(ZERO)) {
      handleActionChange(ActionType.Buy);
    } else {
      handleActionChange(ActionType.RaydiumBuy);
    }
  }, [memeAccount.bondedTime, memeAccount.creationTime]);

  const [selectedAction, setSelectedAction] = useState<ActionType>(ActionType.Buy);

  const handleActionChange = (action: ActionType) => {
    if (action === ActionType.Buy) {
      setShowingSol(true);
    }
    setSelectedAction(action);
    setAmount(ZERO);
  };

  const [amount, setAmount] = useState(ZERO);
  const [showingSol, setShowingSol] = useState(true); // true for showing SOL, false for showing token


  const toggleSolOrToken = () => {
    if (selectedAction === ActionType.Buy) {
      return;
    }

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

    if (numericValue.lte(ZERO)) {
      setAmount(ZERO);
      return;
    }

    if (selectedAction === ActionType.Buy) { // always sol
      setAmount(numericValue.cmp(solBalance) === -1 ? numericValue : solBalance);

    } else if (selectedAction === ActionType.RaydiumBuy) {
      if (useShowingSol) {
        setAmount(numericValue.cmp(solBalance) === -1 ? numericValue : solBalance);
      } else {
        setAmount(numericValue.cmp(solToTokens(solBalance)) === -1 ? numericValue : solToTokens(solBalance));
      }

    } else if (selectedAction === ActionType.RaydiumSell || selectedAction === ActionType.Lock) {
      if (useShowingSol) {
        setAmount(numericValue.cmp(tokensToSol(userTokenBalance)) === -1 ? numericValue : tokensToSol(userTokenBalance));
      } else {
        setAmount(numericValue.cmp(userTokenBalance) === -1 ? numericValue : userTokenBalance);
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


  const handleBuyFormSubmit = useCallback(async () => {
    try {

      // Validate amount based on selected action
      if (selectedAction !== ActionType.Buy) {
        throw new Error("wrong action type");
      }

      if (amount.gte(solBalance)) {
        throw new Error("SOL balance too low1.");
      }

      await buyToken.mutateAsync({ amount, mint: memeAccount.mint });
      toast.success("Success!");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "An error occurred.");
    }
  }, [amount, selectedAction, solBalance, memeAccount.mint, buyToken]);

  const handleLockFormSubmit = useCallback(async () => {
    try {

      // Validate amount based on selected action
      if (selectedAction !== ActionType.Lock) {
        throw new Error("wrong action type");
      }

      const tokensRequiredBN = showingSol ? solToTokens(amount) : amount;

      if (tokensRequiredBN.gte(userTokenBalance)) {
        throw new Error("Token balance too low.");
      }


      // Perform the lock/claim operation
      await lockToken.mutateAsync({ amount: tokensRequiredBN, mint: memeAccount.mint });
      toast.success("Success!");

    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "An error occurred.");
    }
  }, [amount, showingSol, selectedAction, userTokenBalance, memeAccount.mint, lockToken, solToTokens]);
  
  
  const handleRaydiumBuySellFormSubmit = useCallback(async () => {
    try {
      let amountSentToRaydium: BN; //sol lamports
      let inputMint: PublicKey;

        // Validate amount based on selected action
      if (selectedAction === ActionType.RaydiumBuy) {

        const solRequiredBN = showingSol ? amount : tokensToSol(amount);

        if (solRequiredBN.gte(solBalance)) {
          throw new Error("SOL balance too low.");
        }

        amountSentToRaydium = solRequiredBN;
        inputMint = SOL_MINT;
      } else if (selectedAction === ActionType.RaydiumSell) {
        const tokensRequiredBN = showingSol ? solToTokens(amount) : amount;

        if (tokensRequiredBN.gte(userTokenBalance)) {
          throw new Error("Token balance too low.");
        }

        amountSentToRaydium = showingSol ? solToTokens(amount) : amount; // sol lamports
        inputMint = memeAccount.mint;
      } else {
        throw new Error("wrong action type");
      }

        // Perform the buy/sell operation
        await raydiumSwap.mutateAsync({inputMint, inputAmount: amountSentToRaydium,});
        toast.success("Success!");
    } catch (error: any) {
          console.error(error);
        toast.error(error.message || "An error occurred.");
    }
  }, [amount, showingSol, selectedAction, solBalance, userTokenBalance, raydiumSwap, tokensToSol, solToTokens, memeAccount.mint]);



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
        {(memeAccount.bondedTime.lt(ZERO) && memeAccount.creationTime.gte(ZERO)) ? (
          <>
            <PrimaryButton name="selectBuy" disabled={true} active={selectedAction === ActionType.Buy} onClick={() => handleActionChange(ActionType.Buy)} extraCss="w-full" value="Buy"/>
          </>
        ) : (
          <>
            <PrimaryButton name="selectRaydiumBuy" disabled={false} active={selectedAction === ActionType.RaydiumBuy} onClick={() => handleActionChange(ActionType.RaydiumBuy)} extraCss="w-1/3" value="Buy"/>
            <PrimaryButton name="selectRaydiumSell" disabled={false} active={selectedAction === ActionType.RaydiumSell} onClick={() => handleActionChange(ActionType.RaydiumSell)} extraCss="w-1/3" value="Sell"/> 
            <PrimaryButton name="selectLock" disabled={false} active={selectedAction === ActionType.Lock} onClick={() => handleActionChange(ActionType.Lock)} extraCss="w-1/3" value="Lock"/> 
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
        {(memeAccount.bondedTime.lt(ZERO) && memeAccount.creationTime.gte(ZERO)) ? (
          <>
            <div className="flex items-baseline space-x-2">
              <div className="text-sm font-semibold">
                {fromLamportsDecimals(userAccount.lockedAmount)} SOL
              </div>
              <div className="text-sm text-gray-500 dark:text-white">~ ${solToUsd(userAccount.lockedAmount)}</div>
            </div>

            <PrimaryBar
              extraCss=""
              values={[
                {label:"Invested", percentage:100, value:fromLamportsDecimals(userAccount.lockedAmount).toString(), color:"bg-purple-300"},
              ]}
              labels={true}
            />
          </>
        ) : (
          <>
            <div className="flex items-baseline space-x-2">
              <div className="text-sm font-semibold">
                {simplifyBN(fromLamports(totalTokens))} {memeMetadata.symbol}
              </div>
              <div className="text-sm text-gray-500 dark:text-white">~ ${tokensToUsd(totalTokens)}</div>
            </div>

            <PrimaryBar
              extraCss=""
              values={[
                {label:"Locked", percentage:tokenDistribution.lockedPercentage, value:simplifyBN(fromLamports(userAccount.lockedAmount)), color:"bg-purple-600"},
                {label:"Unlocked", percentage:tokenDistribution.unlockedPercentage, value:simplifyBN(fromLamports(userTokenBalance)), color:"bg-purple-300"},
              ]}
              labels={true}
            />
          </>
        )}
      </div>


      <div className="relative flex items-center mb-2 mt-2">
        <PrimaryInput
          name="amountField"
          onChange={handleFormFieldChange}
          onFocus={()=> {}}
          value={amount === ZERO ? "" : fromLamportsDecimals(amount)}
          placeholder={
            showingSol
              ? (selectedAction === ActionType.Buy || selectedAction === ActionType.RaydiumBuy) 
                ? fromLamportsDecimals(solBalance).toString()
                : (selectedAction === ActionType.RaydiumSell || selectedAction === ActionType.Lock)
                ? fromLamportsDecimals((tokensToSol(userTokenBalance))).toString()
                : ""
              : (selectedAction === ActionType.Buy || selectedAction === ActionType.RaydiumBuy) 
                ? fromLamportsDecimals(solToTokens(solBalance)).toString()
                : (selectedAction === ActionType.RaydiumSell || selectedAction === ActionType.Lock)
                ? fromLamportsDecimals(userTokenBalance).toString()
                : ""
          }
          type="number"
          extraCss="w-full"
          disabled={false}
        />

        <button
          onClick={toggleSolOrToken}
          disabled={selectedAction == ActionType.Buy}
          className={"text-dark btn btn-xs absolute right-2"}>
          {showingSol ? "SOL" : "Tokens"}
        </button>

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



      {(selectedAction === ActionType.RaydiumSell || selectedAction === ActionType.Lock) && (
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


      </div>

        <PrimaryButton name='Transact' disabled={amount === ZERO} active={false} extraCss="" value='Transact' onClick={() => {
          if (selectedAction === ActionType.Buy) {
            handleBuyFormSubmit();
          } else if (selectedAction === ActionType.RaydiumBuy || selectedAction === ActionType.RaydiumSell) {
            handleRaydiumBuySellFormSubmit();
          } else if (selectedAction === ActionType.Lock) {
            handleLockFormSubmit();
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

  const [userAccount, setUserAccount] = useState<{
    lockedAmount: BN;
  }>({
    lockedAmount: ZERO,
  });

  const [holderData, setHolderData] = useState<Array<{
    user: PublicKey;
    lockedAmount: BN;
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

  
  const [userTokenBalance, setUserTokenBalance] = useState(ZERO);

  const [currentTime, setCurrentTime] = useState(Date.now());

  const [tokenPrice, setTokensPerSol] = useState(ZERO); //tokens per sol
  const [solPrice, setSolPrice] = useState(0); //price per sol

  

  const tokensToSol = useCallback((tokens: BN): BN => {
    return tokens === ZERO || tokenPrice === ZERO 
        ? ZERO 
        : tokens.div(tokenPrice);
  }, [tokenPrice]); // Recreates only when tokenPrice changes

  const solToTokens = useCallback((sol: BN): BN => {
      return sol.mul(tokenPrice);
  }, [tokenPrice]); // Recreates only when tokenPrice changes

  const solToUsd = useCallback((sol: BN): number => {
      const result = fromLamportsDecimals(sol) * solPrice;
      return Math.ceil(result * 100) / 100; // Rounds up to 2 decimal places
  }, [solPrice]); // If solPrice is state, add it as a dependency

  const tokensToUsd = useCallback((tokens: BN): number => {
      const result = solToUsd(tokensToSol(tokens));
      return Math.ceil(result * 100) / 100; // Rounds up to 2 decimal places
  }, [tokensToSol, solToUsd]); // Depends on both functions


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

  const { metadataQuery } = useMetadataQuery({
    mint: memeAccount.mint,
  });
  const { userAccountQuery } = useUserAccountQuery({ publicKey: publicKey || EMPTY_PUBLIC_KEY, mint:memeAccount.mint });
  const { getSpecificTokenBalance } = useGetTokenBalance({
    address: publicKey || EMPTY_PUBLIC_KEY,
    mint: memeAccount.mint,
  });

  const {raydiumPoolQuery, raydiumSwap} = useRaydiumPoolQuery({poolId: memeAccount.poolId});
  console.log('raydium',raydiumPoolQuery.data);
  const {solPriceQuery} = useSolPriceQuery();

  useEffect(() => {
    if (raydiumPoolQuery.data) {
      setRaydiumPoolData({
        poolInfo: raydiumPoolQuery.data.poolInfo,
        poolKeys: raydiumPoolQuery.data.poolKeys,
        rpcData: raydiumPoolQuery.data.rpcData,
      });
      console.log(raydiumPoolQuery.data.poolInfo.price, 'tokenPrice');
      setTokensPerSol(new BN(raydiumPoolQuery.data.poolInfo.price));
    }
  }, [raydiumPoolQuery.data]);

  /*
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
  */

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
      const { lockedAmount } = userAccountQuery.data;
      setUserAccount({ lockedAmount});
    }
  }, [userAccountQuery.data,]);

  useEffect(() => {
    if (getSpecificTokenBalance.data) {
      const unlockedAmount = new BN(getSpecificTokenBalance.data.balance || ZERO);
      setUserTokenBalance(unlockedAmount);
    }
  }, [getSpecificTokenBalance.data]);


  const totalTokens = userAccount.lockedAmount.add(userTokenBalance)
  const tokenDistribution = {
    lockedPercentage: calculatePercentage(userAccount.lockedAmount, totalTokens),
    unlockedPercentage: calculatePercentage(userTokenBalance, totalTokens),
  };

  const divisor = (memeAccount.bondedTime.lt(ZERO) && memeAccount.creationTime.gte(ZERO)) ? SOL_GOAL_BEFORE_BONDING : MINT_SUPPLY;
  const globalPercentage = calculatePercentage(memeAccount.lockedAmount, divisor);




  //const { userAccountsByMintQuery } = useUserAccountsByMintQuery({ mint });
  //const holderData = userAccountsByMintQuery.data ?? null;


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
                <div className="text-sm text-gray-500 dark:text-white">{entry.tokenChange}</div>
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
                    <div className="text-sm text-gray-500 dark:text-white">{account.tokenBalance.toString()}</div>
                    <div className="text-sm text-gray-500 dark:text-white">{account.lockedAmount.add(account.tokenBalance).toString()}</div>
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
        <div className="absolute top-2 right-2 text-gray-500 dark:text-white text-xs">{timeAgo(memeAccount.creationTime.toNumber())} ago</div>
        <div className="flex items-start mb-2">
        {memeMetadata.image ? (
          <Image
            src={memeMetadata.image}
            alt="Icon"
            width={48} // Specify width and height for the image
            height={48}
            className="dualbox object-contain"
          />
        ) : (
          <div
            style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#f0f0f0', // Light gray for placeholder
              borderRadius: '4px', // Optional for rounded edges
            }}
            className="dualbox object-contain"
          ></div>
        )}
        
          <div className="ml-4">
            <h2 className="text-xl font-bold">
              <span className="font-bold">{memeMetadata.symbol}</span>
              <span className="font-normal"> {memeMetadata.name}
              <span className="text-gray-500 dark:text-white text-sm ml-2">{accountKey.toString()}</span>
                <span className="text-gray-500 dark:text-white text-xs ml-2">{memeAccount.mint.toString()}</span>
                
              </span>
            </h2>
            <p className="text-gray-500 dark:text-white text-sm mt-2">
              {memeMetadata.description}
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
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
            {(memeAccount.bondedTime.lt(ZERO) && memeAccount.creationTime.gte(ZERO)) ? (
              <div className="text-sm text-gray-500 dark:text-white">~ ${solToUsd(memeAccount.lockedAmount)}</div>
            ) : (
              <div className="text-sm text-gray-500 dark:text-white">~ ${tokensToUsd(memeAccount.lockedAmount)}</div>
            )}
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
        

        {(memeAccount.poolId === EMPTY_PUBLIC_KEY) ? (null) : (null)}  
        <BondButton accountKey={accountKey}/>
        <UnlockButton accountKey={accountKey}/>

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
        <div
          className="w-full h-full object-cover dualbox"
          style={{ backgroundColor: '#FFF', width: '600px', height: '200px' }}
        >
          price chart will go here.
        </div>
      </div>
    );

    if (!hideRight) {
      cards.push(
        publicKey ? (
          <BalanceCard publicKey={publicKey} memeAccount={memeAccount} memeMetadata={memeMetadata} userAccount={userAccount} tokenDistribution={tokenDistribution} totalTokens={totalTokens} userTokenBalance={userTokenBalance} raydiumSwap={raydiumSwap} solToTokens={solToTokens} tokensToSol={tokensToSol} solToUsd={solToUsd} tokensToUsd={tokensToUsd} />
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
          <div
            className="flex flex-col space-y-2 overflow-y-auto border-t border-b py-4"
            style={{
              maxHeight: "1000px", // Adjust height as needed
            }}
          >
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

      {isVisible && (
        <div
          className="max-w-lg mx-auto mt-10 cursor-pointer"
          onClick={() => setIsVisible(false)}
        >
          
          <div
          className={`relative dualbox hover:bg-purple-200 p-6 ${
            !(memeAccount.bondedTime.lt(ZERO) && memeAccount.creationTime.gte(ZERO))
              && 'highlight-shadow'
          }`}
        >
            <div className="absolute top-2 right-2 text-gray-500 dark:text-white text-xs">
              {timeAgo(memeAccount.creationTime.toNumber())} ago
            </div>
            <div className="flex items-start mb-2">

            {memeMetadata.image ? (
              <Image
                src={memeMetadata.image}
                alt="Icon"
                width={48} // Specify width and height for the image
                height={48}
                className="dualbox object-contain"
              />
            ) : (
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  backgroundColor: '#f0f0f0', // Light gray for placeholder
                  borderRadius: '4px', // Optional for rounded edges
                }}
                className="dualbox object-contain"
              ></div>
            )}

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
                  {(memeAccount.bondedTime.lt(ZERO) && memeAccount.creationTime.gte(ZERO)) ? (
                    <div className="text-sm text-gray-500 dark:text-white">~ ${solToUsd(memeAccount.lockedAmount)}</div>
                  ) : (
                    <div className="text-sm text-gray-500 dark:text-white">~ ${tokensToUsd(memeAccount.lockedAmount)}</div>
                  )}
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
            {(publicKey != null && (userAccount.lockedAmount > ZERO || userTokenBalance > ZERO)) ? (
              <div className="flex flex-col space-y-2 mt-2">
                {(memeAccount.bondedTime.lt(ZERO) && memeAccount.creationTime.gte(ZERO)) ? (
                  <>
                    <div className="flex items-baseline space-x-2">
                      <div className="text-sm font-semibold ">
                        {fromLamportsDecimals(userAccount.lockedAmount)} SOL
                      </div>
                      <div className="text-sm text-gray-500 dark:text-white">~ ${solToUsd(userAccount.lockedAmount)}</div>
                    </div>

                    <PrimaryBar
                      extraCss=""
                      values={[
                        {label:"Invested", percentage:100, value:`${fromLamportsDecimals(userAccount.lockedAmount)} SOL`, color:"bg-purple-300"},
                      ]}
                      labels={true}
                    />
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline space-x-2">
                      <div className="text-sm font-semibold">
                        {simplifyBN(fromLamports(totalTokens))} {memeMetadata.symbol}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-white">~ ${tokensToUsd(totalTokens)}</div>
                    </div>

                    <PrimaryBar
                      extraCss=""
                      values={[
                        {label:"Locked", percentage:tokenDistribution.lockedPercentage, value:simplifyBN(fromLamports(userAccount.lockedAmount)), color:"bg-purple-600"},
                        {label:"Unlocked", percentage:tokenDistribution.unlockedPercentage, value:simplifyBN(fromLamports(userTokenBalance)), color:"bg-purple-300"},
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

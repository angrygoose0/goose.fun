'use client'

import { ChangeEvent, useCallback, useMemo, useState, useEffect } from 'react'
import { useMemeProgram, useMetadataQuery, useBuySellTokenMutation, useAccountQuery, useCreateMemeToken, useProcessedAccountsQuery } from './meme-data-access'
import { useGetBalance, useGetTokenAccounts } from '../account/account-data-access';
import { InputView } from "../helper-ui";
import axios from "axios";
import toast from "react-hot-toast";
import { useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { FaTelegramPlane, FaTwitter, FaGlobe, } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { BN } from '@coral-xyz/anchor';
import { AccountBalance } from '../account/account-ui';
import { WalletButton } from '../solana/solana-provider'


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
        console.log("ready");

        // Await the mutation to ensure the process completes before showing success toast
        await createMemeToken.mutateAsync({ metadata, publicKey });

        // Show success message
        toast.success("Meme token created successfully!");
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
      <button onClick={openModal}>Open Modal</button>

      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-10"
          onClick={closeModal}
        >
          <div
            className="relative border-2 border-black bg-white shadow-lg p-6 z-15"
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

            <InputView
              name="Name"
              placeholder="name"
              clickhandle={(e) => handleFormFieldChange("name", e)}
            />
            <InputView
              name="Symbol"
              placeholder="symbol"
              clickhandle={(e) => handleFormFieldChange("symbol", e)}
            />
            <InputView
              name="Description"
              placeholder="description"
              clickhandle={(e) => handleFormFieldChange("description", e)}
            />
            <InputView
              name="twitter_link"
              placeholder="twitter_link"
              clickhandle={(e) => handleFormFieldChange("twitter_link", e)}
            />
            <InputView
              name="telegram_link"
              placeholder="telegram_link"
              clickhandle={(e) => handleFormFieldChange("telegram_link", e)}
            />
            <InputView
              name="website_link"
              placeholder="website_link"
              clickhandle={(e) => handleFormFieldChange("website_link", e)}
            />


            <button
              className="btn btn-xs lg:btn-md btn-primary"
              onClick={handleFormSubmit}
              disabled={!isFormValid}
            >
              Create Token
            </button>
          </div>
        </div >
      )}
    </div>
  );
}

export function MemeList() {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState("creation_time");
  const { processedAccountsQuery } = useProcessedAccountsQuery({ currentPage, sortBy });
  const { data: accounts, isLoading, error } = processedAccountsQuery;
  console.log("accounts data:", accounts);

  if (isLoading) {
    return <></>;
  }
  if (error) {
    return <></>;
  }

  if (!accounts || accounts.length < 1 || accounts == null) {
    return <></>;
  }

  //
  return (
    <div>
      <div className="space-y-6">

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6">
          {accounts.map((account) => (
            account != null ? (
              <TokenCard key={account.mint.toString()} account={account} />
            ) : null
          ))}
        </div>

        <div className="text-center">
          <h2 className="text-2xl">No memes :(</h2>
        </div>

      </div>

      <div className="flex justify-center mt-6 space-x-4">
        <button
          className="btn btn-secondary"
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
        >
          Previous
        </button>
        <span>Page {currentPage}</span>
        <button
          className="btn btn-secondary"
          onClick={() => setCurrentPage((prev) => prev + 1)}
          disabled={!accounts || accounts.length < 5} // Disable if no more pages
        >
          Next
        </button>
      </div>
    </div>
  );


}



function timeAgo(from: number): string {
  const now = Math.floor(Date.now() / 1000); // Current time in seconds
  const diff = now - from;

  if (diff < 60) return `${diff}s`; // Seconds
  if (diff < 3600) return `${Math.floor(diff / 60)}m`; // Minutes
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`; // Hours
  return `${Math.floor(diff / 86400)}d`; // Days
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


const lamportsToTokens = (lamports: number) => {
  return lamports / Math.pow(10, 9); // Convert lamports to tokens
};

const INITIAL_PRICE = 2.5 * 1_000_000; // 2.5 million tokens per SOL
const SOL_TO_LAMPORTS = 1_000_000_000;

// Conversion functions
const convertTokensToSol = (tokens: number): number => {
  return tokens / INITIAL_PRICE;
};

const convertSolToTokens = (sol: number): number => {
  return sol * INITIAL_PRICE;
};

const convertSolToLamports = (sol: number): number => {
  return sol * SOL_TO_LAMPORTS;
};

export function BalanceCard({ publicKey, mint, account, bondedTime, symbol, userLockedAmountBN, claimmableBN, tokenBalanceBN, tokenBalanceUi }: { publicKey: PublicKey, mint: PublicKey, account: PublicKey, bondedTime: BN, symbol: string, userLockedAmountBN: BN, claimmableBN: BN, tokenBalanceBN: BN, tokenBalanceUi: number }) {
  const { buySellToken } = useBuySellTokenMutation();

  const balanceQuery = useGetBalance({ address: publicKey })
  const solBalance = balanceQuery.data
    ? Math.round((balanceQuery.data / LAMPORTS_PER_SOL) * 100000) / 100000
    : 0;

  const totalTokens = tokenBalanceBN
    .add(userLockedAmountBN)
    .add(claimmableBN);

  const totalTokensNumber = totalTokens.toNumber();
  const lockedPercentage = totalTokensNumber > 0
    ? (userLockedAmountBN.toNumber() / totalTokensNumber) * 100
    : 0;
  const unlockedPercentage = totalTokensNumber > 0
    ? (tokenBalanceBN.toNumber() / totalTokensNumber) * 100
    : 0;
  const claimablePercentage = totalTokensNumber > 0
    ? (claimmableBN.toNumber() / totalTokensNumber) * 100
    : 0;

  const [amount, setAmount] = useState(0);
  const [showingSol, setShowingSol] = useState(true); // true for showing SOL, false for showing token
  const toggleSolOrToken = () => {
    setShowingSol((prevMode) => {
      const newMode = !prevMode;
      const convertedAmount = newMode
        ? convertTokensToSol(amount) // Convert Tokens to SOL
        : convertSolToTokens(amount); // Convert SOL to Tokens
      setAmountWithLimits(convertedAmount, newMode); // Use limits to ensure the value is valid
      return newMode; // Toggle the mode
    });
  };


  const setAmountWithLimits = (numericValue: number, showingSolOverride?: boolean) => {
    const useShowingSol = showingSolOverride !== undefined ? showingSolOverride : showingSol;

    if (numericValue < 0) {
      setAmount(0);
      return;
    }

    if (selectedAction === ActionType.Buy) {
      if (useShowingSol) {
        setAmount(Math.min(numericValue, solBalance));
      } else {
        setAmount(Math.min(numericValue, convertSolToTokens(solBalance)));
      }
    } else if (selectedAction === ActionType.Sell) {
      if (useShowingSol) {
        setAmount(Math.min(numericValue, convertTokensToSol(lamportsToTokens(userLockedAmountBN.toNumber()))));
      } else {
        setAmount(Math.min(numericValue, lamportsToTokens(userLockedAmountBN.toNumber())));
      }
    } else {
      setAmount(numericValue);
    }
  };

  const handleFormFieldChange = (event: { target: { value: any; }; }) => {
    const value = event.target.value;
    const numericValue = value === "" ? 0 : parseFloat(value); // raw value from user.
    setAmountWithLimits(numericValue);
  };



  const [selectedAction, setSelectedAction] = useState<ActionType>(ActionType.Buy);
  const handleActionChange = (action: ActionType) => {
    setSelectedAction(action);
  };

  const handleBuySellFormSubmit = useCallback(async () => {
    try {
      let amountSentToSolana: number;

      // Validate amount based on selected action
      if (selectedAction === ActionType.Buy) {
        const solRequired = showingSol ? amount : convertTokensToSol(amount);

        if (solRequired > solBalance) {
          throw new Error("SOL balance too low.");
        }

        amountSentToSolana = solRequired;
      } else if (selectedAction === ActionType.Sell) {
        const tokensRequired = showingSol ? convertSolToTokens(amount) : amount;

        if (new BN(tokensRequired).gt(userLockedAmountBN)) {
          throw new Error("You can't claim more than you invested.");
        }

        amountSentToSolana = showingSol ? -amount : -convertTokensToSol(amount);
      }
      else {
        throw new Error("coming soon");
      }

      // Perform the buy/sell operation
      await buySellToken.mutateAsync({ publicKey, amount: convertSolToLamports(amountSentToSolana), mint });
      toast.success("Success!");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "An error occurred.");
    }
  }, [publicKey, amount, showingSol, selectedAction, solBalance, userLockedAmountBN, mint]);


  return (
    <div
      key="right-top"
      className="border-2 border-black bg-white p-6 shadow-lg flex flex-col text-black text-lg"
      style={{
        gridRow: "1 / 2",
        gridColumn: "3 / 4",
      }}
    >
      <div className="flex mb-4">
        {bondedTime < new BN(0) ? (
          <>
            {/* Two buttons: Buy and Sell */}
            <button
              onClick={() => handleActionChange(ActionType.Buy)}
              className={`${selectedAction === ActionType.Buy
                ? "border-black bg-gray-300"
                : "border-gray-500 bg-white"
                } w-1/2 flex items-center justify-center px-4 py-2 text-sm font-medium border-2 text-black hover:bg-gray-100`}
            >
              <p>Buy</p>
            </button>

            <button
              onClick={() => handleActionChange(ActionType.Sell)}
              className={`${selectedAction === ActionType.Sell
                ? "border-black bg-gray-300"
                : "border-gray-500 bg-white"
                } w-1/2 flex items-center justify-center px-4 py-2 text-sm font-medium border-2 text-black hover:bg-gray-100`}
            >
              <p>Sell</p>
            </button>
          </>
        ) : (
          <>
            {/* Four buttons: Buy, Sell, Lock, and Claim */}
            <button
              onClick={() => handleActionChange(ActionType.RaydiumBuy)}
              className={`${selectedAction === ActionType.RaydiumBuy
                ? "border-black bg-gray-300"
                : "border-gray-500 bg-white"
                } w-1/4 flex items-center justify-center px-4 py-2 text-sm font-medium border-2 text-black hover:bg-gray-100`}
            >
              <p>Buy</p>
            </button>

            <button
              onClick={() => handleActionChange(ActionType.RaydiumSell)}
              className={`${selectedAction === ActionType.RaydiumSell
                ? "border-black bg-gray-300"
                : "border-gray-500 bg-white"
                } w-1/4 flex items-center justify-center px-4 py-2 text-sm font-medium border-2 text-black hover:bg-gray-100`}
            >
              <p>Sell</p>
            </button>

            <button
              onClick={() => handleActionChange(ActionType.Lock)}
              className={`${selectedAction === ActionType.Lock
                ? "border-black bg-gray-300"
                : "border-gray-500 bg-white"
                } w-1/4 flex items-center justify-center px-4 py-2 text-sm font-medium border-2 text-black hover:bg-gray-100`}
            >
              <p>Lock</p>
            </button>

            <button
              onClick={() => handleActionChange(ActionType.Claim)}
              className={`${selectedAction === ActionType.Claim
                ? "border-black bg-gray-300"
                : "border-gray-500 bg-white"
                } w-1/4 flex items-center justify-center px-4 py-2 text-sm font-medium border-2 text-black hover:bg-gray-100`}
            >
              <p>Claim</p>
            </button>
          </>
        )}
      </div>


      <div className="mb-4">
        <div className="flex items-baseline space-x-2">
          <div className="text-sm font-semibold text-black">{solBalance} SOL</div>
          <div className="text-sm text-gray-500">~ $499</div>
        </div>

        <div className="mt-1 h-2 border-2 border-black bg-white relative">
          <div
            className="absolute top-0 left-0 h-full bg-black"
            style={{ width: "100%" }}
          ></div>
        </div>
      </div>

      <div className="flex flex-col space-y-2 mt-2">
        {bondedTime < new BN(0) ? (
          <>
            {/* When bondedTime is negative so hasnt bonded */}
            <div className="flex items-baseline space-x-2">
              <div className="text-sm font-semibold text-black">
                {lamportsToTokens(userLockedAmountBN.toNumber())} {symbol.toString()}
              </div>
              <div className="text-sm text-gray-500">(Total)</div>
            </div>

            <div className="h-2 border-2 border-black bg-white relative">
              <div
                className="absolute top-0 left-0 h-full bg-purple-500"
                style={{ width: "100%" }}
              ></div>
            </div>

            <div className="flex justify-between text-xs mt-1">
              <div className="flex items-center space-x-1">
                <div className="h-2 w-2 bg-purple-500 rounded-full"></div>
                <span className="text-purple-600">
                  Invested: {lamportsToTokens(userLockedAmountBN.toNumber())}
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* When bondedTime is positive */}
            <div className="flex items-baseline space-x-2">
              <div className="text-sm font-semibold text-black">
                {totalTokens.toString()} {symbol.toString()}
              </div>
              <div className="text-sm text-gray-500">(Total)</div>
            </div>

            <div className="h-2 border-2 border-black bg-white relative">
              <div
                className="absolute top-0 left-0 h-full bg-gray-400"
                style={{ width: `${lockedPercentage}%` }}
              ></div>
              <div
                className="absolute top-0 left-0 h-full bg-blue-500"
                style={{
                  width: `${unlockedPercentage}%`,
                  marginLeft: `${lockedPercentage}%`,
                }}
              ></div>
              <div
                className="absolute top-0 left-0 h-full bg-green-500"
                style={{
                  width: `${claimablePercentage}%`,
                  marginLeft: `${lockedPercentage + unlockedPercentage}%`,
                }}
              ></div>
            </div>

            <div className="flex justify-between text-xs mt-1">
              <div className="flex items-center space-x-1">
                <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
                <span className="text-gray-600">Locked: {userLockedAmountBN.toNumber()}</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                <span className="text-blue-600">
                  Unlocked: {tokenBalanceUi}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <span className="text-green-600">Claimable: {claimmableBN.toNumber()}</span>
              </div>
            </div>
          </>
        )}
      </div>


      <div className="relative flex items-center mb-2 mt-2">
        <input
          type="number"
          value={amount || ""}
          className="w-full border-2 border-gray-200 p-2 pr-16 text-sm focus:outline-none focus:border-black appearance-none"
          placeholder={solBalance?.toString()}
          onChange={handleFormFieldChange}

        />
        <button
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-gray-200 text-gray-600 text-sm px-4 py-1 rounded focus:outline-none"
          onClick={toggleSolOrToken}
        >
          {showingSol ? "Mode: SOL (Swap to Tokens)" : "Mode: Tokens (Swap to SOL)"}
        </button>

      </div>

      <p>{amount}</p>

      <div className="flex space-x-4 mb-4">
        {selectedAction === ActionType.Buy ? (
          <>
            <button
              className="w-8 h-6 border border-black bg-white text-xs text-black hover:bg-gray-100 flex items-center justify-center"
              onClick={() => setAmountWithLimits(0.1)}
            >
              0.1
            </button>
            <button
              className="w-8 h-6 border border-black bg-white text-xs text-black hover:bg-gray-100 flex items-center justify-center"
              onClick={() => setAmountWithLimits(1)}
            >
              1
            </button>
            <button
              className="w-8 h-6 border border-black bg-white text-xs text-black hover:bg-gray-100 flex items-center justify-center"
              onClick={() => setAmountWithLimits(2)}
            >
              2
            </button>
          </>
        ) : (
          <>
            <button
              className="w-8 h-6 border border-black bg-white text-xs text-black hover:bg-gray-100 flex items-center justify-center"
              onClick={() => setAmountWithLimits(0.1)}
            >
              0.1
            </button>
            <button
              className="w-8 h-6 border border-black bg-white text-xs text-black hover:bg-gray-100 flex items-center justify-center"
              onClick={() => setAmountWithLimits(0.1)}
            >
              0.1
            </button>
            <button
              className="w-8 h-6 border border-black bg-white text-xs text-black hover:bg-gray-100 flex items-center justify-center"
              onClick={() => setAmountWithLimits(0.1)}
            >
              0.1
            </button>
          </>
        )}
      </div>

      <button
        className="w-full px-4 py-2 text-sm font-medium border-2 border-black bg-white text-black hover:bg-gray-100"
        onClick={handleBuySellFormSubmit}
      >
        Transact
      </button>
    </div>
  );
}



export function TokenCard({ account }: { account: any }) {
  const { publicKey } = useWallet()

  const [isVisible, setIsVisible] = useState(true);
  const [hideLeft, setHideLeft] = useState(false);
  const [hideRight, setHideRight] = useState(false);

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

  // ignore this, as i've specified that memeAccountQuery is for the memeaccount, not useraccount.
  const { dev, mint, lockedAmount, creationTime, bondedTime } = account;
  const { metadataQuery } = useMetadataQuery({ mint });
  const symbol = metadataQuery.data?.symbol || "";
  const name = metadataQuery.data?.name || "";
  const image = metadataQuery.data?.image || "";
  const telegram_link = metadataQuery.data?.telegram_link || "";
  const website_link = metadataQuery.data?.website_link || "";
  const twitter_link = metadataQuery.data?.twitter_link || "";
  const description = metadataQuery.data?.description || "";



  let userLockedAmountBN = new BN(0);
  let claimmableBN = new BN(0);
  let tokenBalanceBN = new BN(0);
  let tokenBalanceUi = 0;

  if (publicKey != null) {
    const { userAccountQuery } = useAccountQuery({ publicKey, mint });
    if (userAccountQuery.data !== undefined) {
      userLockedAmountBN = userAccountQuery.data.lockedAmount;
      claimmableBN = userAccountQuery.data.claimmable;
    }

    const { getSpecificTokenBalance } = useGetTokenAccounts({
      address: publicKey,
      mint: mint,
    });
    if (getSpecificTokenBalance.data !== undefined) {
      tokenBalanceBN = new BN(getSpecificTokenBalance.data.balance);
      tokenBalanceUi = getSpecificTokenBalance.data.uiAmount;
    }
  }







  /*
  const globalPercentageBN = lockedAmount.isZero()
    ? new BN(0) // If lockedAmount is 0, percentage is 0
    : bondedTime < new BN(0)
      ? lockedAmount
        .div(new BN(800_000_000 * 10 ** 9)) // For negative bondedTime
        .mul(new BN(100)) // Convert to percentage
      : lockedAmount
        .div(new BN(1_000_000_000 * 10 ** 9)) // For positive bondedTime
        .mul(new BN(100)); // Convert to percentage

  const globalPercentage = parseFloat(globalPercentageBN.toString()) / (10 ** 9); // Adjust precision
  const formattedPercentage = `${globalPercentage.toFixed(2)}%`; // Format to 2 decimal places
  */

  const renderGridCards = () => {
    const cards = [];

    if (!hideLeft) {
      cards.push(
        <div
          key="left-top"
          className="border-2 border-black bg-white p-6 shadow-lg flex flex-col text-black text-lg"
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
            {[
              { type: "Credit", amount: "$120.00", date: "2024-11-30", txn: "TXN12345" },
              { type: "Debit", amount: "$50.00", date: "2024-11-29", txn: "TXN12346" },
              { type: "Credit", amount: "$200.00", date: "2024-11-28", txn: "TXN12347" },
              { type: "Debit", amount: "$30.00", date: "2024-11-27", txn: "TXN12348" },
              { type: "Credit", amount: "$500.00", date: "2024-11-26", txn: "TXN12349" },
              { type: "Debit", amount: "$20.00", date: "2024-11-25", txn: "TXN12350" },
              { type: "Credit", amount: "$80.00", date: "2024-11-24", txn: "TXN12351" },
              { type: "Debit", amount: "$15.00", date: "2024-11-23", txn: "TXN12352" },
              { type: "Credit", amount: "$120.00", date: "2024-11-30", txn: "TXN12345" },
              { type: "Credit", amount: "$120.00", date: "2024-11-30", txn: "TXN12345" },
              { type: "Credit", amount: "$120.00", date: "2024-11-30", txn: "TXN12345" },
              { type: "Credit", amount: "$120.00", date: "2024-11-30", txn: "TXN12345" },
              { type: "Credit", amount: "$120.00", date: "2024-11-30", txn: "TXN12345" },

            ].map((entry, index) => (
              <div
                key={index}
                className="flex justify-between items-center border-b pb-2"
              >
                <div className="text-sm font-medium">{entry.type}</div>
                <div className="text-sm">{entry.amount}</div>
                <div className="text-sm text-gray-600">{entry.date}</div>
                <div className="text-sm text-gray-400">{entry.txn}</div>
              </div>
            ))}
          </div>
        </div>
      );
      cards.push(
        <div
          key="left-bottom"
          className="border-2 border-black bg-white p-6 shadow-lg flex flex-col text-black text-lg"
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
            {[
              { rank: 1, percentage: "40%", wallet: "0xA1B2...C3D4" },
              { rank: 2, percentage: "30%", wallet: "0xE5F6...G7H8" },
              { rank: 3, percentage: "20%", wallet: "0xI9J0...K1L2" },
              { rank: 4, percentage: "5%", wallet: "0xM3N4...O5P6" },
              { rank: 5, percentage: "5%", wallet: "0xQ7R8...S9T0" },
              { rank: 1, percentage: "40%", wallet: "0xA1B2...C3D4" },
              { rank: 2, percentage: "30%", wallet: "0xE5F6...G7H8" },
              { rank: 3, percentage: "20%", wallet: "0xI9J0...K1L2" },
              { rank: 4, percentage: "5%", wallet: "0xM3N4...O5P6" },
              { rank: 5, percentage: "5%", wallet: "0xQ7R8...S9T0" },

            ].map((holder, index) => (
              <div
                key={index}
                className="flex justify-between items-center border-b pb-2"
              >
                <div className="text-sm font-medium"># {holder.rank}</div>
                <div className="text-sm">{holder.percentage}</div>
                <div className="text-sm text-gray-600">{holder.wallet}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    cards.push(
      <div
        key="middle-top"
        className="relative border-2 border-black bg-white shadow-lg p-6"
        style={{
          gridRow: "1 / 2", // Adjust position for compact view
          gridColumn: hideRight ? "1 / 4" : (hideLeft ? "1 / 3" : "2 / 3")
        }}
      >
        <div className="absolute top-2 right-2 text-gray-500 text-xs">{timeAgo(creationTime.toNumber())} ago</div>
        <div className="flex items-start mb-2">
          <img
            src={image}
            alt="Icon"
            className="w-12 h-12 border-2 border-black object-contain"
          />
          <div className="ml-4">
            <h2 className="text-xl font-bold">
              <span className="font-bold">{symbol}</span>
              <span className="font-normal"> | {name}</span>
            </h2>
            <p className="text-gray-700 text-sm mt-2">
              {description}
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          {/* Telegram Icon */}
          {telegram_link && (
            <a
              href={telegram_link}
              target="_blank"
              rel="noopener noreferrer"
              className="w-5 h-5 text-gray-400 hover:text-blue-500"
            >
              <FaTelegramPlane />
            </a>
          )}

          {/* Twitter (X) Icon */}
          {twitter_link && (
            <a
              href={twitter_link}
              target="_blank"
              rel="noopener noreferrer"
              className="w-5 h-5 text-gray-400 hover:text-blue-400"
            >
              <FaXTwitter />
            </a>
          )}

          {/* Website Icon */}
          {website_link && (
            <a
              href={website_link}
              target="_blank"
              rel="noopener noreferrer"
              className="w-5 h-5 text-gray-400 hover:text-green-500"
            >
              <FaGlobe />
            </a>
          )}
        </div>
        <p className="text-gray-700 text-sm mt-4"> | 20k</p>
        <div className="mt-1 h-2 border-2 border-black bg-white relative">
          <div
            className="absolute top-0 left-0 h-full bg-black"
          //style={{ width: `${globalPercentage}%` }}
          ></div>
        </div>
        <div className="flex justify-start items-center text-gray-500 mt-2">
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

        {publicKey != null ? (
          <div className="flex flex-col space-y-2 mt-4">
            {/* Total GS */}
            <div className="flex items-baseline space-x-2">
              <div className="text-sm font-semibold text-black">50,000 {symbol}</div>
              <div className="text-sm text-gray-500">(Total)</div>
            </div>

            {/* Color-Coded Bar */}
            <div className="mt-1 h-2 border-2 border-black bg-white relative">
              {/* Locked Amount */}
              <div
                className="absolute top-0 left-0 h-full bg-gray-400"
                style={{ width: "50%" }} // Adjust dynamically
              ></div>
              {/* Unlocked Amount */}
              <div
                className="absolute top-0 left-0 h-full bg-blue-500"
                style={{ width: "30%", marginLeft: "50%" }} // Adjust dynamically
              ></div>
              {/* Claimable Amount */}
              <div
                className="absolute top-0 left-0 h-full bg-green-500"
                style={{ width: "20%", marginLeft: "80%" }} // Adjust dynamically
              ></div>
            </div>

            {/* Labels with Color Codes */}
            <div className="flex justify-between text-xs mt-1">
              <div className="flex items-center space-x-1">
                <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
                <span className="text-gray-600">Locked: {userLockedAmountBN.toNumber()}</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                <span className="text-blue-600">Unlocked: {tokenBalanceUi}</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <span className="text-green-600">Claimable: {claimmableBN.toNumber()}</span>
              </div>
            </div>
          </div>
        ) : null}

      </div>
    );
    cards.push(
      <div
        key="middle-bottom"
        className="border-2 border-black bg-white shadow-lg p-4 flex items-center justify-center"
        style={{
          gridRow: "2 / 6", // Adjust position for compact view
          gridColumn: hideRight ? "1 / 4" : (hideLeft ? "1 / 3" : "2 / 3")
        }}
      >
        <img
          src="https://via.placeholder.com/300x400"
          alt="Large Placeholder"
          className="w-full h-full object-cover border border-black"
        />
      </div>
    );

    if (!hideRight) {
      cards.push(
        publicKey ? (
          <BalanceCard publicKey={publicKey} mint={mint} account={account} bondedTime={bondedTime} symbol={symbol} userLockedAmountBN={userLockedAmountBN} claimmableBN={claimmableBN} tokenBalanceBN={tokenBalanceBN} tokenBalanceUi={tokenBalanceUi} />
        ) : (
          <div
            key="right-top"
            className="border-2 border-black bg-white p-6 shadow-lg flex flex-col text-black text-lg"
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
          className="border-2 border-black bg-white p-6 shadow-lg flex flex-col text-black text-lg"
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
                  <span className="text-xs text-gray-600">{chat.time}</span>
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
            <input
              type="string"
              className="w-full border-2 border-gray-200 p-2 text-sm focus:outline-none focus:border-black"
              placeholder="Type your message..."
            />
            <button
              type="submit"
              className="ml-2 bg-white text-black px-4 py-2 border-2 border-black text-xs hover:bg-gray-200"
            >
              Send
            </button>
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
          <div className="relative border-2 border-black bg-white shadow-lg p-6">
            <div className="absolute top-2 right-2 text-gray-500 text-xs">
              {timeAgo(creationTime.toNumber())} ago
            </div>
            <div className="flex items-start mb-2">
              <img
                src={image}
                alt="Icon"
                className="w-12 h-12 border-2 border-black object-contain"
              />
              <div className="ml-4">
                <h2 className="text-xl font-bold">
                  <span className="font-bold">{symbol}</span>
                  <span className="font-normal"> {name}</span>
                </h2>
                <p className="text-gray-700 text-sm mt-2">
                  {description}
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              {/* Telegram Icon */}
              {telegram_link && (
                <a
                  href={telegram_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-5 h-5 text-gray-400 hover:text-blue-500"
                >
                  <FaTelegramPlane />
                </a>
              )}

              {/* Twitter (X) Icon */}
              {twitter_link && (
                <a
                  href={twitter_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-5 h-5 text-gray-400 hover:text-blue-400"
                >
                  <FaXTwitter />
                </a>
              )}

              {/* Website Icon */}
              {website_link && (
                <a
                  href={website_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-5 h-5 text-gray-400 hover:text-green-500"
                >
                  <FaGlobe />
                </a>
              )}
            </div>
            <p className="text-gray-700 text-sm mt-4"> | 20k</p>
            <div className="mt-1 h-2 border-2 border-black bg-white relative">
              <div
                className="absolute top-0 left-0 h-full bg-black"
              ></div>
            </div>
            <div className="flex justify-start items-center text-gray-500 mt-2">
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
              <div className="flex flex-col space-y-2 mt-4">
                {/* Total GS */}
                <div className="flex items-baseline space-x-2">
                  <div className="text-sm font-semibold text-black">50,000 {symbol}</div>
                  <div className="text-sm text-gray-500">(Total)</div>
                </div>

                {/* Color-Coded Bar */}
                <div className="mt-1 h-2 border-2 border-black bg-white relative">
                  {/* Locked Amount */}
                  <div
                    className="absolute top-0 left-0 h-full bg-gray-400"
                    style={{ width: "50%" }} // Adjust dynamically
                  ></div>
                  {/* Unlocked Amount */}
                  <div
                    className="absolute top-0 left-0 h-full bg-blue-500"
                    style={{ width: "30%", marginLeft: "50%" }} // Adjust dynamically
                  ></div>
                  {/* Claimable Amount */}
                  <div
                    className="absolute top-0 left-0 h-full bg-green-500"
                    style={{ width: "20%", marginLeft: "80%" }} // Adjust dynamically
                  ></div>
                </div>

                {/* Labels with Color Codes */}
                <div className="flex justify-between text-xs mt-1">
                  <div className="flex items-center space-x-1">
                    <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
                    <span className="text-gray-600">Locked: {userLockedAmountBN.toNumber()}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                    <span className="text-blue-600">Unlocked: {tokenBalanceUi}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <span className="text-green-600">Claimmable: {claimmableBN.toNumber()}</span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

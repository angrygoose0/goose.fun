'use client'

import { ChangeEvent, useCallback, useMemo, useState, useEffect } from 'react'
import { useMemeProgram, useMemeProgramAccount, } from './meme-data-access'
import { InputView } from "../input";
import axios from "axios";
import toast from "react-hot-toast";
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

export function MemeCreate() {

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

  const { createMemeToken } = useMemeProgram();

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

      {token.image ? (
        <img src={token.image} alt="token" />
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
    </div >

  );
}

export function MemeList() {
  const { paginatedKeys, getProgramAccount } = useMemeProgram();

  // Show loading spinner while fetching the program account
  if (getProgramAccount.isLoading) {
    return <span className="loading loading-spinner loading-lg"></span>;
  }

  // Show a message if no program account is found
  if (!getProgramAccount.data?.value) {
    return (
      <div className="alert alert-info flex justify-center">
        <span>
          Program account not found. Make sure you have deployed the program and
          are on the correct cluster.
        </span>
      </div>
    );
  }
  // Render memes if `paginatedKeys` exist
  return (
    <div className="space-y-6">
      {paginatedKeys.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-4">
          {paginatedKeys.map((publicKey) => (
            <MemeCard key={publicKey.toString()} account={publicKey} />
          ))}
        </div>
      ) : (
        <div className="text-center">
          <h2 className="text-2xl">No memes :(</h2>
        </div>
      )}
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

function MemeCard({ account }: { account: PublicKey }) {
  const { accountQuery, metadataQuery } = useMemeProgramAccount({
    account,
  })

  if (accountQuery.isLoading || metadataQuery.isLoading) {
    return <span className="loading loading-spinner loading-lg"></span>;
  }

  if (accountQuery.isError || !accountQuery.data || metadataQuery.isError || !metadataQuery.data) {
    return <div className="text-error">Error loading meme account</div>;
  }

  const metadata = metadataQuery.data
  const { dev, mint, lockedAmount, unlockedAmount, creationTime, bondedTime } = accountQuery.data;

  return (
    <div className="card card-bordered border-base-300 border-4 text-neutral-content">
      {mint.toString()}

      <h3>Raw Metadata JSON:</h3>
      <pre>{JSON.stringify(metadata, null, 2)}</pre>
    </div>
  );
};






export function TokenCard({ name }: { name: string }) {
  const [isVisible, setIsVisible] = useState(true);
  const [hideLeft, setHideLeft] = useState(false);
  const [hideRight, setHideRight] = useState(false);

  // Listen for window resize to determine layout
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
        <div className="absolute top-2 right-2 text-gray-500 text-xs">30s ago</div>
        <div className="flex items-start mb-2">
          <img
            src="https://via.placeholder.com/80"
            alt="Icon"
            className="w-15 h-15 border border-black"
          />
          <div className="ml-4">
            <h2 className="text-xl font-bold">
              <span className="font-bold">User Name</span>
              <span className="font-normal"> | goose</span>
            </h2>
            <p className="text-gray-700 text-sm mt-2">
              This is a simple card with sharp edges, a black border, and a
              progress bar.
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 24 24"
            className="w-5 h-5 text-gray-400"
          >
            <rect width="24" height="24" fill="currentColor" />
          </svg>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 24 24"
            className="w-5 h-5 text-gray-400"
          >
            <rect width="24" height="24" fill="currentColor" />
          </svg>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
            viewBox="0 0 24 24"
            className="w-5 h-5 text-gray-400"
          >
            <rect width="24" height="24" fill="currentColor" />
          </svg>
        </div>
        <p className="text-gray-700 text-sm mt-4">50% | 20k</p>
        <div className="mt-1 h-2 border-2 border-black bg-white relative">
          <div
            className="absolute top-0 left-0 h-full bg-black"
            style={{ width: "66%" }}
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
        <div className="flex flex-col space-y-2 mt-4">
          {/* Total GS */}
          <div className="flex items-baseline space-x-2">
            <div className="text-sm font-semibold text-black">50,000 GS</div>
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
              <span className="text-gray-600">Locked: 25,000</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
              <span className="text-blue-600">Unlocked: 15,000</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="h-2 w-2 bg-green-500 rounded-full"></div>
              <span className="text-green-600">Claimable: 10,000</span>
            </div>
          </div>
        </div>
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
        <div
          key="right-top"
          className="border-2 border-black bg-white p-6 shadow-lg flex flex-col text-black text-lg"
          style={{
            gridRow: "1 / 2",
            gridColumn: "3 / 4",
          }}
        >
          <div className="flex mb-4">
            {/* Buy Placeholder */}
            <button
              className="w-1/4 flex items-center justify-center px-4 py-2 text-sm font-medium border-2 border-black bg-white text-black hover:bg-gray-100"
            >
              <p>Buy</p>
            </button>

            {/* Sell Placeholder */}
            <button
              className="w-1/4 flex items-center justify-center px-4 py-2 text-sm font-medium border-2 border-grey-500 bg-white text-black hover:bg-gray-100"
            >
              <p>Sell</p>
            </button>
            {/* Buy Placeholder */}
            <button
              className="w-1/4 flex items-center justify-center px-4 py-2 text-sm font-medium border-2 border-black bg-white text-black hover:bg-gray-100"
            >
              <p>Lock</p>
            </button>

            <button
              className="w-1/4 flex items-center justify-center px-4 py-2 text-sm font-medium border-2 border-grey-500 bg-white text-black hover:bg-gray-100"
            >Claim
            </button>
          </div>

          {/* SOL Balance */}
          <div className="mb-4">
            <div className="flex items-baseline space-x-2">
              <div className="text-sm font-semibold text-black">100 SOL</div>
              <div className="text-sm text-gray-500">~ $499</div>
            </div>

            <div className="mt-1 h-2 border-2 border-black bg-white relative">
              <div
                className="absolute top-0 left-0 h-full bg-black"
                style={{ width: "80%" }} // Example: SOL balance usage as 80%
              ></div>
            </div>
          </div>



          {/* GS Balance */}
          <div className="flex flex-col space-y-2 mb-4">
            <div className="flex items-baseline space-x-2">
              <div className="text-sm font-semibold text-black">50,000 GS</div>
              <div className="text-sm text-gray-500">(Total)</div>
            </div>

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
                <span className="text-gray-600">Locked: 25,000</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                <span className="text-blue-600">Unlocked: 15,000</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <span className="text-green-600">Claimable: 10,000</span>
              </div>
            </div>

          </div>


          {/* Input with Icon */}
          <div className="relative flex items-center mb-2">
            <input
              type="number"
              className="w-full border-2 border-gray-200 p-2 text-sm focus:outline-none focus:border-black"
              placeholder="Enter amount"
            />
          </div>

          {/* Percentage Buttons */}
          <div className="flex space-x-2 mb-4">
            <button className="px-3 py-0.5 border border-black bg-white text-xs text-black hover:bg-gray-100">
              50%
            </button>
            <button className="px-3 py-0.5 border border-black bg-white text-xs text-black hover:bg-gray-100">
              100%
            </button>
          </div>

          {/* Transact Button */}
          <button className="w-full px-4 py-2 text-sm font-medium border-2 border-black bg-white text-black hover:bg-gray-100">
            Transact
          </button>
        </div>
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
              30s ago
            </div>
            <div className="flex items-start mb-2">
              <img
                src="https://via.placeholder.com/80"
                alt="Icon"
                className="w-15 h-15 border border-black"
              />
              <div className="ml-4">
                <h2 className="text-xl font-bold">
                  <span className="font-bold">{name}</span>
                  <span className="font-normal"> | goose</span>
                </h2>
                <p className="text-gray-700 text-sm mt-2">
                  This is a simple card with sharp edges, a black border, and a
                  progress bar.
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
                viewBox="0 0 24 24"
                className="w-5 h-5 text-gray-400"
              >
                <rect width="24" height="24" fill="currentColor" />
              </svg>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
                viewBox="0 0 24 24"
                className="w-5 h-5 text-gray-400"
              >
                <rect width="24" height="24" fill="currentColor" />
              </svg>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
                viewBox="0 0 24 24"
                className="w-5 h-5 text-gray-400"
              >
                <rect width="24" height="24" fill="currentColor" />
              </svg>
            </div>
            <p className="text-gray-700 text-sm mt-4">50% | 20k</p>
            <div className="mt-1 h-2 border-2 border-black bg-white relative">
              <div
                className="absolute top-0 left-0 h-full bg-black"
                style={{ width: "66%" }}
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
            <div className="flex flex-col space-y-2 mt-4">
              {/* Total GS */}
              <div className="flex items-baseline space-x-2">
                <div className="text-sm font-semibold text-black">50,000 GS</div>
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
                  <span className="text-gray-600">Locked: 25,000</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                  <span className="text-blue-600">Unlocked: 15,000</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span className="text-green-600">Claimable: 10,000</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

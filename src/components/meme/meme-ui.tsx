'use client'

import { ChangeEvent, useCallback, useMemo, useState } from 'react'
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
  const { accounts, getProgramAccount } = useMemeProgram()

  if (getProgramAccount.isLoading) {
    return <span className="loading loading-spinner loading-lg"></span>
  }
  if (!getProgramAccount.data?.value) {
    return (
      <div className="alert alert-info flex justify-center">
        <span>Program account not found. Make sure you have deployed the program and are on the correct cluster.</span>
      </div>
    )
  }
  return (
    <div className={'space-y-6'}>
      {accounts.isLoading ? (
        <span className="loading loading-spinner loading-lg"></span>
      ) : accounts.data?.length ? (
        <div className="grid md:grid-cols-2 gap-4">
          {accounts.data?.map((account) => (
            <MemeCard key={account.publicKey.toString()} account={account.publicKey} />
          ))}
        </div>
      ) : (
        <div className="text-center">
          <h2 className={'text-2xl'}>No memes :(</h2>
        </div>
      )}
    </div>
  )
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

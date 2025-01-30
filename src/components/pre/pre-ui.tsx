import { useWallet } from "@solana/wallet-adapter-react";
import Image from 'next/image';
import { PrimaryBar, PrimaryButton, PrimaryInput } from "../ui/extra-ui/button";
import { BILLION, fromLamportsDecimals, ToLamportsDecimals, ZERO, calculatePercentage, EMPTY_PUBLIC_KEY, SOL_MINT, fromLamports, simplifyBN, SOL_GOAL_BEFORE_BONDING, MINT_SUPPLY} from "../meme/meme-helper-functions";
import BN from "bn.js";
import { useCallback, useEffect, useState } from "react";
import { useGetBalance, useGetTokenAccounts, useGetTokenBalance } from "../account/account-data-access";
import toast from "react-hot-toast";
import { useSolPriceQuery } from "../solana/solana-data-access";
import { WalletButton } from "../solana/solana-provider";
import { PublicKey } from "@solana/web3.js";
import {useBuyTokenMutation, useLockTokenMutation, useMemeAccountQuery, useMetadataQuery, useUserAccountQuery } from "../meme/meme-data-access";
import { useInitRaydiumSdk, useRaydiumPoolQuery } from "../raydium/raydium-data-access";
import { ActionType } from "../meme/meme-helper-functions"
import { ApiV3PoolInfoStandardItemCpmm, CpmmKeys, CpmmRpcData } from "@raydium-io/raydium-sdk-v2";


export function PreCard() {
    const { publicKey } = useWallet();
    const accountKey = new PublicKey("BP3tpDPF3uMhKReeUi3ffUtVANMFXU9iqBx1wZuFXYce");

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


    const { memeAccountQuery } = useMemeAccountQuery({ accountKey });

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

    const { metadataQuery } = useMetadataQuery({
      mint: memeAccount.mint,
    });

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
    
    const [userAccount, setUserAccount] = useState<{
        lockedAmount: BN;
    }>({
        lockedAmount: ZERO,
    });

    const { userAccountQuery } = useUserAccountQuery({ publicKey: publicKey || EMPTY_PUBLIC_KEY, mint:memeAccount.mint });

    useEffect(() => {
      if (userAccountQuery.data) {
        const { lockedAmount } = userAccountQuery.data;
        setUserAccount({ lockedAmount});
      }
    }, [userAccountQuery.data,]);



    const [userTokenBalance, setUserTokenBalance] = useState(ZERO);

    const { getSpecificTokenBalance } = useGetTokenBalance({
      address: publicKey || EMPTY_PUBLIC_KEY,
      mint: memeAccount.mint,
    });
    useEffect(() => {
      if (getSpecificTokenBalance.data) {
        const unlockedAmount = new BN(getSpecificTokenBalance.data.balance || ZERO);
        setUserTokenBalance(unlockedAmount);
      }
    }, [getSpecificTokenBalance.data]);

    const [solBalance, setSolBalance] = useState(ZERO);
    const {balanceQuery} = useGetBalance({ address: publicKey })
    useEffect(() => {
      if (balanceQuery.data) {
        setSolBalance(new BN(balanceQuery.data));
      }
    }, [balanceQuery.data]);
    
    const [solPrice, setSolPrice] = useState(0); //price per sol
    const {solPriceQuery} = useSolPriceQuery();

    

    useEffect(() => {
      if (solPriceQuery.data) {
        setSolPrice(solPriceQuery.data)
      }
    }, [solPriceQuery.data]);

    const [tokenPrice, setTokensPerSol] = useState(ZERO); // tokens per sol

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

    const [raydiumPoolData, setRaydiumPoolData] = useState<{
      poolInfo: ApiV3PoolInfoStandardItemCpmm | null;
      poolKeys: CpmmKeys | null;
      rpcData: CpmmRpcData | null;
    }>({
      poolInfo: null,
      poolKeys: null,
      rpcData: null,
    });
    
    const { initRaydiumSdk } = useInitRaydiumSdk({ loadToken: true });
    const {raydiumPoolQuery, raydiumSwap} = useRaydiumPoolQuery({poolId: memeAccount.poolId});

    useEffect(() => {
      if (raydiumPoolQuery.data) {
        /*
        setRaydiumPoolData({
          poolInfo: raydiumPoolQuery.data.poolInfo,
          poolKeys: raydiumPoolQuery.data.poolKeys,
          rpcData: raydiumPoolQuery.data.rpcData,
        });
        */
        setTokensPerSol(new BN(raydiumPoolQuery.data.poolInfo.price));
      }
    }, [raydiumPoolQuery.data]);
    

    
    const totalTokens = userAccount.lockedAmount.add(userTokenBalance)
    const tokenDistribution = {
      lockedPercentage: calculatePercentage(userAccount.lockedAmount, totalTokens),
      unlockedPercentage: calculatePercentage(userTokenBalance, totalTokens),
    };

    const divisor = (memeAccount.bondedTime.lt(ZERO) && memeAccount.creationTime.gte(ZERO)) ? SOL_GOAL_BEFORE_BONDING : MINT_SUPPLY;
    const globalPercentage = calculatePercentage(memeAccount.lockedAmount, divisor);



    const [selectedAction, setSelectedAction] = useState<ActionType>(ActionType.Buy);

    useEffect(() => {
      if (memeAccount.bondedTime.lt(ZERO) && memeAccount.creationTime.gte(ZERO)) {
        handleActionChange(ActionType.Buy);
      } else {
        handleActionChange(ActionType.RaydiumBuy);
      }
    }, [memeAccount.bondedTime, memeAccount.creationTime]);

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

      
    
    const {buyToken} = useBuyTokenMutation();
    const {lockToken} = useLockTokenMutation();
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
      <div className="max-w-4xl mx-auto mt-10">
        <div className="relative dualbox p-6">
          <div className="flex items-start mb-2">
            <Image
              src={memeMetadata.image}
              alt="Icon"
              width={54} // Specify width and height for the image
              height={54}
              className="dualbox object-contain"
            />
    
            <div className="ml-4">
              <h2 className="text-xl font-bold">
                <span className="font-bold mr-2">{memeMetadata.symbol}</span>
                <span className="font-normal">
                  {memeMetadata.name}
                  <span className="text-gray-500 dark:text-white text-xs ml-2">{memeAccount.mint.toString()}</span>
                </span>
              </h2>
              <p className="text-gray-500 dark:text-white text-sm mt-2">
                  {memeMetadata.description}
              </p>
            </div>
          </div>
          <div className="flex flex-col space-y-2 mt-2">
            <div className="flex items-baseline space-x-2">
              <div className="text-sm font-semibold">{globalPercentage}%</div>
              <div className="text-sm text-gray-500 dark:text-white">
                ~ $
                {(memeAccount.bondedTime.lt(ZERO) && memeAccount.creationTime.gte(ZERO)) ? (solToUsd(memeAccount.lockedAmount)): tokensToUsd(memeAccount.lockedAmount).toString()}
              </div>
            </div>
    
            <PrimaryBar
              extraCss="mt-1 w-[820px]"
              values={[
                  { label: `${(memeAccount.bondedTime.lt(ZERO) && memeAccount.creationTime.gte(ZERO)) ? "SOL" : memeMetadata.symbol}`, percentage: globalPercentage, value: simplifyBN(fromLamports(memeAccount.lockedAmount)), color: "bg-black dark:bg-white" },
              ]}
              labels={true}
            />
          </div>
                    
          {publicKey != null && !userAccount.lockedAmount.eq(ZERO) ? (
                        
            <>
                {!(memeAccount.bondedTime.lt(ZERO) && memeAccount.creationTime.gte(ZERO)) ? ( //bonded or on pump
                    <div className="flex flex-col space-y-2 mt-8">
                        <div className="text-sm font-semibold">User balance:</div>
                        {/* When bondedTime is negative so hasn't bonded */}
                        <div className="flex items-baseline space-x-2">
                            <div className="text-sm font-semibold">
                                {simplifyBN(fromLamports(totalTokens))} {memeMetadata.symbol}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-white">~ ${tokensToUsd(totalTokens)}</div>
                        </div>

                        <PrimaryBar
                            extraCss="w-[820px]"
                            values={[
                                {label:"Locked", percentage:tokenDistribution.lockedPercentage, value:simplifyBN(fromLamports(userAccount.lockedAmount)), color:"bg-purple-600"},
                                {label:"Unlocked", percentage:tokenDistribution.unlockedPercentage, value:simplifyBN(fromLamports(userTokenBalance)), color:"bg-purple-300"},
                            ]}
                            labels={true}
                        />
                    </div>
                ): (
                    <div className="flex flex-col space-y-2 mt-4">
                        {/* When bondedTime is negative so hasn't bonded */}
                        <div className="flex items-baseline space-x-2">
                            <div className="text-sm font-semibold">
                                Invested
                            </div>
                            <div className="text-sm text-gray-500 dark:text-white">~ ${solToUsd(userAccount.lockedAmount)}</div>
                        </div>

                        <PrimaryBar
                            extraCss="w-[820px]"
                            values={[
                                { label: "SOL", percentage: 100, value: fromLamportsDecimals(userAccount.lockedAmount).toString(), color: "bg-purple-300" },
                            ]}
                            labels={true}
                        />
                    </div>
                ) }
                
                
                
            </>
          ) : null}
    
          {publicKey != null ? (
            <>
              <div className="flex mb-4 mt-4">
                {(memeAccount.bondedTime.lt(ZERO) && memeAccount.creationTime.gte(ZERO)) ? ( // meaning not bonded or on pump
                <>
                </>
                ) : ( //on pump or ray
                <>

                  <PrimaryButton name="selectRaydiumBuy" disabled={false} active={selectedAction === ActionType.RaydiumBuy} onClick={() => handleActionChange(ActionType.RaydiumBuy)} extraCss="w-1/3 btn-xs" value="Buy"/>
                  <PrimaryButton name="selectRaydiumSell" disabled={false} active={selectedAction === ActionType.RaydiumSell} onClick={() => handleActionChange(ActionType.RaydiumSell)} extraCss="w-1/3 btn-xs" value="Sell"/> 
                  <PrimaryButton name="selectLock" disabled={false} active={selectedAction === ActionType.Lock} onClick={() => handleActionChange(ActionType.Lock)} extraCss="w-1/3 btn-xs" value="Lock"/> 
                </>
                )}
              </div>

              <div className="relative flex items-center mb-2 mt-4">
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
    
              <PrimaryButton
                name="Transact"
                disabled={amount === ZERO}
                active={!amount.eq(ZERO)}
                extraCss=""
                value={(memeAccount.bondedTime.lt(ZERO) && memeAccount.creationTime.gte(ZERO)) ? ("Buy") : ("Transact")}
                onClick={() => {
                  if (selectedAction === ActionType.Buy) {
                    handleBuyFormSubmit();
                  } else if (selectedAction === ActionType.RaydiumBuy || selectedAction === ActionType.RaydiumSell) {
                    handleRaydiumBuySellFormSubmit();
                  } else if (selectedAction === ActionType.Lock) {
                    handleLockFormSubmit();
                  } else {
                    console.warn('No handler for selected action');
                  }
                }}
              />

              
            </>
          ) : (
            <div className="mt-4"><WalletButton /></div>
          )}
        </div>
      </div>
    );
}


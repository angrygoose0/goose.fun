import { useWallet } from "@solana/wallet-adapter-react";
import Image from 'next/image';
import { PrimaryBar, PrimaryButton, PrimaryInput } from "../ui/extra-ui/button";
import { BILLION, fromLamportsDecimals, ToLamportsDecimals, ZERO, calculatePercentage, EMPTY_PUBLIC_KEY, SOL_MINT, fromLamports, simplifyBN} from "../meme/meme-helper-functions";
import BN from "bn.js";
import { useCallback, useEffect, useState } from "react";
import { useGetBalance, useGetTokenAccounts } from "../account/account-data-access";
import toast from "react-hot-toast";
import { useCreateUpdateDB, usePreBuySellTokenMutation, usePreTokenQuery, usePreUserQuery, mint, SOL_GOAL, usePreLockClaimTokenMutation } from "./pre-data-access";
import { useSolPriceQuery } from "../solana/solana-data-access";
import { WalletButton } from "../solana/solana-provider";
import { PublicKey } from "@solana/web3.js";
import { useBondToRaydium, useMemeAccountQuery, useMetadataQuery, useUserAccountQuery } from "../meme/meme-data-access";
import { useRaydiumPoolQuery } from "../raydium/raydium-data-access";
import { ActionType } from "../meme/meme-ui";


export function PreCard() {
    const { publicKey } = useWallet();

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
        claimmable: BN;
    }>({
        lockedAmount: ZERO,
        claimmable: ZERO,
    });



    const [userTokenBalance, setUserTokenBalance] = useState(ZERO);
    const [solBalance, setSolBalance] = useState(ZERO);
    
    const [solPrice, setSolPrice] = useState(0); //price per sol
    const [tokenPrice, setTokensPerSol] = useState(ZERO); // tokens per sol

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
    
    const accountKey = new PublicKey("BVqw4R9cAbcaTmnyBs5uEf3tFA4ZwVBtC1J4sfNaPA4Z");

    const { preTokenQuery } = usePreTokenQuery();
    
    const { metadataQuery } = useMetadataQuery({
        mint: memeAccount.mint,
    });

    const { preUserQuery} = usePreUserQuery();

    const { getSpecificTokenBalance } = useGetTokenAccounts({
        address: publicKey || EMPTY_PUBLIC_KEY,
        mint: memeAccount.mint,
    });
    const {balanceQuery} = useGetBalance({ address: publicKey })
    
    const {raydiumPoolQuery, raydiumSwap} = useRaydiumPoolQuery({poolId: memeAccount.poolId});
    const {solPriceQuery} = useSolPriceQuery();

    useEffect(() => {
        if (raydiumPoolQuery.data) {

          setTokensPerSol(new BN(raydiumPoolQuery.data.poolInfo.price));
        }
    }, [raydiumPoolQuery.data]);

    useEffect(() => {
        if (solPriceQuery.data) {
          setSolPrice(solPriceQuery.data)
        }
    }, [solPriceQuery.data]);
    
    useEffect(() => {
        if (preTokenQuery.data) {
            setMemeAccount({
                dev: EMPTY_PUBLIC_KEY,
                mint: new PublicKey(preTokenQuery.data.mint),
                lockedAmount: new BN(preTokenQuery.data.locked_amount),
                creationTime: new BN(ZERO),
                bondedTime: new BN(preTokenQuery.data.bonded_time),
                poolId: new PublicKey(preTokenQuery.data.pool_id),
            });
        }
    }, [preTokenQuery.data]); // Re-run when preTokenQuery changes

    
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
        if (preUserQuery.data) {
            const { locked_amount, claimmable } = preUserQuery.data;
            setUserAccount({
                lockedAmount: new BN(preUserQuery.data.locked_amount),
                claimmable: new BN (preUserQuery.data.claimmable),
            });
        }
    }, [preUserQuery.data,]);
    
    useEffect(() => {
        if (getSpecificTokenBalance.data) {
            const unlockedAmount = new BN(getSpecificTokenBalance.data.balance || ZERO);
            setUserTokenBalance(unlockedAmount);
        }
    }, [getSpecificTokenBalance.data]);

    useEffect(() => {
        if (balanceQuery.data) {
          setSolBalance(new BN(balanceQuery.data));
        }
      }, [balanceQuery.data]);
    
    
    const totalTokens = userAccount.lockedAmount
        .add(userTokenBalance)
        .add(userAccount.claimmable);
    
    const tokenDistribution = {
        lockedPercentage: calculatePercentage(userAccount.lockedAmount, totalTokens),
        unlockedPercentage: calculatePercentage(userTokenBalance, totalTokens),
        claimmablePercentage: calculatePercentage(userAccount.claimmable, totalTokens),
    };
    
    const divisor = memeAccount.bondedTime.isNeg() ? new BN('800000000000000000') : new BN('1000000000000000000');
    const globalPercentage = calculatePercentage(memeAccount.lockedAmount, divisor);



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

      const {preBuySellToken} = usePreBuySellTokenMutation();
      const {preLockClaimToken} = usePreLockClaimTokenMutation();
      
    
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
          await preBuySellToken.mutateAsync({ amount: amountSentToSolana });
          toast.success("Success!");
        } catch (error: any) {
          console.error(error);
          toast.error(error.message || "An error occurred.");
        }
      }, [amount, showingSol, selectedAction, solBalance, memeAccount.mint, preBuySellToken, userAccount.lockedAmount, solToTokens, tokensToSol]);
    
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
          await preLockClaimToken.mutateAsync({ amount: amountSentToSolana });
          toast.success("Success!");
        } catch (error: any) {
          console.error(error);
          toast.error(error.message || "An error occurred.");
        }
      }, [amount, showingSol, selectedAction, userTokenBalance, userAccount.claimmable, memeAccount.mint, preLockClaimToken, solToTokens]);
      
      
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
      }, [amount, showingSol, selectedAction, solBalance, userTokenBalance, raydiumSwap, tokensToSol, solToTokens]);
    
  
    return (
        <div className="max-w-4xl mx-auto mt-10">
                <div className="relative dualbox p-6">
                    <div className="absolute top-2 right-2 text-gray-500 dark:text-white text-xs">
                        buy now on pump.fun here:
                    </div>
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
                            <div className="text-sm text-gray-500 dark:text-white">~ ${solToUsd(memeAccount.lockedAmount)}</div>
                        </div>
    
                        <PrimaryBar
                            extraCss="mt-1 w-[820px]"
                            values={[
                                { label: "SOL", percentage: globalPercentage, value: fromLamportsDecimals(memeAccount.lockedAmount).toString(), color: "bg-black dark:bg-white" },
                            ]}
                            labels={true}
                        />
                    </div>
                    
                    {publicKey != null && !userAccount.lockedAmount.eq(ZERO) ? (
                        
                    <>
                        {memeAccount.bondedTime.gt(ZERO) ? ( //bonded or on pump
                            <div className="flex flex-col space-y-2 mt-4">
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
                                        {label:"Locked", percentage:tokenDistribution.lockedPercentage, value:simplifyBN(fromLamports(userAccount.lockedAmount)), color:"bg-purple-800 dark:bg-purple-300"},
                                        {label:"Unlocked", percentage:tokenDistribution.unlockedPercentage, value:simplifyBN(fromLamports(userTokenBalance)), color:"bg-purple-600"},
                                        {label:"Claimmable", percentage:tokenDistribution.claimmablePercentage, value:simplifyBN(fromLamports(userAccount.claimmable)), color:"bg-purple-300 dark:bg-purple-800"},
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
                                {memeAccount.bondedTime.gt(ZERO) ? ( // meaning not bonded or on pump
                                <>
                                    <PrimaryButton name="selectBuy" disabled={false} active={selectedAction === ActionType.Buy} onClick={() => handleActionChange(ActionType.Buy)} extraCss="w-1/2 btn-xs" value="Buy"/>
                                    <PrimaryButton name="selectSell" disabled={false} active={selectedAction === ActionType.Sell} onClick={() => handleActionChange(ActionType.Sell)} extraCss="w-1/2 btn-xs" value="Sell"/>
                                </>
                                ) : ( //on pump or ray
                                <>
        
                                    <PrimaryButton name="selectRaydiumBuy" disabled={false} active={selectedAction === ActionType.RaydiumBuy} onClick={() => handleActionChange(ActionType.RaydiumBuy)} extraCss="w-1/4 btn-xs" value="Buy"/>
                                    <PrimaryButton name="selectRaydiumSell" disabled={false} active={selectedAction === ActionType.RaydiumSell} onClick={() => handleActionChange(ActionType.RaydiumSell)} extraCss="w-1/4 btn-xs" value="Sell"/> 
                                    <PrimaryButton name="selectLock" disabled={false} active={selectedAction === ActionType.Lock} onClick={() => handleActionChange(ActionType.Lock)} extraCss="w-1/4 btn-xs" value="Lock"/> 
                                    <PrimaryButton name="selectClaim" disabled={false} active={selectedAction === ActionType.Claim} onClick={() => handleActionChange(ActionType.Claim)} extraCss="w-1/4 btn-xs" value="Claim"/>
                                </>
                                )}
                            </div>
                            <div className="relative flex items-center mb-2 mt-4">
                                <PrimaryInput
                                    name="amountField"
                                    onChange={handleFormFieldChange}
                                    onFocus={()=> {}}
                                    value={amount === ZERO ? "" : fromLamportsDecimals(amount)}
                                    placeholder={fromLamportsDecimals(solBalance).toString()}
                                    type="number"
                                    extraCss="w-full"
                                    disabled={false}
                                />
                                <button
                                    onClick={toggleSolOrToken}
                                    disabled={(selectedAction == ActionType.Buy || selectedAction == ActionType.Sell)}
                                    className={"text-dark btn btn-xs absolute right-2"}>
                                    {showingSol ? "SOL" : "Tokens"}
                                    
                                </button>

                                
                            </div>
                            
                            <div className="text-sm text-gray-500 dark:text-white mb-2">~ ${solToUsd(amount)}</div>
    
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
    
                            <PrimaryButton
                                name="Transact"
                                disabled={amount === ZERO}
                                active={!amount.eq(ZERO)}
                                extraCss=""
                                value="Transact"
                                onClick={() => { handleBuySellFormSubmit }}
                            />
                        </>
                    ) : (
                        <div className="mt-4"><WalletButton /></div>
                    )}
                </div>
        </div>
    );
}


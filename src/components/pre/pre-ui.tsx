import { useWallet } from "@solana/wallet-adapter-react";
import Image from 'next/image';
import { PrimaryBar, PrimaryButton, PrimaryInput } from "../ui/extra-ui/button";
import { BILLION, fromLamportsDecimals, ToLamportsDecimals, ZERO, INITIAL_PRICE, calculatePercentage, fromLamports, simplifyBN } from "../meme/meme-helper-functions";
import BN from "bn.js";
import { useCallback, useEffect, useState } from "react";
import { useGetBalance } from "../account/account-data-access";
import toast from "react-hot-toast";
import { useCreateUpdateDB, useInvestInTokenMutation, usePreTokenQuery, usePreUserQuery } from "./pre-data-access";
import { useSolPriceQuery } from "../solana/solana-data-access";

export function PreCard() {
    const { publicKey } = useWallet();

    const [solBalance, setSolBalance] = useState(ZERO);
  
   

    const {investInToken} = useInvestInTokenMutation();
    const {createUpdateDB} = useCreateUpdateDB();

    const {preUserQuery} = usePreUserQuery();
    const {preTokenQuery} = usePreTokenQuery();


    const tokenConstants = {
      symbol: process.env.NEXT_PUBLIC_SYMBOL || "",
      name: process.env.NEXT_PUBLIC_NAME || "",
      image: process.env.NEXT_PUBLIC_IMAGE || "",
      description: process.env.NEXT_PUBLIC_DESCRIPTION || "",
      mint: process.env.NEXT_PUBLIC_MINT || "",
    };

    const [globalInvestedAmount, setGlobalInvestedAmount] = useState(ZERO);
    const [userInvestedAmount, setUserInvestedAmount] = useState(ZERO);
    const [bondedTime, setBondedTime] = useState(0);

    const [solPrice, setSolPrice] = useState(0);

    const INITIAL_SOL_GOAL = new BN(320).mul(BILLION);
    const globalPercentage = calculatePercentage(globalInvestedAmount, INITIAL_SOL_GOAL);

    const {solPriceQuery} = useSolPriceQuery();
    const balanceQuery = useGetBalance({ address: publicKey });

    useEffect(() => {
      if (solPriceQuery.data) {
        setSolPrice(solPriceQuery.data)
      }
    }, [solPriceQuery.data]);


    useEffect(() => {
        if (preUserQuery.data) {
          setUserInvestedAmount(new BN(preUserQuery.data.invested_amount));
        }
      }, [preUserQuery.data]);

    useEffect(() => {
      if (preTokenQuery.data) {
        console.log('preTokenQuery.data', preTokenQuery.data);
        setGlobalInvestedAmount(new BN(preTokenQuery.data.invested_amount));
        setBondedTime(preTokenQuery.data.bonded_time);
      }
    }, [preTokenQuery.data]);
    
    useEffect(() => {
      if (balanceQuery.data) {
        setSolBalance(new BN(balanceQuery.data));
      }
    }, [balanceQuery.data]);
    
    const solToUsd = (sol: BN): number => {
      const result = fromLamportsDecimals(sol) * solPrice;
      return Math.ceil(result * 100) / 100; // Rounds up to 2 decimal places
    };

    const [amount, setAmount] = useState(ZERO);
    const [showingSol, setShowingSol] = useState(true);

    const setAmountWithLimits = (numericValue: BN) => {
        if (numericValue < ZERO) {
            setAmount(ZERO);
            return;
        }
      setAmount(numericValue.cmp(solBalance) === -1 ? numericValue : solBalance);

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
            if (publicKey === null) {
                throw new Error("Wallet not connected.");
            }
            if (amount.gte(solBalance)) {
              throw new Error("SOL balance too low1.");
            }
  
            await investInToken.mutateAsync({ amount});

            console.log('sol sent through');

            await createUpdateDB.mutateAsync({ amount});
            console.log('db updated');

            let dbUpdateAttempt = 0;
            const maxRetries = 3;

            while (dbUpdateAttempt < maxRetries) {
                try {
                    await createUpdateDB.mutateAsync({ amount });
                    console.log('Database updated successfully');
                    break; // Exit the loop if successful
                } catch (error) {
                    dbUpdateAttempt++;
                    console.error(`Database update failed. Attempt ${dbUpdateAttempt}/${maxRetries}`, error);

                    if (dbUpdateAttempt >= maxRetries) {
                        throw new Error('Database update failed after maximum retry attempts');
                    }
                }
            }

            if (dbUpdateAttempt >= maxRetries) {
              console.error('Critical issue: SOL payment succeeded but database update failed, admins alerted.');
            }


          toast.success("Success!");
        } catch (error: any) {
          console.error(error);
          toast.error(error.message || "An error occurred.");
        }
      }, [amount, showingSol, solBalance, publicKey, investInToken, createUpdateDB]);
    
  
    return (
        <div
            className="max-w-4xl mx-auto mt-10"
        >
            <div className="relative dualbox p-6">
                <div className="flex items-start mb-2">

                    <Image
                    src={tokenConstants.image}
                    alt="Icon"
                    width={48} // Specify width and height for the image
                    height={48}
                    className="dualbox object-contain"
                    />


                    <div className="ml-4">
                    <h2 className="text-xl font-bold">
                        <span className="font-bold">{tokenConstants.symbol}</span>
                        <span className="font-normal"> {tokenConstants.name}
                        <span className="text-gray-500 dark:text-white text-xs ml-2">{tokenConstants.mint}</span>
                        </span>

                    </h2>
                    <p className="text-gray-500 dark:text-white text-sm mt-2">
                    {tokenConstants.description}
                    </p>
                </div>
            </div>

            <div className="flex flex-col space-y-2 mt-2">
                <div className="flex items-baseline space-x-2">
                <div className="text-sm font-semibold"> {globalPercentage}%</div>
                <div className="text-sm text-gray-500 dark:text-white">~ {solToUsd(globalInvestedAmount)}</div>
                </div>
            

              <PrimaryBar
                extraCss="mt-1 w-[820px]"
                  values={[
                  {label:"SOL", percentage:globalPercentage, value:fromLamportsDecimals(globalInvestedAmount).toString(), color:"bg-black dark:bg-white"},
                  ]}
                labels={true}

              />
            </div>
            {(publicKey != null && !userInvestedAmount.eq(ZERO)) ? (
                
                <div className="flex flex-col space-y-2 mt-4">
                    {/* When bondedTime is negative so hasnt bonded */}
                    <div className="flex items-baseline space-x-2">
                        <div className="text-sm font-semibold ">
                        User Invested: 
                        </div>
                        <div className="text-sm text-gray-500 dark:text-white">~ ${solToUsd(userInvestedAmount)}</div>
                    </div>

                    <PrimaryBar
                        extraCss="w-[820px]"
                        values={[
                        {label:"SOL", percentage:100, value:solToUsd(userInvestedAmount).toString(), color:"bg-purple-300"},
                        ]}
                        labels={true}
                    />
                </div>
            ) : null}
            </div>


    

    
            <div className="relative flex items-center mb-2 mt-4">
                <PrimaryInput name="amountField" onChange={handleFormFieldChange} value={amount === ZERO ? "" : fromLamportsDecimals(amount)} placeholder={fromLamportsDecimals(solBalance).toString()} type="number" extraCss="w-full" disabled={false}/>
                
            </div>
            <div className="text-sm text-gray-500 dark:text-white mb-2">~ ${solToUsd(amount)}</div>
            
            <div className="flex space-x-4 mb-4">
              <div>
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
                <button 
                onClick={() => setAmountWithLimits(BILLION.mul(new BN(2)))}
                className={"text-dark btn btn-xs mr-2"}>
                2
                </button>
              </div>
            </div>
    
          <PrimaryButton name='Buy' disabled={amount === ZERO} active={false} extraCss="" value='Buy' onClick={() => {handleBuyFormSubmit();}}/>
        </div>

    );
}




import { PublicKey } from "@solana/web3.js";
import { useCallback } from "react";
import toast from "react-hot-toast";
import { useBondToRaydium, useUnlockPhase } from "./admin-data-access";
import { PrimaryButton } from "../ui/extra-ui/button";
import BN from "bn.js";
import { SOL_GOAL_BEFORE_BONDING } from "../meme/meme-helper-functions";

export function BondButton({accountKey}:{accountKey:PublicKey}) {
    const {bondToRaydium} = useBondToRaydium();

    const handleClick = useCallback(async () => {
        try {
            await bondToRaydium.mutateAsync({ accountKey});
    
        } catch (error:any) {
            console.error(error);
            toast.error(error.message || "Error Bonding to Raydium")
        }

    }, [bondToRaydium, accountKey]);

    

    return (
        <PrimaryButton name="bondButton" disabled={false} active={false} onClick={handleClick} extraCss="btn-xs mt-5" value="Bond To Raydium (debug button)"/>
    );
}

export function UnlockButton({accountKey}:{accountKey:PublicKey}) {
    const {unlockPhase} = useUnlockPhase();

    const handleClick = useCallback(async () => {
        try {
            await unlockPhase.mutateAsync({ accountKey});
    
        } catch (error:any) {
            console.error(error);
            toast.error(error.message || "Error Unlocking tokens")
        }

    }, [unlockPhase, accountKey]);

    

    return (
        <PrimaryButton name="unlockButton" disabled={false} active={false} onClick={handleClick} extraCss="btn-xs mt-5" value="Unlock tokens (debug button)"/>
    );
}
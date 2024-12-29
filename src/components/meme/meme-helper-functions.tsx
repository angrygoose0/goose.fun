import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export const toLamports = (amount: BN): BN => {
    return amount.mul(BILLION);
};

export const ZERO = new BN(0);
export const EMPTY_PUBLIC_KEY = new PublicKey("11111111111111111111111111111111");
export const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');



export const ToLamportsDecimals = (num: number): BN => {
    const numStr = num.toString(); // Convert the number to a string to handle decimals
    const [wholePart, decimalPart = ''] = numStr.split('.'); // Split into whole and decimal parts

    // Handle the decimal part by padding or trimming to 9 digits (1 billion precision)
    const decimalBN = new BN(
        (decimalPart + '0'.repeat(9)).slice(0, 9) // Ensure exactly 9 decimal places
    );

    const wholeBN = new BN(wholePart); // Convert the whole number part to BN
    const lamports = wholeBN.mul(BILLION).add(decimalBN); // Combine whole and fractional parts

    return lamports;
};


export const fromLamports = (amount: BN): BN => {
    return amount.div(BILLION);
};

export const fromLamportsDecimals = (amount: BN): number => {
    if (amount.gt(new BN(Number.MAX_SAFE_INTEGER))) {
        return fromLamports(amount).toNumber();
    }
    return amount.toNumber() / BILLION.toNumber();
};

export const INITIAL_PRICE: BN = new BN(250000000); // 2.5 million tokens per SOL (mul by 100 temp)

export const BILLION = new BN(10).pow(new BN(9));
export const TOKEN_SUPPLY_BEFORE_BONDING = new BN(800000000).mul(BILLION);
export const INITIAL_SOL_AMOUNT = TOKEN_SUPPLY_BEFORE_BONDING.div(INITIAL_PRICE); //320 * billion


const SOL_PRICE: BN = new BN(250_000_000_000); // $250 * 10^9 per SOL lamport


export function simplifyBN(value: BN): string {
    const thresholds = [
        { suffix: 'b', divisor: new BN(10).pow(new BN(9)) }, // Billions
        { suffix: 'm', divisor: new BN(10).pow(new BN(6)) }, // Millions
        { suffix: 'k', divisor: new BN(10).pow(new BN(3)) }, // Thousands
    ];

    for (const { suffix, divisor } of thresholds) {
        if (value.gte(divisor)) {
            const simplified = value.mul(new BN(100)).div(divisor).toNumber() / 100;
            return `${simplified.toFixed(2)}${suffix}`;
        }
    }

    // If value is less than 1,000, return the original number
    return value.toString();
}

export const calculatePercentage = (numerator: BN, denominator: BN): number => {
    const scale = new BN(10000); // Use a higher scale for precision
    const percentage = denominator === ZERO || numerator === ZERO
        ? ZERO
        : numerator
            .mul(scale) // Multiply numerator by 100 first
            .div(denominator); // Then perform division

    return percentage.toNumber() / 100;
}



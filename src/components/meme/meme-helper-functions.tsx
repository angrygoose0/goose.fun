import BN from "bn.js";

export const toLamports = (amount: BN): BN => {
    const billion = new BN(10).pow(new BN(9));
    return amount.mul(billion);
};

export const fromLamports = (amount: BN): BN => {
    const billion = new BN(10).pow(new BN(9));
    return amount.div(billion);
};

const INITIAL_PRICE: BN = new BN (2_500_000); // 2.5 million tokens per SOL
const SOL_PRICE: BN = new BN(250_000_000_000); // $250 * 10^9 per SOL lamport

// Conversion functions
export const convertTokensToSol = (tokens: BN): BN => {
    return tokens.div(INITIAL_PRICE);
};

export const convertSolToTokens = (sol: BN): BN => {
    return sol.mul(INITIAL_PRICE);
};

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

export const calculatePercentage = (numerator: BN, denominator: BN): BN => {
    const percentage = denominator.isZero() || numerator.isZero()
        ? new BN(0)
        : numerator
            .mul(new BN(100)) // Multiply numerator by 100 first
            .div(denominator); // Then perform division

    return percentage;
}

export function timeAgo(from: number): string {
    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    const diff = now - from;

    if (diff < 60) return `${diff}s`; // Seconds
    if (diff < 3600) return `${Math.floor(diff / 60)}m`; // Minutes
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`; // Hours
    return `${Math.floor(diff / 86400)}d`; // Days
}

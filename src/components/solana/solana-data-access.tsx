import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export function useSolPriceQuery() {
    // Fetch the Solana price in USD
    const solPriceQuery = useQuery({
      queryKey: ['solPrice'],
      queryFn: async () => {
        try {
          const response = await axios.get(
            'https://api.coingecko.com/api/v3/simple/price',
            {
              params: { ids: 'solana', vs_currencies: 'usd' },
            }
          );
          const priceInUsd = response.data.solana.usd;
          return priceInUsd;
        } catch (error) {
          console.error('Error fetching Solana price:', error);
          throw new Error('Failed to fetch Solana price.');
        }
      },
    });
  
    return {
      solPriceQuery,
    };
  }
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
      // Ensure the query is considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000, // 5 minutes
      // Automatically refetch data every 10 minutes
      refetchInterval: 10 * 60 * 1000, // 10 minutes
      // Fetch on mount to ensure data is available when the component loads
      refetchOnMount: true,
      // Optionally fetch in the background when the user revisits the page/tab
      refetchOnWindowFocus: false,
    });
  
    return {
      solPriceQuery,
    };
  }
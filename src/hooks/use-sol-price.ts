import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

// Fetch the SOL token price from CoinGecko API
async function fetchSOLPrice(): Promise<number> {
	try {
		const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
		const data = await response.json();

		const coingeckoPriceSchema = z.object({
			solana: z.object({
				usd: z.number(),
			}),
		});

		const parsedData = coingeckoPriceSchema.parse(data);
		return parsedData.solana.usd;
	} catch (error) {
		console.error("Error fetching SOL price:", error);
		// Return a fallback price if the API call fails
		return 0;
	}
}

export function useSOLPrice() {
	const priceQuery = useQuery({
		queryKey: ["sol-price"],
		queryFn: fetchSOLPrice,
		staleTime: 60 * 1000, // 1 minute
	});

	const getRequiredSOL = (usdAmount: number): number => {
		if (!priceQuery.data) return 0;
		const solPrice = priceQuery.data;

		if (!solPrice || solPrice <= 0) return 0;

		// Calculate the base amount
		return usdAmount / solPrice;
	};

	return {
		price: priceQuery.data ?? 0,
		isLoading: priceQuery.isLoading,
		isError: priceQuery.isError,
		error: priceQuery.error,
		getRequiredSOL,
	};
}

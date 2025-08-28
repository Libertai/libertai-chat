import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

// Fetch the LTAI token price from CoinGecko API
async function fetchLTAIPrice(): Promise<number> {
	try {
		const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=libertai&vs_currencies=usd");
		const data = await response.json();

		const coingeckoPriceSchema = z.object({
			libertai: z.object({
				usd: z.number(),
			}),
		});

		const parsedData = coingeckoPriceSchema.parse(data);
		return parsedData.libertai.usd;
	} catch (error) {
		console.error("Error fetching LTAI price:", error);
		// Return a fallback price if the API call fails
		return 0;
	}
}

export function useLTAIPrice() {
	const priceQuery = useQuery({
		queryKey: ["ltai-price"],
		queryFn: fetchLTAIPrice,
		staleTime: 60 * 1000, // 1 minute
	});

	const getRequiredLTAI = (usdAmount: number, applyDiscount = true): number => {
		if (!priceQuery.data) return 0;
		const ltaiPrice = priceQuery.data;

		if (!ltaiPrice || ltaiPrice <= 0) return 0;

		// Calculate the base amount
		const baseAmount = usdAmount / ltaiPrice;

		// Apply 20% discount if requested
		return applyDiscount ? baseAmount * 0.8 : baseAmount;
	};

	return {
		price: priceQuery.data ?? 0,
		isLoading: priceQuery.isLoading,
		isError: priceQuery.isError,
		error: priceQuery.error,
		getRequiredLTAI,
	};
}

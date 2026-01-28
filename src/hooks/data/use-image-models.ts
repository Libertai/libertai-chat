import { useQuery } from "@tanstack/react-query";
import env from "@/config/env";

export interface ImageModel {
	id: string;
	name: string;
	creditCost: number;
}

interface PricingData {
	capabilities?: {
		image?: boolean;
	};
	credit_cost?: number;
}

interface AlephAggregateResponse {
	data?: {
		LTAI_PRICING?: Record<string, PricingData>;
	};
}

const ALEPH_API_URL = "https://api2.aleph.im/api/v0/aggregates";

export function useImageModels() {
	const modelsQuery = useQuery({
		queryKey: ["imageModels"],
		queryFn: async (): Promise<ImageModel[]> => {
			const url = `${ALEPH_API_URL}/${env.LTAI_PUBLISHER_ADDRESS}.json?keys=LTAI_PRICING`;
			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = (await response.json()) as AlephAggregateResponse;
			const pricing = data?.data?.LTAI_PRICING;

			if (!pricing) {
				return [];
			}

			const imageModels: ImageModel[] = [];
			for (const [modelId, modelData] of Object.entries(pricing)) {
				if (modelData.capabilities?.image) {
					imageModels.push({
						id: modelId,
						name: modelId,
						creditCost: modelData.credit_cost ?? 0,
					});
				}
			}

			return imageModels;
		},
		staleTime: 10 * 60 * 1000, // 10 minutes
		refetchOnWindowFocus: false,
	});

	return {
		models: modelsQuery.data ?? [],
		isLoading: modelsQuery.isLoading,
		isError: modelsQuery.isError,
		error: modelsQuery.error,
	};
}

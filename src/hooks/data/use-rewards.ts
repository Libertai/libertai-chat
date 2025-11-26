import { useQuery } from "@tanstack/react-query";
import { useAccountStore } from "@/stores/account.ts";
import env from "@/config/env";

interface RewardsData {
	pendingTokens: number;
	estimated3YrTokens: number;
}

interface AlephAggregateResponse {
	data?: {
		pending_tokens?: Record<string, number>;
		estimated_3yr_tokens?: Record<string, number>;
	};
}

const ALEPH_API_URL = "https://api2.aleph.im/api/v0/aggregates";

export function useRewards() {
	const account = useAccountStore((state) => state.account);

	const rewardsQuery = useQuery({
		queryKey: ["rewards", account?.address],
		queryFn: async (): Promise<RewardsData> => {
			if (!account?.address) {
				return { pendingTokens: 0, estimated3YrTokens: 0 };
			}

			try {
				// Fetch both keys in one request
				const url = `${ALEPH_API_URL}/${env.LTAI_PUBLISHER_ADDRESS}.json?keys=pending_tokens,estimated_3yr_tokens`;
				const response = await fetch(url);

				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}

				const data = await response.json() as AlephAggregateResponse;

				const pendingTokens = data?.data?.pending_tokens?.[account.address] ?? 0;
				const estimated3YrTokens = data?.data?.estimated_3yr_tokens?.[account.address] ?? 0;

				return {
					pendingTokens,
					estimated3YrTokens,
				};
			} catch (error) {
				console.error("Error fetching rewards data:", error);
				return { pendingTokens: 0, estimated3YrTokens: 0 };
			}
		},
		enabled: !!account?.address,
		staleTime: 5 * 60 * 1000, // 5 minutes
		refetchOnWindowFocus: false,
	});

	return {
		pendingTokens: rewardsQuery.data?.pendingTokens ?? 0,
		estimated3YrTokens: rewardsQuery.data?.estimated3YrTokens ?? 0,
		isLoading: rewardsQuery.isLoading,
		isError: rewardsQuery.isError,
		error: rewardsQuery.error,
	};
}

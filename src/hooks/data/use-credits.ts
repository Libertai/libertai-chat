import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getUserBalanceCreditsBalanceGet } from "@/apis/inference";
import { useAccountStore } from "@/stores/account.ts";
import { toast } from "sonner";

export function useCredits() {
	const queryClient = useQueryClient();
	const account = useAccountStore((state) => state.account);

	// Query for credits balance
	const creditsQuery = useQuery({
		queryKey: ["credits", account?.address],
		queryFn: async () => {
			if (!account) {
				return { balance: 0 };
			}

			const response = await getUserBalanceCreditsBalanceGet();

			if (response.error) {
				throw new Error(response.error.detail ? response.error.detail.toString() : "Unknown error fetching credits");
			}

			return response.data;
		},
		enabled: !!account, // Only run the query when account exists
		staleTime: 5 * 60 * 1000, // 5 minutes
		refetchOnWindowFocus: false,
	});

	// Mutation to refresh balance
	const refreshCreditsMutation = useMutation({
		mutationFn: async () => {
			if (!account) {
				throw new Error("No account available");
			}

			const response = await getUserBalanceCreditsBalanceGet();

			if (response.error) {
				throw new Error(response.error.detail ? response.error.detail.toString() : "Unknown error fetching credits");
			}

			return response.data;
		},
		onSuccess: (data) => {
			queryClient.setQueryData(["credits", account?.address], data);
		},
		onError: (error) => {
			toast.error("Failed to update credits balance", {
				description: error instanceof Error ? error.message : "Unknown error occurred",
			});
		},
	});

	return {
		credits: creditsQuery.data?.balance ?? 0,
		formattedCredits: creditsQuery.data
			? creditsQuery.data.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })
			: "0",
		isLoading: creditsQuery.isLoading,
		isError: creditsQuery.isError,
		error: creditsQuery.error,
		refreshCredits: refreshCreditsMutation.mutate,
		isRefreshing: refreshCreditsMutation.isPending,
	};
}

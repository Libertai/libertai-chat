import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getUserBalanceCreditsBalanceGet } from "@libertai/inference-sdk";
import { useAccountStore } from "@libertai/auth";
import { toast } from "sonner";

export function useCredits() {
	const queryClient = useQueryClient();
	// Gate on the cookie session, not the wallet `account`. Email/OAuth logins authenticate without
	// ever connecting a wallet (so `account` stays null), and the balance endpoint is session-based
	// (`/credits/balance` → get_current_user). Keying on `account` left those users reading 0 credits.
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);

	// Query for credits balance
	const creditsQuery = useQuery({
		queryKey: ["credits"],
		queryFn: async () => {
			if (!isAuthenticated) {
				return { balance: 0 };
			}

			const response = await getUserBalanceCreditsBalanceGet();

			if (response.error) {
				throw new Error(response.error.detail ? response.error.detail.toString() : "Unknown error fetching credits");
			}

			return response.data;
		},
		enabled: isAuthenticated, // Only run the query when a session exists
		staleTime: 5 * 60 * 1000, // 5 minutes
		refetchOnWindowFocus: false,
	});

	// Mutation to refresh balance
	const refreshCreditsMutation = useMutation({
		mutationFn: async () => {
			if (!isAuthenticated) {
				throw new Error("No active session");
			}

			const response = await getUserBalanceCreditsBalanceGet();

			if (response.error) {
				throw new Error(response.error.detail ? response.error.detail.toString() : "Unknown error fetching credits");
			}

			return response.data;
		},
		onSuccess: (data) => {
			queryClient.setQueryData(["credits"], data);
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

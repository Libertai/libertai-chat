import { useQuery } from "@tanstack/react-query";
import { getTransactionHistoryCreditsTransactionsGet } from "@libertai/inference-sdk";
import { useAccountStore } from "@libertai/auth";

export function useTransactions() {
	// Gate on the cookie session, not the wallet `account`: /credits/transactions is session-based
	// (get_current_user), so email/OAuth users (who have no wallet account) must still see their history.
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);

	// Query for transaction history
	const transactionsQuery = useQuery({
		queryKey: ["transactions"],
		queryFn: async () => {
			if (!isAuthenticated) {
				return { address: "", transactions: [] };
			}

			const response = await getTransactionHistoryCreditsTransactionsGet();

			if (response.error) {
				throw new Error(
					response.error.detail ? response.error.detail.toString() : "Unknown error fetching transactions",
				);
			}

			return response.data;
		},
		enabled: isAuthenticated, // Only run the query when a session exists
		staleTime: 5 * 60 * 1000, // 5 minutes
		refetchOnWindowFocus: false,
	});

	return {
		transactions: transactionsQuery.data?.transactions || [],
		address: transactionsQuery.data?.address || "",
		isLoading: transactionsQuery.isLoading,
		isError: transactionsQuery.isError,
		error: transactionsQuery.error,
	};
}

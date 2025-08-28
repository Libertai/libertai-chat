import { useQuery } from "@tanstack/react-query";
import { getTransactionHistoryCreditsTransactionsGet } from "@/apis/inference";
import { useAccountStore } from "@/stores/account";

export function useTransactions() {
	const account = useAccountStore((state) => state.account);

	// Query for transaction history
	const transactionsQuery = useQuery({
		queryKey: ["transactions", account?.address],
		queryFn: async () => {
			if (!account) {
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
		enabled: !!account, // Only run the query when account exists
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

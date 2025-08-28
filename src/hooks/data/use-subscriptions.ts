import { useQuery } from "@tanstack/react-query";
import {
	getSubscriptionByUserAddressSubscriptionsGet,
	getSubscriptionTransactionsSubscriptionsSubscriptionIdTransactionsGet,
	SubscriptionResponse,
	SubscriptionTransactionResponse,
} from "@/apis/inference";
import { useAccountStore } from "@/stores/account.ts";

export function useSubscriptions() {
	const account = useAccountStore((state) => state.account);

	// Query for user subscriptions
	const subscriptionsQuery = useQuery({
		queryKey: ["subscriptions", account?.address],
		queryFn: async () => {
			if (!account?.address) {
				throw new Error("No user address available");
			}

			const response = await getSubscriptionByUserAddressSubscriptionsGet();

			if (response.error) {
				throw new Error(
					response.error.detail ? response.error.detail.toString() : "Unknown error fetching subscriptions",
				);
			}

			return response.data;
		},
		enabled: !!account?.address,
	});

	return {
		subscriptions: subscriptionsQuery.data || [],
		isLoading: subscriptionsQuery.isLoading,
		isError: subscriptionsQuery.isError,
		error: subscriptionsQuery.error,
	};
}

export function useAllSubscriptionTransactions(subscriptions: SubscriptionResponse[]) {
	const account = useAccountStore((state) => state.account);

	// Query for all transactions across subscriptions
	const allTransactionsQuery = useQuery({
		queryKey: ["allSubscriptionTransactions", subscriptions.map((s) => s.id)],
		queryFn: async () => {
			if (!subscriptions.length) {
				return [];
			}

			const allTransactions: SubscriptionTransactionResponse[] = [];

			// Fetch transactions for each subscription
			for (const subscription of subscriptions) {
				try {
					const response = await getSubscriptionTransactionsSubscriptionsSubscriptionIdTransactionsGet({
						path: {
							subscription_id: subscription.id,
						},
					});

					if (response.data) {
						allTransactions.push(...response.data);
					}
				} catch (error) {
					console.error(`Error fetching transactions for subscription ${subscription.id}:`, error);
				}
			}

			// Sort by created_at date (newest first)
			return allTransactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
		},
		enabled: !!account?.address && subscriptions.length > 0,
	});

	return {
		allTransactions: allTransactionsQuery.data || [],
		isLoading: allTransactionsQuery.isLoading,
		isError: allTransactionsQuery.isError,
		error: allTransactionsQuery.error,
	};
}

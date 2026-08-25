import { createFileRoute } from "@tanstack/react-router";
import { useRequireAuth } from "@/hooks/use-auth";
import { BillingDetailsForm, InvoiceHistory, TransactionHistory, useIsWalletAccount } from "@libertai/auth";

export const Route = createFileRoute("/transactions")({
	component: Transactions,
});

function Transactions() {
	const { isAuthenticated } = useRequireAuth();
	const isWalletAccount = useIsWalletAccount();
	if (!isAuthenticated) return null;

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col space-y-8 max-w-5xl mx-auto">
				<div>
					<h1 className="text-3xl font-bold">Transaction history</h1>
					<p className="text-muted-foreground mt-1">View your credit transaction history and details</p>
				</div>
				<TransactionHistory />
				{/* Invoices are issued for card payments only — wallet accounts never have any. */}
				{!isWalletAccount && (
					<>
						<InvoiceHistory />
						<BillingDetailsForm />
					</>
				)}
			</div>
		</div>
	);
}

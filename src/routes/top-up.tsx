import { TopUpAmountInput } from "@/components/payment/TopUpAmountInput.tsx";
import { Button } from "@/components/ui/button";
import { useCredits } from "@/hooks/data/use-credits";
import { useRequireAuth } from "@/hooks/use-auth";
import { useAccountStore } from "@/stores/account";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle, ChevronRight, HelpCircle, Zap } from "lucide-react";
import { useQueryState } from "nuqs";
import { useIsAutoConnecting } from "thirdweb/react";
import { PaymentStage } from "@/components/payment/stages/PaymentStage.tsx";

export const Route = createFileRoute("/top-up")({
	component: TopUp,
});

function TopUp() {
	const isAutoConnecting = useIsAutoConnecting();

	const { refreshCredits } = useCredits();
	const account = useAccountStore((state) => state.account);
	const lastTransactionHash = useAccountStore((state) => state.lastTransactionHash);
	const setLastTransactionHash = useAccountStore((state) => state.setLastTransactionHash);

	const { formattedCredits } = useCredits();
	const navigate = useNavigate();

	// Use nuqs for URL state
	const [stage, setStage] = useQueryState("stage", {
		defaultValue: "select",
		parse: (value): "select" | "payment" | "success" => {
			if (value === "payment" || value === "success") return value;
			return "select";
		},
	});
	const [amount, setAmount] = useQueryState("amount", {
		defaultValue: "",
		parse: (value) => (value !== "" ? value : ""),
		serialize: (value) => (value !== undefined ? value.toString() : ""),
	});

	// Use auth hook to require authentication
	const { isAuthenticated } = useRequireAuth();

	// Return null if not authenticated (redirect is handled by the hook)
	if (!isAuthenticated && !isAutoConnecting) {
		return null;
	}

	const handleSelectAmount = () => {
		// The input amount is already in the URL via useQueryState
		setStage("payment");
		// Reset transaction hash when starting a new payment
		setLastTransactionHash(null);
	};

	const handlePaymentSuccess = () => {
		setStage("success");
		refreshCredits();
	};

	const handleGoBackToSelection = () => {
		setAmount(null);
		setStage("select");
	};

	const handleGoToDashboard = () => {
		navigate({ to: "/" });
	};

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col space-y-8 max-w-5xl mx-auto">
				<div>
					<h1 className="text-3xl font-bold">Top Up balance</h1>
					<p className="text-muted-foreground mt-1">Purchase credits to power your API requests</p>
				</div>

				{stage === "select" && (
					<>
						<div className="bg-card/50 backdrop-blur-sm p-6 rounded-xl border border-border mb-8">
							<div className="flex flex-col md:flex-row gap-6">
								<div className="flex-1">
									<div className="flex items-center gap-3 mb-4">
										<Zap className="h-5 w-5 text-primary" />
										<h2 className="text-xl font-semibold">Credits balance</h2>
									</div>
									<p className="text-3xl font-bold text-primary">${formattedCredits}</p>
									<p className="text-sm text-muted-foreground mt-2">
										API credits are used for API requests and are available immediately after purchase.
										<br />
										You can buy credits with various payment methods ($LTAI token, ERC-20 tokens on many EVM chains,
										Solana, credit cards...).
									</p>
								</div>
							</div>
						</div>

						{/* Custom amount input component */}
						<TopUpAmountInput onSelectAmount={handleSelectAmount} />

						<div className="bg-card/50 backdrop-blur-sm p-6 rounded-xl border border-border">
							<div className="flex items-center gap-3 mb-4">
								<HelpCircle className="h-5 w-5 text-primary" />
								<h2 className="text-xl font-semibold">Pricing Details</h2>
							</div>
							<div className="space-y-4 text-card-foreground">
								<p>
									LibertAI offers various models with competitive pricing for text generation.
									<br />
									Each model offers different intelligence & reasoning capabilities to match your needs.
									<br />
									For detailed information about the available models & their pricing, please check the{" "}
									<a href="https://docs.libertai.io/apis/text" className="text-primary hover:underline" target="_blank">
										API documentation
									</a>
									.
								</p>
							</div>
						</div>
					</>
				)}

				{stage === "payment" && (
					<PaymentStage
						usdAmount={Number(amount)}
						handleGoBackToSelection={handleGoBackToSelection}
						handlePaymentSuccess={handlePaymentSuccess}
					/>
				)}

				{stage === "success" && (
					<div className="bg-card/50 backdrop-blur-sm p-6 rounded-xl border border-border text-center">
						<div className="flex flex-col items-center gap-4 mb-8">
							<div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
								<CheckCircle className="h-8 w-8 text-emerald-400" />
							</div>
							<h2 className="text-2xl font-semibold">Payment Successful!</h2>
							<p className="text-muted-foreground">Your credits will be added to your account shortly.</p>
						</div>

						<div className="bg-card p-6 rounded-lg border border-border mb-8 max-w-md mx-auto">
							<div className="flex justify-between mb-3">
								<span className="text-muted-foreground">Amount Paid:</span>
								<span className="font-medium">${Number(amount).toFixed(2)} USD</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Transaction Hash:</span>
								{lastTransactionHash ? (
									<a
										href={`https://${account?.chain === "solana" ? "explorer.solana.com" : "basescan.org"}/tx/${useAccountStore.getState().lastTransactionHash}`}
										target="_blank"
										className="font-medium text-primary hover:underline overflow-hidden text-ellipsis"
									>
										{lastTransactionHash.slice(0, 6)}...{lastTransactionHash.slice(-6)}
										<span className="ml-1 text-xs">↗</span>
									</a>
								) : (
									<span className="font-medium text-primary">Transaction pending</span>
								)}
							</div>
						</div>

						<Button onClick={handleGoToDashboard} size="lg">
							<span>Go to Dashboard</span>
							<ChevronRight className="h-4 w-4 ml-2" />
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}

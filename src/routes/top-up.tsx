import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryState } from "nuqs";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopUpAmountInput } from "@/components/payment/TopUpAmountInput";
import { PaymentStage } from "@/components/payment/stages/PaymentStage";
import { useCredits } from "@/hooks/data/use-credits";
import { useRequireAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/top-up")({
	component: TopUp,
});

type Stage = "select" | "payment" | "success";

function TopUp() {
	const { isAuthenticated } = useRequireAuth();
	const navigate = useNavigate();

	const [stage, setStage] = useQueryState<Stage>("stage", {
		defaultValue: "select",
		parse: (v): Stage => (v === "payment" || v === "success" ? v : "select"),
	});
	const [amount] = useQueryState("amount", {
		defaultValue: "",
		parse: (v) => (v !== "" ? v : ""),
		serialize: (v) => (v !== undefined ? v.toString() : ""),
	});

	const { formattedCredits, refreshCredits } = useCredits();

	if (!isAuthenticated) return null;

	return (
		<div className="max-w-2xl mx-auto px-4 py-8">
			<div className="mb-6">
				<h1 className="text-2xl font-bold">Buy credits</h1>
				<p className="text-sm text-muted-foreground mt-1">Credits are used once your plan allowance runs out.</p>
			</div>

			{stage === "select" && (
				<div className="space-y-4">
					<p className="text-sm text-muted-foreground">
						Current balance: <span className="font-semibold text-foreground">${formattedCredits}</span>
					</p>
					<TopUpAmountInput onSelectAmount={() => setStage("payment")} />
				</div>
			)}

			{stage === "payment" && (
				<PaymentStage
					usdAmount={Number(amount)}
					handleGoBackToSelection={() => setStage("select")}
					handlePaymentSuccess={() => {
						setStage("success");
						refreshCredits();
					}}
				/>
			)}

			{stage === "success" && (
				<div className="flex flex-col items-center gap-4 py-8">
					<div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center">
						<CheckCircle className="h-7 w-7 text-emerald-400" />
					</div>
					<p className="text-center text-sm text-muted-foreground">
						Payment successful — your credits will be added shortly.
					</p>
					<Button onClick={() => navigate({ to: "/" })}>Done</Button>
				</div>
			)}
		</div>
	);
}

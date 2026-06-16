import { paymentConfig } from "@/config/payment";
import { useRequireAuth } from "@/hooks/use-auth";
import { MobileBetaUnavailable } from "@/components/MobileBetaUnavailable";
import { isMobileBetaApp } from "@/lib/mobile-runtime";
import { PaymentConfigProvider, TopUpFlow } from "@libertai/auth";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/top-up")({ component: TopUp });

function TopUp() {
	const { isAuthenticated } = useRequireAuth();
	const navigate = useNavigate();

	if (isMobileBetaApp()) {
		return (
			<MobileBetaUnavailable
				title="Top up on the web"
				description="Purchases and crypto payments are web-only during the mobile beta. Chat stays available in the app through the free beta tier."
			/>
		);
	}

	if (!isAuthenticated) return null;

	return (
		<PaymentConfigProvider config={paymentConfig}>
			<TopUpFlow onDone={() => navigate({ to: "/" })} />
		</PaymentConfigProvider>
	);
}

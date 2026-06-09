import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { TopUpFlow, PaymentConfigProvider } from "@libertai/auth";
import { paymentConfig } from "@/config/payment";
import { useRequireAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/top-up")({ component: TopUp });

function TopUp() {
	const { isAuthenticated } = useRequireAuth();
	const navigate = useNavigate();
	if (!isAuthenticated) return null;
	return (
		<PaymentConfigProvider config={paymentConfig}>
			<TopUpFlow onDone={() => navigate({ to: "/" })} />
		</PaymentConfigProvider>
	);
}

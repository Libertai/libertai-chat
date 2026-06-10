import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PaymentCallback } from "@libertai/auth";

export const Route = createFileRoute("/payment/callback")({
	component: PaymentCallbackPage,
});

function PaymentCallbackPage() {
	const navigate = useNavigate();
	return (
		<div className="container mx-auto px-4 py-8">
			<PaymentCallback backTo="/plans" navigate={(to) => void navigate({ to })} />
		</div>
	);
}

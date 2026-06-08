import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAccountStore } from "@libertai/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth/callback")({
	component: AuthCallback,
});

function AuthCallback() {
	const exchangeOAuthCode = useAccountStore((state) => state.exchangeOAuthCode);
	const navigate = useNavigate();
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		const code = new URLSearchParams(window.location.search).get("code");
		if (!code) {
			setFailed(true);
			return;
		}
		exchangeOAuthCode(code).then((ok) => {
			if (ok) {
				navigate({ to: "/" });
			} else {
				setFailed(true);
			}
		});
	}, [exchangeOAuthCode, navigate]);

	return (
		<div className="container mx-auto flex flex-col items-center justify-center px-4 py-24 text-center">
			{failed ? (
				<div className="space-y-4">
					<p className="text-lg font-medium">Sign-in failed</p>
					<p className="text-muted-foreground">This sign-in link is invalid or has expired.</p>
					<Button onClick={() => navigate({ to: "/login" })}>Back to sign in</Button>
				</div>
			) : (
				<div className="flex items-center gap-3 text-muted-foreground">
					<Loader2 className="h-5 w-5 animate-spin" />
					Signing you in…
				</div>
			)}
		</div>
	);
}

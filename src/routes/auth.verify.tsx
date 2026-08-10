import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ACCOUNT_SUSPENDED, useAccountStore } from "@libertai/auth";
import { Button } from "@libertai/ui/button";
import { usePostLoginRedirect } from "@/hooks/use-post-login-redirect";

export const Route = createFileRoute("/auth/verify")({
	component: AuthVerify,
});

function AuthVerify() {
	const verifyMagicLinkToken = useAccountStore((state) => state.verifyMagicLinkToken);
	const navigate = useNavigate();
	const redirectAfterLogin = usePostLoginRedirect();
	const loginError = useAccountStore((state) => state.loginError);
	const [failed, setFailed] = useState(false);
	const suspended = failed && loginError === ACCOUNT_SUSPENDED;

	useEffect(() => {
		const token = new URLSearchParams(window.location.search).get("token");
		if (!token) {
			setFailed(true);
			return;
		}
		verifyMagicLinkToken(token).then((ok) => {
			if (ok) {
				void redirectAfterLogin();
			} else {
				setFailed(true);
			}
		});
	}, [verifyMagicLinkToken, redirectAfterLogin]);

	return (
		<div className="container mx-auto flex flex-col items-center justify-center px-4 py-24 text-center">
			{failed ? (
				<div className="space-y-4">
					<p className="text-lg font-medium">{suspended ? "Account suspended" : "Sign-in failed"}</p>
					<p className="text-muted-foreground">
						{suspended
							? "This account has been suspended. Contact support if you believe this is a mistake."
							: "This sign-in link is invalid or has expired."}
					</p>
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

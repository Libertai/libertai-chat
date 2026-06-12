import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAccountStore, LoginPanel } from "@libertai/auth";
import { rememberPostLoginRedirect, usePostLoginRedirect } from "@/hooks/use-post-login-redirect";

export const Route = createFileRoute("/login")({
	validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
		redirect: typeof search.redirect === "string" ? search.redirect : undefined,
	}),
	component: LoginPage,
});

function LoginPage() {
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);
	const redirectAfterLogin = usePostLoginRedirect();
	const { redirect } = Route.useSearch();

	// Persist (or clear) the destination before any login flow starts — OAuth/magic-link
	// leave the site, so the search param alone wouldn't survive.
	useEffect(() => {
		rememberPostLoginRedirect(redirect);
	}, [redirect]);

	useEffect(() => {
		if (isAuthenticated) void redirectAfterLogin();
	}, [isAuthenticated, redirectAfterLogin]);

	return (
		<div className="container mx-auto flex min-h-screen flex-col items-center justify-center px-4 py-12">
			<div className="w-full max-w-sm space-y-6">
				<div className="flex flex-col items-center space-y-3 text-center">
					<img src="/favicon.ico" alt="LibertAI" className="h-14 w-14 rounded-2xl shadow-sm" />
					<h1 className="text-2xl font-bold">Sign in to LibertAI</h1>
					<p className="text-sm text-muted-foreground">Use your email, a social account, or a wallet.</p>
				</div>
				<LoginPanel onSuccess={() => void redirectAfterLogin()} />
			</div>
		</div>
	);
}

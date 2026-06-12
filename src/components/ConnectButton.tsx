import { Button } from "@/components/ui/button";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useAccountStore } from "@libertai/auth";

/**
 * Sign-in entry point in the header. When signed out it shows a "Sign in" button that navigates to the
 * full-page /login route (the shared LoginPanel). When signed in it renders nothing; the connected
 * account is shown in the sidebar footer.
 *
 * Wallet connection + authentication is driven globally by <WalletSync />.
 */
export default function ConnectButton() {
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);
	const account = useAccountStore((state) => state.account);
	const navigate = useNavigate();
	const router = useRouter();

	// Already signed in (email/OAuth session or connected wallet) — footer handles display.
	if (isAuthenticated || account?.address) {
		return null;
	}

	return (
		<Button
			variant="outline"
			className="flex items-center gap-2 px-3 h-9 border-border"
			onClick={() => {
				// Send the user back to where they were after signing in (home is the default).
				const { href } = router.state.location;
				void navigate({ to: "/login", search: { redirect: href === "/" ? undefined : href } });
			}}
		>
			Sign in
		</Button>
	);
}

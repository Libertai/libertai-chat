import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useAccountStore, LoginPanel } from "@libertai/auth";

/**
 * Sign-in entry point in the header. When signed out it shows a "Connect" button that
 * opens the shared LoginPanel (email + wallet — and OAuth once enabled in the shared
 * package). When signed in it renders nothing; the connected account is shown in the
 * sidebar footer (ConnectedAccountFooter).
 *
 * Wallet connection + authentication is driven globally by <WalletSync />, so this
 * component only needs to surface the login UI.
 */
export default function ConnectButton() {
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);
	const account = useAccountStore((state) => state.account);
	const [open, setOpen] = useState(false);

	// Already signed in (email/OAuth session or connected wallet) — footer handles display.
	if (isAuthenticated || account?.address) {
		return null;
	}

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" className="flex items-center gap-2 px-3 h-9 border-border">
					Connect
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-[300px] p-4">
				<LoginPanel onSuccess={() => setOpen(false)} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

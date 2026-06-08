import { Settings } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { AccountMenu, useAccountStore } from "@libertai/auth";
import { useENS } from "@/hooks/useENS";
import { useSidebar } from "@/components/ui/sidebar";

/**
 * Chat's sidebar-footer account menu. Thin adapter over the shared <AccountMenu> — wires in the
 * app-specific bits (ENS resolution via the app's thirdweb client, router navigation, mobile-sidebar
 * close). The dropdown chrome itself is shared with the console so the UIs stay coherent.
 */
export function ConnectedAccountFooter() {
	const account = useAccountStore((state) => state.account);
	const ens = useENS(account?.address);
	const navigate = useNavigate();
	const { isMobile, setOpenMobile } = useSidebar();

	const closeMobile = () => {
		if (isMobile) setOpenMobile(false);
	};

	return (
		<AccountMenu
			ens={ens}
			items={[
				{
					label: "Settings",
					icon: <Settings className="h-4 w-4" />,
					onSelect: () => navigate({ to: "/settings" }),
				},
			]}
			onSignIn={() => navigate({ to: "/login" })}
			onSignedOut={() => navigate({ to: "/" })}
			onAction={closeMobile}
		/>
	);
}

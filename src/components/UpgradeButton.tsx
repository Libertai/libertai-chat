import { Sparkles } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useAccountStore, useCanUpgrade } from "@libertai/auth";
import { Button } from "@/components/ui/button";

/**
 * Header "Upgrade" affordance (ChatGPT-style, top-right). Shown ONLY to an authenticated user
 * whose current tier can still be upgraded. Signed-out users see <ConnectButton /> instead;
 * users already on the top tier see nothing.
 */
export default function UpgradeButton() {
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);
	const { canUpgrade } = useCanUpgrade();
	const navigate = useNavigate();

	if (!isAuthenticated || !canUpgrade) return null;

	return (
		<Button
			variant="ghost"
			className="flex items-center gap-1.5 px-3 h-9 text-primary hover:text-primary"
			onClick={() => navigate({ to: "/plans" })}
			data-testid="header-upgrade"
		>
			<Sparkles className="h-4 w-4" />
			Upgrade
		</Button>
	);
}

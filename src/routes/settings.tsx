import { createFileRoute } from "@tanstack/react-router";
import { AccountSettings, useAccountStore } from "@libertai/auth";
import { useENS } from "@/hooks/useENS";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileBetaSettings } from "@/components/MobileBetaSettings";

export const Route = createFileRoute("/settings")({
	component: SettingsPage,
});

function SettingsPage() {
	const account = useAccountStore((state) => state.account);
	const ens = useENS(account?.address);
	return (
		<div>
			<AccountSettings ens={ens} appearance={<ThemeToggle />} />
			<div className="mx-auto w-full max-w-2xl px-6 pb-6">
				<MobileBetaSettings />
			</div>
		</div>
	);
}

import { createFileRoute } from "@tanstack/react-router";
import { AccountSettings, useAccountStore } from "@libertai/auth";
import { useENS } from "@/hooks/useENS";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/settings")({
	component: SettingsPage,
});

function SettingsPage() {
	const account = useAccountStore((state) => state.account);
	const ens = useENS(account?.address);
	return <AccountSettings ens={ens} appearance={<ThemeToggle />} />;
}

import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAccountStore } from "@/stores/account";
import { useENS } from "@/hooks/useENS";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { copyAddressToClipboard, formatAddress } from "@/lib/utils";

export function Settings() {
	const account = useAccountStore((state) => state.account);
	const { name: ensName, displayName: ensDisplayName, avatar: ensAvatar } = useENS(account?.address);

	if (!account?.address) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="text-center">
					<h2 className="text-lg font-semibold mb-2">Please connect your wallet</h2>
					<p className="text-muted-foreground">You need to connect a wallet to access settings</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 flex items-start justify-center p-6">
			<div className="w-full max-w-2xl space-y-6">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
					<p className="text-muted-foreground">Manage your account settings and preferences.</p>
				</div>

				{/* Profile Section */}
				<div className="border rounded-lg p-6">
					<div className="mb-4">
						<h2 className="text-lg font-semibold">Profile</h2>
						<p className="text-sm text-muted-foreground">Your account information</p>
					</div>
					<div className="space-y-6">
						<div className="space-y-2">
							<div className="text-sm font-medium">Profile Picture</div>
							<div className="flex items-center gap-4">
								<ProfileAvatar src={ensAvatar} address={account.address} size="lg" />
								<div className="text-sm text-muted-foreground">
									{ensAvatar ? "ENS Avatar" : "Generated from address"}
								</div>
							</div>
						</div>

						<div className="space-y-2">
							<div className="text-sm font-medium">Address</div>
							<div className="flex items-center gap-2 p-3 bg-muted rounded-md">
								<code className="flex-1 text-sm font-mono">
									{ensDisplayName ?? ensName ?? formatAddress(account.address)}
								</code>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => copyAddressToClipboard(account.address)}
									className="h-8 w-8 p-0 hover:bg-background"
								>
									<Copy className="h-4 w-4" />
								</Button>
							</div>
						</div>
					</div>
				</div>

				{/* Appearance Section */}
				<div className="border rounded-lg p-6">
					<div className="mb-4">
						<h2 className="text-lg font-semibold">Appearance</h2>
						<p className="text-sm text-muted-foreground">Customize the appearance of the application</p>
					</div>
					<div className="flex items-center justify-between">
						<div className="space-y-1">
							<div className="text-sm font-medium">Theme</div>
							<p className="text-sm text-muted-foreground">Choose your preferred color scheme</p>
						</div>
						<ThemeToggle />
					</div>
				</div>
			</div>
		</div>
	);
}

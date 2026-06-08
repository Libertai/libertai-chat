import { useState } from "react";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAccountStore } from "@libertai/auth";
import { useENS } from "@/hooks/useENS";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { copyAddressToClipboard, formatAddress } from "@/lib/utils";

type Me = { email?: string | null; display_name?: string | null; avatar_url?: string | null } | null;

export function Settings() {
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);
	const account = useAccountStore((state) => state.account);
	const me = useAccountStore((state) => state.me) as Me;
	const updateProfile = useAccountStore((state) => state.updateProfile);
	const { name: ensName, displayName: ensDisplayName, avatar: ensAvatar } = useENS(account?.address);

	const [name, setName] = useState(me?.display_name ?? "");
	const [saving, setSaving] = useState(false);

	if (!isAuthenticated) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="text-center">
					<h2 className="text-lg font-semibold mb-2">Please sign in</h2>
					<p className="text-muted-foreground">You need to sign in to access settings</p>
				</div>
			</div>
		);
	}

	const isWallet = !!account?.address;
	const avatarSrc = me?.avatar_url ?? ensAvatar;
	const dirty = name.trim() !== (me?.display_name ?? "");

	const handleSave = async () => {
		setSaving(true);
		const ok = await updateProfile(name.trim() || null);
		setSaving(false);
		if (ok) toast.success("Profile updated");
	};

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
								<ProfileAvatar src={avatarSrc} address={account?.address} size="lg" />
								<div className="text-sm text-muted-foreground">
									{ensAvatar ? "ENS Avatar" : avatarSrc ? "From your account" : isWallet ? "Generated from address" : "Generated"}
								</div>
							</div>
						</div>

						{/* Editable display name (all sessions) */}
						<div className="space-y-2">
							<div className="text-sm font-medium">Display name</div>
							<div className="flex items-center gap-2">
								<Input
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="Your name"
									maxLength={50}
									className="flex-1"
								/>
								<Button onClick={handleSave} disabled={!dirty || saving}>
									{saving && <Loader2 className="h-4 w-4 animate-spin" />}
									Save
								</Button>
							</div>
							<p className="text-xs text-muted-foreground">Shown across the app instead of your email or address.</p>
						</div>

						{isWallet ? (
							<div className="space-y-2">
								<div className="text-sm font-medium">Address</div>
								<div className="flex items-center gap-2 p-3 bg-muted rounded-md">
									<code className="flex-1 text-sm font-mono">
										{ensDisplayName ?? ensName ?? formatAddress(account!.address)}
									</code>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => copyAddressToClipboard(account!.address)}
										className="h-8 w-8 p-0 hover:bg-background"
									>
										<Copy className="h-4 w-4" />
									</Button>
								</div>
							</div>
						) : (
							me?.email && (
								<div className="space-y-2">
									<div className="text-sm font-medium">Email</div>
									<div className="flex items-center gap-2 p-3 bg-muted rounded-md">
										<code className="flex-1 text-sm font-mono">{me.email}</code>
									</div>
								</div>
							)
						)}
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

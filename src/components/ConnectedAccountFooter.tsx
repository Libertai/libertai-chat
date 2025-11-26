import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Coins, Copy, Loader2, LogOut, Settings, Trophy } from "lucide-react";
import { useActiveAccount, useActiveWallet, useDisconnect } from "thirdweb/react";
import { useAccountStore } from "@/stores/account";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useENS } from "@/hooks/useENS";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { formatAddress, copyAddressToClipboard } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { useSidebar } from "@/components/ui/sidebar";

export function ConnectedAccountFooter() {
	const thirdwebAccount = useActiveAccount();
	const evmWallet = useActiveWallet();
	const solanaWallet = useSolanaWallet();
	const { disconnect } = useDisconnect();
	const account = useAccountStore((state) => state.account);
	const formattedLtaiBalance = useAccountStore((state) => state.formattedLTAIBalance());
	const isAuthenticating = useAccountStore((state) => state.isAuthenticating);
	const { isMobile, setOpenMobile } = useSidebar();

	// ENS resolution for Ethereum addresses
	const { name: ensName, displayName: ensDisplayName, avatar: ensAvatar } = useENS(account?.address);

	// Only show loading if there's actually a connected wallet AND we're authenticating
	const shouldShowEvmLoading = isAuthenticating && thirdwebAccount && evmWallet;
	const shouldShowSolanaLoading = isAuthenticating && solanaWallet.wallet;

	// Only render when connected
	if (!account?.address) {
		return null;
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					className="flex items-center gap-3 px-3 py-2 border-border w-full justify-start h-auto"
				>
					<ProfileAvatar src={ensAvatar} address={account.address} size="md" />
					<div className="flex flex-col items-start flex-1 min-w-0">
						<div className="text-md font-medium truncate w-full text-left">
							{ensDisplayName ?? ensName ?? formatAddress(account.address)}
						</div>
					</div>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-[220px]">
				<div className="px-2 py-2 border-b border-border">
					<p className="text-xs text-muted-foreground">Connected as</p>
					<div className="flex items-center gap-2">
						<ProfileAvatar src={ensAvatar} address={account.address} size="sm" />
						<div className="flex-1 min-w-0">
							<p className="font-medium truncate text-sm">{ensName ?? formatAddress(account.address)}</p>
						</div>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => copyAddressToClipboard(account.address)}
							className="h-6 w-6 p-0 hover:bg-muted flex-shrink-0"
						>
							<Copy className="h-3 w-3" />
						</Button>
					</div>
				</div>

				<div className="px-2 py-2">
					<p className="text-xs text-muted-foreground">Balance</p>
					<p className="font-medium flex items-center">
						{shouldShowSolanaLoading || shouldShowEvmLoading ? (
							<>
								<Loader2 className="h-3 w-3 mr-1 animate-spin" />
								Loading...
							</>
						) : (
							<>
								<Coins className="h-3 w-3 mr-1 text-primary" />
								{formattedLtaiBalance} LTAI
							</>
						)}
					</p>
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild className="cursor-pointer gap-2">
					<Link
						to="/settings"
						onClick={() => {
							if (isMobile) setOpenMobile(false);
						}}
					>
						<Settings className="h-4 w-4" />
						Settings
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild className="cursor-pointer gap-2">
					<Link
						to="/rewards"
						onClick={() => {
							if (isMobile) setOpenMobile(false);
						}}
					>
						<Trophy className="h-4 w-4" />
						Rewards
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={async () => {
						if (isMobile) setOpenMobile(false);
						if (thirdwebAccount !== undefined && evmWallet !== undefined) {
							disconnect(evmWallet);
						} else if (solanaWallet.wallet !== null) {
							await solanaWallet.disconnect();
						}
					}}
					className="cursor-pointer gap-2 text-destructive"
				>
					<LogOut className="h-4 w-4" />
					Disconnect
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

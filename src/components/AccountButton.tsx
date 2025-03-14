"use client";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, ExternalLink, LogIn, LogOut, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { thirdwebClient } from "@/config/thirdweb";
import { ConnectButton, useActiveAccount, useActiveWallet, useDisconnect } from "thirdweb/react";
import { base } from "thirdweb/chains";
import { useAccountStore } from "@/stores/account";

export default function AccountButton() {
	const account = useActiveAccount();
	const wallet = useActiveWallet();
	const { disconnect } = useDisconnect();
	const [mounted, setMounted] = useState(false);
	const [copySuccess, setCopySuccess] = useState(false);
	const onAccountChange = useAccountStore((state) => state.onAccountChange);

	// Prevent hydration errors by only rendering after mount
	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		onAccountChange(account).then();
	}, [account, onAccountChange]);

	// Format address to shorten it (e.g., 0x1234...5678)
	const formatAddress = (address: string | undefined) => {
		if (!address) return "";
		return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
	};

	// Copy address to clipboard
	const copyAddressToClipboard = () => {
		if (account?.address !== undefined) {
			navigator.clipboard.writeText(account.address);
			setCopySuccess(true);
			setTimeout(() => setCopySuccess(false), 2000);
		}
	};

	// View on explorer (placeholder - implement with your blockchain explorer)
	const viewOnExplorer = () => {
		if (account?.address !== undefined) {
			window.open(`https://etherscan.io/address/${account.address}`, "_blank");
		}
	};

	// Show a placeholder until client-side code takes over
	if (!mounted) {
		return (
			<Button variant="outline" disabled>
				<LogIn className="h-4 w-4 mr-2" />
				Account
			</Button>
		);
	}

	if (account !== undefined && wallet !== undefined) {
		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" className="flex items-center gap-2 px-3 h-9">
						<span className="text-sm">{formatAddress(account.address)}</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="min-w-[220px]">
					<DropdownMenuItem onClick={copyAddressToClipboard} className="cursor-pointer gap-2">
						<Copy className="h-4 w-4" />
						{copySuccess ? "Copied!" : "Copy Address"}
					</DropdownMenuItem>
					<DropdownMenuItem onClick={viewOnExplorer} className="cursor-pointer gap-2">
						<ExternalLink className="h-4 w-4" />
						View on Explorer
					</DropdownMenuItem>
					<DropdownMenuItem className="cursor-pointer gap-2">
						<Settings className="h-4 w-4" />
						Settings
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={() => disconnect(wallet)} className="cursor-pointer gap-2 text-destructive">
						<LogOut className="h-4 w-4" />
						Disconnect
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		);
	}

	return <ConnectButton client={thirdwebClient} chain={base} />;
}

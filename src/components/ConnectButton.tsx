import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Mail } from "lucide-react";
import { useEffect } from "react";
import { thirdwebClient } from "@/config/thirdweb";
import {
	ConnectButton as ConnectThirdwebButton,
	useActiveAccount,
	useActiveWallet,
	useConnectModal,
} from "thirdweb/react";
import { base } from "thirdweb/chains";
import { useAccountStore } from "@/stores/account";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import {
	useWalletModal as useSolanaWalletModal,
	WalletMultiButton as SolanaWalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { createWallet, inAppWallet } from "thirdweb/wallets";

const EthereumIcon = () => (
	<svg fill="currentColor" width="800px" height="800px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
		<title>Ethereum icon</title>
		<path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z" />
	</svg>
);

const SolanaIcon = () => (
	<svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" height="24" width="24">
		<title>Solana</title>
		<path d="m23.8764 18.0313 -3.962 4.1393a0.9201 0.9201 0 0 1 -0.306 0.2106 0.9407 0.9407 0 0 1 -0.367 0.0742H0.4599a0.4689 0.4689 0 0 1 -0.2522 -0.0733 0.4513 0.4513 0 0 1 -0.1696 -0.1962 0.4375 0.4375 0 0 1 -0.0314 -0.2545 0.4438 0.4438 0 0 1 0.117 -0.2298l3.9649 -4.1393a0.92 0.92 0 0 1 0.3052 -0.2102 0.9407 0.9407 0 0 1 0.3658 -0.0746H23.54a0.4692 0.4692 0 0 1 0.2523 0.0734 0.4531 0.4531 0 0 1 0.1697 0.196 0.438 0.438 0 0 1 0.0313 0.2547 0.4442 0.4442 0 0 1 -0.1169 0.2297zm-3.962 -8.3355a0.9202 0.9202 0 0 0 -0.306 -0.2106 0.941 0.941 0 0 0 -0.367 -0.0742H0.4599a0.4687 0.4687 0 0 0 -0.2522 0.0734 0.4513 0.4513 0 0 0 -0.1696 0.1961 0.4376 0.4376 0 0 0 -0.0314 0.2546 0.444 0.444 0 0 0 0.117 0.2297l3.9649 4.1394a0.9204 0.9204 0 0 0 0.3052 0.2102c0.1154 0.049 0.24 0.0744 0.3658 0.0746H23.54a0.469 0.469 0 0 0 0.2523 -0.0734 0.453 0.453 0 0 0 0.1697 -0.1961 0.4382 0.4382 0 0 0 0.0313 -0.2546 0.4444 0.4444 0 0 0 -0.1169 -0.2297zM0.46 6.7225h18.7815a0.9411 0.9411 0 0 0 0.367 -0.0742 0.9202 0.9202 0 0 0 0.306 -0.2106l3.962 -4.1394a0.4442 0.4442 0 0 0 0.117 -0.2297 0.4378 0.4378 0 0 0 -0.0314 -0.2546 0.453 0.453 0 0 0 -0.1697 -0.196 0.469 0.469 0 0 0 -0.2523 -0.0734H4.7596a0.941 0.941 0 0 0 -0.3658 0.0745 0.9203 0.9203 0 0 0 -0.3052 0.2102L0.1246 5.9687a0.4438 0.4438 0 0 0 -0.1169 0.2295 0.4375 0.4375 0 0 0 0.0312 0.2544 0.4512 0.4512 0 0 0 0.1692 0.196 0.4689 0.4689 0 0 0 0.2518 0.0739z"></path>
	</svg>
);

export default function ConnectButton() {
	const thirdwebAccount = useActiveAccount();
	const evmWallet = useActiveWallet();
	const solanaWallet = useSolanaWallet();
	const account = useAccountStore((state) => state.account);
	const onAccountChange = useAccountStore((state) => state.onAccountChange);
	const { connect } = useConnectModal();

	async function handleConnectEthereum() {
		await connect({
			client: thirdwebClient,
			chain: base,
			appMetadata: { name: "LibertAI", url: "https://console.libertai.io" },
			wallets: [
				createWallet("io.metamask"),
				createWallet("io.rabby"),
				createWallet("com.coinbase.wallet"),
				createWallet("com.trustwallet.app"),
				createWallet("app.zeal"),
			],
		});
	}

	async function handleConnectSocial() {
		await connect({
			client: thirdwebClient,
			chain: base,
			appMetadata: { name: "LibertAI", url: "https://console.libertai.io" },
			wallets: [inAppWallet()],
		});
	}

	const { setVisible: setSolanaModalVisible } = useSolanaWalletModal();

	useEffect(() => {
		onAccountChange(thirdwebAccount, solanaWallet).then();
	}, [thirdwebAccount, solanaWallet, onAccountChange, evmWallet]);

	evmWallet?.subscribe("accountChanged", (newAccount) => {
		onAccountChange(newAccount, solanaWallet).then();
	});

	// When connected, return null as content will be shown in sidebar footer
	if (account?.address) {
		return null;
	}

	return (
		<div className="relative">
			{/* Hidden components for auto-connection */}
			<div className="absolute opacity-0 pointer-events-none -z-10">
				<ConnectThirdwebButton client={thirdwebClient} chain={base} />
				<SolanaWalletMultiButton />
			</div>

			{/* Visible dropdown UI */}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" className="flex items-center gap-2 px-3 h-9 border-border">
						Connect
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="min-w-[240px] p-2">
					<DropdownMenuItem asChild className="p-0 focus:bg-transparent">
						<button
							onClick={handleConnectEthereum}
							className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left hover:bg-accent transition-colors cursor-pointer border-0 bg-transparent"
						>
							<div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
								<EthereumIcon />
							</div>
							<span className="text-sm font-medium">Ethereum</span>
						</button>
					</DropdownMenuItem>
					<DropdownMenuItem asChild className="p-0 focus:bg-transparent">
						<button
							onClick={() => setSolanaModalVisible(true)}
							className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left hover:bg-accent transition-colors cursor-pointer border-0 bg-transparent"
						>
							<div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
								<SolanaIcon />
							</div>
							<span className="text-sm font-medium">Solana</span>
						</button>
					</DropdownMenuItem>
					<DropdownMenuItem asChild className="p-0 focus:bg-transparent">
						<button
							onClick={handleConnectSocial}
							className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left hover:bg-accent transition-colors cursor-pointer border-0 bg-transparent"
						>
							<div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
								<Mail className="h-4 w-4" />
							</div>
							<span className="text-sm font-medium">Social Login</span>
						</button>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

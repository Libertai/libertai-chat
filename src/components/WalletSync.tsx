import { useEffect } from "react";
import { ConnectButton, useActiveAccount, useActiveWallet } from "thirdweb/react";
import { base } from "thirdweb/chains";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton as SolanaWalletMultiButton } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { thirdwebClient } from "@/config/thirdweb";
import { useAccountStore } from "@libertai/auth";

/**
 * Invisible, always-mounted component that keeps the wallet connection in sync with the
 * account store (auto-reconnect + authentication). Mounted globally so wallet sessions work
 * on every page, independent of the header UI.
 */
export default function WalletSync() {
	const thirdwebAccount = useActiveAccount();
	const evmWallet = useActiveWallet();
	const solanaWallet = useSolanaWallet();
	const onAccountChange = useAccountStore((state) => state.onAccountChange);

	useEffect(() => {
		onAccountChange(thirdwebAccount, solanaWallet).then();
	}, [thirdwebAccount, solanaWallet, onAccountChange, evmWallet]);

	// Subscribe to in-wallet EVM account switches once per wallet (in an effect, with
	// cleanup) — doing it during render would register a new listener every render.
	useEffect(() => {
		if (!evmWallet) return;
		const unsubscribe = evmWallet.subscribe("accountChanged", (newAccount) => {
			onAccountChange(newAccount, solanaWallet).then();
		});
		return () => unsubscribe();
	}, [evmWallet, solanaWallet, onAccountChange]);

	return (
		<div className="absolute invisible opacity-0 pointer-events-none -z-10">
			<ConnectButton client={thirdwebClient} chain={base} />
			<SolanaWalletMultiButton />
		</div>
	);
}

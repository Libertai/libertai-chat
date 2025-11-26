import { createFileRoute } from "@tanstack/react-router";
import { useRewards } from "@/hooks/data/use-rewards";
import { useAccountStore } from "@/stores/account";
import { formatAddress } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink } from "lucide-react";

export const Route = createFileRoute("/rewards")({
	component: Rewards,
});

function Rewards() {
	const account = useAccountStore((state) => state.account);
	const ltaiBalance = useAccountStore((state) => state.ltaiBalance);
	const { pendingTokens, estimated3YrTokens, isLoading } = useRewards();

	const handlePurchaseTokens = () => {
		window.open("https://libertai.io/tokenomics", "_blank");
	};

	return (
		<div className="container mx-auto px-4 py-8 max-w-4xl">
			<div className="flex flex-col space-y-8">
				{/* Header */}
				<div className="text-center">
					<h1 className="text-4xl font-bold mb-2">Earn LTAI Tokens</h1>
				</div>

				{/* Main Content Card */}
				<div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border p-6 md:p-8">
					<div className="space-y-6">
						{/* Wallet Info */}
						<div className="flex justify-between items-center pb-4 border-b border-border">
							<span className="text-muted-foreground">Connected Wallet</span>
							<span className="font-mono font-medium">{formatAddress(account?.address)}</span>
						</div>

						{/* Balance Stats */}
						<div className="space-y-4">
							{/* Current LTAI Balance */}
							<div className="flex justify-between items-center">
								<span className="text-card-foreground">Current LTAI balance</span>
								{isLoading ? (
									<Skeleton className="h-6 w-24" />
								) : (
									<span className="text-2xl font-bold">
										{ltaiBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
									</span>
								)}
							</div>

							{/* Pending LTAI */}
							<div className="flex justify-between items-center">
								<span className="text-card-foreground">Pending LTAI</span>
								{isLoading ? (
									<Skeleton className="h-6 w-16" />
								) : (
									<span className="text-2xl font-bold">
										{pendingTokens.toLocaleString(undefined, { maximumFractionDigits: 0 })}
									</span>
								)}
							</div>

							{/* 36 Month Estimated */}
							<div className="flex justify-between items-center">
								<span className="text-card-foreground">36 Month estimated LTAI*</span>
								{isLoading ? (
									<Skeleton className="h-6 w-24" />
								) : (
									<span className="text-2xl font-bold">
										{estimated3YrTokens.toLocaleString(undefined, { maximumFractionDigits: 0 })}
									</span>
								)}
							</div>
						</div>

						{/* Disclaimer */}
						<div className="text-xs text-muted-foreground pt-4 border-t border-border">
							<p>
								* Estimate only, and under current rates. If your participation stays at the same level. The
								availability of $LTAI tokens is subject to change without notice. We may suspend, modify, or terminate
								the program at our sole discretion and without liability. Your participation does not guarantee that you
								will receive any specific amount of tokens.
							</p>
						</div>

						{/* Purchase Button */}
						<div className="flex justify-center pt-4">
							<Button onClick={handlePurchaseTokens} size="lg" className="gap-2">
								Purchase Tokens
								<ExternalLink className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</div>

				{/* Additional Info */}
				<div className="p-6 bg-card/50 backdrop-blur-sm rounded-xl border border-border">
					<h2 className="text-xl font-semibold mb-4">About LTAI Rewards</h2>
					<div className="space-y-3 text-sm text-card-foreground">
						<p>
							Earn $LTAI tokens by participating in the LibertAI ecosystem. Your contributions are rewarded with $LTAI
							tokens that can be used for various purposes within the platform.
						</p>
						<ul className="list-disc list-inside space-y-2 ml-4">
							<li>
								<span className="font-medium">Current Balance</span> - Your available LTAI tokens on the blockchain
							</li>
							<li>
								<span className="font-medium">Pending LTAI</span> - Tokens awaiting distribution from your recent
								activity
							</li>
							<li>
								<span className="font-medium">36 Month Estimate</span> - Projected earnings based on current
								participation levels
							</li>
						</ul>
					</div>
				</div>
			</div>
		</div>
	);
}

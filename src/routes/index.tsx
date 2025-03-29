import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAccountStore } from "@/stores/account";
import { ArrowRight, Coins, Key, LayoutDashboard, LineChart, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import AccountButton from "@/components/AccountButton";
import { useCredits } from "@/hooks/use-credits";

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	const account = useAccountStore((state) => state.account);
	const { formattedCredits } = useCredits();
	const navigate = useNavigate();

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col items-center justify-center space-y-6 text-center">
				<h1 className="text-4xl font-bold sm:text-5xl lg:text-6xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-[#8a5cf5] dark:from-primary dark:to-[#b57efc]">
					LibertAI Developer Platform
				</h1>
				<p className="text-lg text-muted-foreground max-w-2xl">
					Connect your wallet, create API keys, and build powerful applications with LibertAI's inference capabilities
				</p>

				{!account ? (
					<div className="mt-8 flex flex-col items-center space-y-4">
						<p className="text-muted-foreground">Connect your wallet to get started</p>
						<div className="flex justify-center mt-4 mb-6">
							<AccountButton />
						</div>
						<div className="w-full max-w-md bg-card/50 backdrop-blur-sm p-6 rounded-xl border border-border">
							<div className="flex flex-col space-y-4">
								<p className="text-card-foreground">Access your developer dashboard to:</p>
								<ul className="text-left space-y-2">
									<li className="flex items-center gap-2">
										<Key className="h-5 w-5 text-primary" />
										<span>Create and manage API keys</span>
									</li>
									<li className="flex items-center gap-2">
										<LineChart className="h-5 w-5 text-primary" />
										<span>Monitor your usage stats</span>
									</li>
									<li className="flex items-center gap-2">
										<Coins className="h-5 w-5 text-primary" />
										<span>Top up your LTAI balance</span>
									</li>
									<li className="flex items-center gap-2">
										<MessageSquareText className="h-5 w-5 text-primary" />
										<span>Test LLM inference</span>
									</li>
								</ul>
							</div>
						</div>
					</div>
				) : (
					<div className="mt-8 w-full max-w-4xl">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<div className="bg-card/50 backdrop-blur-sm p-6 rounded-xl border border-border">
								<div className="flex items-center justify-between mb-4">
									<h2 className="text-xl font-semibold">Account Overview</h2>
									<Coins className="h-5 w-5 text-primary" />
								</div>
								<div className="space-y-2">
									<p className="text-muted-foreground">Current balance</p>
									<p className="text-3xl font-bold text-primary">${formattedCredits}</p>
									<Button className="w-full mt-4" onClick={() => navigate({ to: "/topup" })}>
										Top Up Balance
									</Button>
								</div>
							</div>

							<div className="bg-card/50 backdrop-blur-sm p-6 rounded-xl border border-border">
								<div className="flex items-center justify-between mb-4">
									<h2 className="text-xl font-semibold">Quick Actions</h2>
									<Key className="h-5 w-5 text-primary" />
								</div>
								<div className="space-y-4">
									<Button
										variant="outline"
										className="w-full justify-between"
										onClick={() => navigate({ to: "/dashboard" })}
									>
										<span className="flex items-center gap-2">
											<LayoutDashboard className="h-4 w-4" />
											Dashboard
										</span>
										<ArrowRight className="h-4 w-4" />
									</Button>
									<Button
										variant="outline"
										className="w-full justify-between"
										onClick={() => navigate({ to: "/api-keys" })}
									>
										<span className="flex items-center gap-2">
											<Key className="h-4 w-4" />
											API Keys
										</span>
										<ArrowRight className="h-4 w-4" />
									</Button>
									<Button
										variant="outline"
										className="w-full justify-between"
										onClick={() => navigate({ to: "/usage" })}
									>
										<span className="flex items-center gap-2">
											<LineChart className="h-4 w-4" />
											Usage Stats
										</span>
										<ArrowRight className="h-4 w-4" />
									</Button>
								</div>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AlertCircle, BarChart4, Coins, History, Key, LineChart, Zap } from "lucide-react";
import { useRequireAuth } from "@/hooks/use-auth";
import { useApiKeys } from "@/hooks/use-api-keys.ts";
import { useCredits } from "@/hooks/use-credits";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/dashboard")({
	component: Dashboard,
});

function Dashboard() {
	const { isAuthenticated } = useRequireAuth();
	const { formattedCredits } = useCredits();
	const navigate = useNavigate();
	const { apiKeys } = useApiKeys();
	const { apiCalls, tokensUsed, chartData, isLoading } = useDashboardStats();

	// Return null if not authenticated (redirect is handled by the hook)
	if (!isAuthenticated) {
		return null;
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col space-y-8">
				<div>
					<h1 className="text-3xl font-bold">Dashboard</h1>
					<p className="text-muted-foreground mt-1">Monitor your API usage and account statistics</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
					<div className="bg-card/50 backdrop-blur-sm p-6 rounded-xl border border-border">
						<div className="flex items-center gap-3 mb-2">
							<Coins className="h-5 w-5 text-primary" />
							<h2 className="text-lg font-medium">Balance</h2>
						</div>
						<p className="text-3xl font-bold">${formattedCredits}</p>
						<Button size="sm" className="mt-4" onClick={() => navigate({ to: "/topup" })}>
							Top Up
						</Button>
					</div>

					<div className="bg-card/50 backdrop-blur-sm p-6 rounded-xl border border-border">
						<div className="flex items-center gap-3 mb-2">
							<Zap className="h-5 w-5 text-primary" />
							<h2 className="text-lg font-medium">API Calls</h2>
						</div>
						<p className="text-3xl font-bold">{apiCalls}</p>
						<p className="text-xs text-muted-foreground mt-4">This month</p>
					</div>

					<div className="bg-card/50 backdrop-blur-sm p-6 rounded-xl border border-border">
						<div className="flex items-center gap-3 mb-2">
							<Key className="h-5 w-5 text-primary" />
							<h2 className="text-lg font-medium">Active Keys</h2>
						</div>
						<p className="text-3xl font-bold">{apiKeys.filter((key) => key.is_active).length}</p>
						<Button size="sm" variant="outline" className="mt-4" onClick={() => navigate({ to: "/api-keys" })}>
							Manage
						</Button>
					</div>

					<div className="bg-card/50 backdrop-blur-sm p-6 rounded-xl border border-border">
						<div className="flex items-center gap-3 mb-2">
							<LineChart className="h-5 w-5 text-primary" />
							<h2 className="text-lg font-medium">Tokens Used</h2>
						</div>
						<p className="text-3xl font-bold">{tokensUsed}</p>
						<p className="text-xs text-muted-foreground mt-4">This month</p>
					</div>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					<div className="lg:col-span-2 bg-card/50 backdrop-blur-sm p-6 rounded-xl border border-border">
						<div className="flex items-center justify-between mb-6">
							<h2 className="text-xl font-semibold">Usage Trends</h2>
							<BarChart4 className="h-5 w-5 text-primary" />
						</div>

						<div className="h-64">
							{isLoading ? (
								<div className="flex items-center justify-center h-full">
									<p className="text-muted-foreground">Loading chart data...</p>
								</div>
							) : (
								<ResponsiveContainer width="100%" height="100%">
									<AreaChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
										<defs>
											<linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
												<stop offset="5%" stopColor="var(--primary)" stopOpacity={0.8} />
												<stop offset="95%" stopColor="var(--primary)" stopOpacity={0.2} />
											</linearGradient>
										</defs>
										<CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
										<XAxis
											dataKey="month"
											tick={{ fontSize: 12 }}
											tickLine={false}
											axisLine={{ stroke: "var(--border)" }}
										/>
										<YAxis
											tick={{ fontSize: 12 }}
											tickLine={false}
											axisLine={{ stroke: "var(--border)" }}
											domain={[0, "dataMax + 5"]}
											tickFormatter={(value) => `$${value}`}
										/>
										<Tooltip
											contentStyle={{
												backgroundColor: "var(--card)",
												border: "1px solid var(--border)",
												borderRadius: "0.5rem",
												fontSize: "0.875rem",
												boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
											}}
											formatter={(value) => [`$${value}`, "Credits used"]}
											labelStyle={{ marginBottom: "5px", fontWeight: "bold" }}
										/>
										<Area
											type="monotone"
											dataKey="cost"
											name="Credits used"
											stroke="var(--primary)"
											fillOpacity={1}
											fill="url(#colorCost)"
										/>
									</AreaChart>
								</ResponsiveContainer>
							)}
						</div>
					</div>

					<div className="bg-card/50 backdrop-blur-sm p-6 rounded-xl border border-border">
						<div className="flex items-center justify-between mb-6">
							<h2 className="text-xl font-semibold">Quick Actions</h2>
							<Zap className="h-5 w-5 text-primary" />
						</div>

						<div className="space-y-3">
							<Button
								variant="outline"
								className="w-full justify-between"
								onClick={() => navigate({ to: "/api-keys" })}
							>
								<span className="flex items-center gap-2">
									<Key className="h-4 w-4" />
									Manage API Keys
								</span>
							</Button>
							<Button variant="outline" className="w-full justify-between" onClick={() => navigate({ to: "/usage" })}>
								<span className="flex items-center gap-2">
									<LineChart className="h-4 w-4" />
									View Detailed Usage
								</span>
							</Button>
							<Button variant="outline" className="w-full justify-between">
								<span className="flex items-center gap-2">
									<History className="h-4 w-4" />
									Request History
								</span>
							</Button>
							<Button variant="outline" className="w-full justify-between">
								<span className="flex items-center gap-2">
									<AlertCircle className="h-4 w-4" />
									API Documentation
								</span>
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

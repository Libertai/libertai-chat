import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BarChart3, BarChart4, Calendar as CalendarIcon, Download, HelpCircle, LineChart, Rocket } from "lucide-react";
import { useRequireAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useUsageStats } from "@/hooks/use-dashboard-stats";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import dayjs from "dayjs";

export const Route = createFileRoute("/usage")({
	component: Usage,
});

function formatDate(date: Date): string {
	return dayjs(date).format("YYYY-MM-DD");
}

function Usage() {
	const [timeRange, setTimeRange] = useState<"7d" | "30d" | "custom">("7d");
	const [startDate, setStartDate] = useState<string>(formatDate(dayjs().subtract(7, "day").toDate()));
	const [endDate, setEndDate] = useState<string>(formatDate(new Date()));

	// Use auth hook to require authentication
	const { isAuthenticated } = useRequireAuth();

	// Use the stats hook
	const { dailyChartData, totalRequests, inputTokens, outputTokens, totalCost, modelUsage, apiKeyUsage, isLoading } =
		useUsageStats(startDate, endDate);

	// Handle time range changes
	useEffect(() => {
		const now = new Date();

		if (timeRange === "7d") {
			setStartDate(formatDate(dayjs(now).subtract(7, "day").toDate()));
			setEndDate(formatDate(now));
		} else if (timeRange === "30d") {
			setStartDate(formatDate(dayjs(now).subtract(30, "day").toDate()));
			setEndDate(formatDate(now));
		}
	}, [timeRange]);

	// Function to handle export data to CSV
	const handleExportData = () => {
		// Create CSV content
		const headers = ["Date", "Input Tokens", "Output Tokens", "Total Tokens"];
		const csvRows = [
			headers.join(","),
			...dailyChartData.map((day) => [day.date, day.input_tokens, day.output_tokens, day.tokens].join(",")),
		];
		const csvContent = csvRows.join("\n");

		// Create a blob with the CSV data
		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);

		// Create a link and trigger download
		const link = document.createElement("a");
		link.setAttribute("href", url);
		link.setAttribute("download", `libertai-usage-${startDate}-to-${endDate}.csv`);
		link.style.visibility = "hidden";
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	// Return null if not authenticated (redirect is handled by the hook)
	if (!isAuthenticated) {
		return null;
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col space-y-8">
				<div className="flex justify-between items-center flex-wrap gap-4">
					<div>
						<h1 className="text-3xl font-bold">Usage Statistics</h1>
						<p className="text-muted-foreground mt-1">Monitor your API usage and costs</p>
					</div>
					<div className="flex items-center gap-2 flex-wrap">
						<Button variant={timeRange === "7d" ? "default" : "outline"} size="sm" onClick={() => setTimeRange("7d")}>
							7 Days
						</Button>
						<Button variant={timeRange === "30d" ? "default" : "outline"} size="sm" onClick={() => setTimeRange("30d")}>
							30 Days
						</Button>
						<Popover>
							<PopoverTrigger asChild>
								<Button
									variant={timeRange === "custom" ? "default" : "outline"}
									size="sm"
									className="w-auto justify-start text-left font-normal"
								>
									<CalendarIcon className="mr-2 h-4 w-4" />
									{timeRange === "custom"
										? startDate === endDate
											? startDate
											: `${startDate} - ${endDate}`
										: "Custom Range"}
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-auto p-0" align="start">
								<Calendar
									mode="range"
									defaultMonth={new Date()}
									selected={{
										from: startDate ? new Date(startDate) : undefined,
										to: endDate ? new Date(endDate) : undefined,
									}}
									onSelect={(range) => {
										if (range?.from) {
											setTimeRange("custom");
											setStartDate(formatDate(range.from));
											setEndDate(formatDate(range.to || range.from));
										}
									}}
									initialFocus
									disabled={(date) => date > new Date()}
								/>
							</PopoverContent>
						</Popover>
					</div>
				</div>

				{/* Summary Cards */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
					<div className="bg-card/50 backdrop-blur-sm p-6 rounded-xl border border-border">
						<div className="flex items-center gap-3 mb-2">
							<BarChart4 className="h-5 w-5 text-primary" />
							<h2 className="text-lg font-medium">Total Requests</h2>
						</div>
						<p className="text-3xl font-bold">{isLoading ? "Loading..." : totalRequests.toLocaleString()}</p>
					</div>

					<div className="bg-card/50 backdrop-blur-sm p-6 rounded-xl border border-border">
						<div className="flex items-center gap-3 mb-2">
							<LineChart className="h-5 w-5 text-primary" />
							<h2 className="text-lg font-medium">Input tokens</h2>
						</div>
						<p className="text-3xl font-bold">{isLoading ? "Loading..." : inputTokens.toLocaleString()}</p>
					</div>

					<div className="bg-card/50 backdrop-blur-sm p-6 rounded-xl border border-border">
						<div className="flex items-center gap-3 mb-2">
							<Rocket className="h-5 w-5 text-primary" />
							<h2 className="text-lg font-medium">Output Tokens</h2>
						</div>
						<p className="text-3xl font-bold">{isLoading ? "Loading..." : outputTokens.toLocaleString()}</p>
					</div>

					<div className="bg-card/50 backdrop-blur-sm p-6 rounded-xl border border-border">
						<div className="flex items-center gap-3 mb-2">
							<CalendarIcon className="h-5 w-5 text-primary" />
							<h2 className="text-lg font-medium">Cost</h2>
						</div>
						<p className="text-3xl font-bold">${isLoading ? "Loading..." : totalCost.toLocaleString()}</p>
					</div>
				</div>

				{/* Daily Usage Chart */}
				<div className="bg-card/50 backdrop-blur-sm md:p-6 max-sm:p-4 rounded-xl border border-border">
					<div className="flex items-center justify-between mb-6">
						<div className="flex items-center gap-3">
							<BarChart3 className="h-5 w-5 text-primary" />
							<h2 className="text-xl font-semibold">Daily Token Usage</h2>
						</div>
						<Button
							variant="outline"
							size="sm"
							onClick={handleExportData}
							disabled={isLoading || dailyChartData.length === 0}
						>
							<Download className="h-4 w-4 mr-2" />
							Export Data
						</Button>
					</div>

					<div className="h-72">
						{isLoading ? (
							<div className="h-full flex items-center justify-center">
								<p>Loading data...</p>
							</div>
						) : dailyChartData.length === 0 ? (
							<div className="h-full flex items-center justify-center">
								<p>No data available for the selected date range</p>
							</div>
						) : (
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={dailyChartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
									<CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
									<XAxis
										dataKey="date"
										tick={{ fontSize: 12 }}
										tickLine={false}
										axisLine={{ stroke: "var(--border)" }}
									/>
									<YAxis
										yAxisId="left"
										orientation="left"
										tick={{ fontSize: 12 }}
										tickLine={false}
										axisLine={{ stroke: "var(--border)" }}
										tickFormatter={(value) => value.toLocaleString()}
									/>
									<YAxis
										yAxisId="right"
										orientation="right"
										tick={{ fontSize: 12 }}
										tickLine={false}
										axisLine={{ stroke: "var(--border)" }}
										tickFormatter={(value) => value.toLocaleString()}
									/>
									<Tooltip
										contentStyle={{
											backgroundColor: "var(--card)",
											border: "1px solid var(--border)",
											borderRadius: "0.5rem",
											fontSize: "0.875rem",
											boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
										}}
										formatter={(value, name) => [value.toLocaleString(), name]}
										itemStyle={{ padding: "4px 0" }}
										cursor={{ fill: "rgba(128, 128, 128, 0.1)" }}
										labelFormatter={(label) => `Date: ${label}`}
									/>
									<Legend
										align="center"
										verticalAlign="bottom"
										iconType="circle"
										iconSize={8}
										wrapperStyle={{ paddingTop: "10px" }}
									/>
									<Bar
										yAxisId="right"
										dataKey="input_tokens"
										name="Input"
										fill="#7c3aed"
										radius={[4, 4, 0, 0]}
										barSize={24}
									/>
									<Bar
										yAxisId="right"
										dataKey="output_tokens"
										name="Output"
										fill="#a78bfa"
										radius={[4, 4, 0, 0]}
										barSize={24}
									/>
								</BarChart>
							</ResponsiveContainer>
						)}
					</div>
				</div>

				{/* Usage by Model and API Key */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<div className="bg-card/50 backdrop-blur-sm p-6 rounded-xl border border-border">
						<div className="flex items-center justify-between mb-6">
							<h2 className="text-xl font-semibold">Usage by Model</h2>
							<HelpCircle className="h-4 w-4 text-muted-foreground" />
						</div>

						<div className="overflow-x-auto">
							{isLoading ? (
								<p>Loading data...</p>
							) : modelUsage.length === 0 ? (
								<p>No data available for the selected date range</p>
							) : (
								<table className="w-full">
									<thead>
										<tr className="border-b border-border">
											<th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Model</th>
											<th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Requests</th>
											<th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Tokens</th>
											<th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Cost</th>
										</tr>
									</thead>
									<tbody>
										{modelUsage.map((model, index) => (
											<tr key={index} className="border-b border-border/50 hover:bg-card/70">
												<td className="px-4 py-3 text-sm font-medium">{model.name}</td>
												<td className="px-4 py-3 text-sm text-right">{model.calls}</td>
												<td className="px-4 py-3 text-sm text-right">{model.total_tokens}</td>
												<td className="px-4 py-3 text-sm text-right">${model.cost}</td>
											</tr>
										))}
									</tbody>
								</table>
							)}
						</div>
					</div>

					<div className="bg-card/50 backdrop-blur-sm p-6 rounded-xl border border-border">
						<div className="flex items-center justify-between mb-6">
							<h2 className="text-xl font-semibold">Usage by API Key</h2>
							<HelpCircle className="h-4 w-4 text-muted-foreground" />
						</div>

						<div className="overflow-x-auto">
							{isLoading ? (
								<p>Loading data...</p>
							) : apiKeyUsage.length === 0 ? (
								<p>No data available for the selected date range</p>
							) : (
								<table className="w-full">
									<thead>
										<tr className="border-b border-border">
											<th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">API Key</th>
											<th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Requests</th>
											<th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Tokens</th>
											<th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Cost</th>
										</tr>
									</thead>
									<tbody>
										{apiKeyUsage.map((key, index) => (
											<tr key={index} className="border-b border-border/50 hover:bg-card/70">
												<td className="px-4 py-3 text-sm font-medium">{key.name}</td>
												<td className="px-4 py-3 text-sm text-right">{key.calls}</td>
												<td className="px-4 py-3 text-sm text-right">{key.total_tokens}</td>
												<td className="px-4 py-3 text-sm text-right">${key.cost}</td>
											</tr>
										))}
									</tbody>
								</table>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

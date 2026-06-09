import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSubscription, UsageCreditsCard } from "@libertai/auth";

export const Route = createFileRoute("/usage")({
	component: Usage,
});

/** Relative reset, e.g. "Resets in 1h 2m" (for the short rolling window). */
function resetsInLabel(resetsAt: string | null | undefined, now: number): string {
	if (!resetsAt) return "";
	const diff = new Date(resetsAt).getTime() - now;
	if (diff <= 0) return "Resets now";
	const m = Math.floor(diff / 60_000);
	const h = Math.floor(m / 60);
	if (h >= 1) return `Resets in ${h}h ${m % 60}m`;
	return `Resets in ${Math.max(1, m)}m`;
}

/** Absolute reset, e.g. "Resets Sun 4:59 PM" (for the weekly window). */
function resetsAtLabel(resetsAt: string | null | undefined): string {
	if (!resetsAt) return "";
	const d = new Date(resetsAt);
	return `Resets ${d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}`;
}

function UsageRow({
	label,
	sublabel,
	used,
	limit,
}: Readonly<{ label: string; sublabel?: string; used: number; limit: number }>) {
	const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
	const barColor = pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-primary";
	return (
		<div className="flex items-center gap-4 py-3">
			<div className="w-40 shrink-0">
				<div className="font-medium">{label}</div>
				{sublabel && <div className="text-sm text-muted-foreground">{sublabel}</div>}
			</div>
			<div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
				<div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
			</div>
			<div className="w-20 shrink-0 text-right text-sm text-muted-foreground">{pct}% used</div>
		</div>
	);
}

function Usage() {
	const navigate = useNavigate();
	const { data: subscription } = useSubscription();
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 60_000);
		return () => clearInterval(id);
	}, []);

	const tier = subscription?.tier ?? "free";

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="mx-auto flex max-w-3xl flex-col space-y-8">
				<div>
					<h1 className="text-3xl font-bold">Usage</h1>
					<p className="mt-1 text-muted-foreground">Your plan allowance and prepaid credits.</p>
				</div>

				{/* Plan usage limits */}
				<section className="rounded-xl border border-border bg-card/50 p-6">
					<div className="mb-2 flex items-center gap-2">
						<h2 className="text-lg font-semibold">Plan usage limits</h2>
						<span className="capitalize text-muted-foreground">{tier}</span>
					</div>
					<UsageRow
						label="Current session"
						sublabel={resetsInLabel(subscription?.window_5h_resets_at, now)}
						used={subscription?.window_5h_used ?? 0}
						limit={subscription?.window_5h_limit ?? 0}
					/>
					<div className="mt-4 mb-1 text-sm font-semibold">Weekly limit</div>
					<UsageRow
						label="All usage"
						sublabel={resetsAtLabel(subscription?.weekly_resets_at)}
						used={subscription?.weekly_used ?? 0}
						limit={subscription?.weekly_limit ?? 0}
					/>
				</section>

				{/* Usage credits (prepaid overflow) */}
				<UsageCreditsCard
					balance={subscription?.prepaid_balance ?? 0}
					description="Used once your plan allowance runs out. Top up to keep chatting after you hit a limit."
					onUpgrade={() => navigate({ to: "/plans" })}
					onBuyCredits={() => navigate({ to: "/top-up" })}
				/>
			</div>
		</div>
	);
}

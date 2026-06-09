import { useNavigate } from "@tanstack/react-router";
import { useSubscription } from "@libertai/auth";
import { Button } from "@/components/ui/button";

function resetsLabel(resetsAt?: string | null): string {
	if (!resetsAt) return "soon";
	const diff = new Date(resetsAt).getTime() - Date.now();
	if (diff <= 0) return "soon";
	const h = Math.floor(diff / 3_600_000);
	if (h >= 24) return `in ${Math.floor(h / 24)}d ${h % 24}h`;
	if (h >= 1) return `in ${h}h`;
	return `in ${Math.max(1, Math.floor(diff / 60_000))}m`;
}

/** Hard wall shown above the composer when the user has exhausted their free allowance and prepaid. */
export function ChatPaywall() {
	const navigate = useNavigate();
	const { data: subscription } = useSubscription();

	// Surface the limit that actually caused the block. A block needs only ONE window exhausted, so
	// "weekly resets…" is wrong when it's the 5-hour window that's full. If the weekly window is the
	// exhausted (binding) one, show that; otherwise the shorter session window is what to wait on.
	const weeklyExhausted =
		(subscription?.weekly_limit ?? 0) > 0 && (subscription?.weekly_used ?? 0) >= (subscription?.weekly_limit ?? 0);
	// The window to wait on is the weekly one when it's exhausted, or when there's no active 5h
	// window to report against (fall back to weekly rather than show a bogus session countdown).
	const bindingWindowIsWeekly = weeklyExhausted || !subscription?.window_5h_resets_at;
	const limitName = bindingWindowIsWeekly ? "weekly allowance" : "session limit";
	const resets = resetsLabel(
		bindingWindowIsWeekly ? subscription?.weekly_resets_at : subscription?.window_5h_resets_at,
	);

	return (
		<div className="mx-auto mb-3 max-w-3xl rounded-xl border border-border bg-card/60 p-4">
			<p className="text-sm font-medium">You've used your free allowance.</p>
			<p className="mt-1 text-sm text-muted-foreground">
				Your {limitName} resets {resets}. Upgrade your plan or top up credits to keep chatting now.
			</p>
			<div className="mt-3 flex gap-2">
				<Button size="sm" onClick={() => navigate({ to: "/plans" })}>
					Upgrade
				</Button>
				<Button size="sm" variant="outline" onClick={() => navigate({ to: "/top-up" })}>
					Top up credits
				</Button>
			</div>
		</div>
	);
}

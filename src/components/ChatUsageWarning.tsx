import { useState } from "react";
import { X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { AllowanceBar, useSubscription } from "@libertai/auth";
import { Button } from "@/components/ui/button";

// Warn once a window crosses this share of its allowance — early enough to act before the
// hard ChatPaywall (100%) kicks in. Windows are small, so a single message can overshoot;
// this is best-effort runway, not a guarantee.
const WARN_THRESHOLD = 0.8;

/**
 * Soft, dismissible heads-up shown above the composer when the user is running low on the
 * binding allowance window (whichever of the 5h/weekly windows is closest to its cap). Only
 * renders between {WARN_THRESHOLD} and 100% — below that there's nothing to say, at/over 100%
 * the hard ChatPaywall takes over instead.
 */
export function ChatUsageWarning() {
	const navigate = useNavigate();
	const { data: sub } = useSubscription();
	const [dismissedFor, setDismissedFor] = useState<string | null>(null);

	if (!sub) return null;

	// Only windows with a real cap can bind; pick the one closest to its limit.
	const windows = [
		{
			name: "session limit",
			used: sub.window_5h_used ?? 0,
			limit: sub.window_5h_limit ?? 0,
			resetsAt: sub.window_5h_resets_at,
		},
		{
			name: "weekly allowance",
			used: sub.weekly_used ?? 0,
			limit: sub.weekly_limit ?? 0,
			resetsAt: sub.weekly_resets_at,
		},
	].filter((w) => w.limit > 0);
	const binding = windows.sort((a, b) => b.used / b.limit - a.used / a.limit)[0];
	if (!binding) return null;

	const ratio = binding.used / binding.limit;
	if (ratio < WARN_THRESHOLD || ratio >= 1) return null;

	// Re-show when a fresh window starts (its reset time changes); stay hidden once dismissed for this one.
	const windowKey = `${binding.name}:${binding.resetsAt ?? ""}`;
	if (dismissedFor === windowKey) return null;

	return (
		<div className="mx-auto mb-3 max-w-3xl rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
			<div className="flex items-start justify-between gap-3">
				<p className="text-sm font-medium">You're running low on your {binding.name}</p>
				<button
					type="button"
					onClick={() => setDismissedFor(windowKey)}
					aria-label="Dismiss"
					className="text-muted-foreground hover:text-foreground cursor-pointer"
				>
					<X className="h-4 w-4" />
				</button>
			</div>
			<div className="mt-3">
				<AllowanceBar
					label={binding.name.charAt(0).toUpperCase() + binding.name.slice(1)}
					used={binding.used}
					limit={binding.limit}
					resetsAt={binding.resetsAt}
					now={Date.now()}
				/>
			</div>
			<p className="mt-2 text-xs text-muted-foreground">
				Once it's used up, messages draw from your prepaid credits, or pause until the window resets.
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

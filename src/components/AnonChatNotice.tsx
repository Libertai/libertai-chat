import { useNavigate, useRouter } from "@tanstack/react-router";
import { Button } from "@libertai/ui/button";
import { useAnonUsage } from "@/hooks/data/use-anon-usage";

const WARN_REMAINING = 3;

/**
 * For logged-out users: a free-message meter above the composer. Shows nothing until the IP's
 * anonymous allowance is running low, a soft "N left — sign in" warning near the limit, and a
 * sign-in wall once it's used up. The CTA is always Sign in (not Upgrade) — these users have no
 * account yet, and signing in is free with a higher limit.
 */
export function AnonChatNotice() {
	const navigate = useNavigate();
	const router = useRouter();
	const { data } = useAnonUsage();

	if (!data) return null;

	const goSignIn = () => {
		const { href } = router.state.location;
		void navigate({ to: "/login", search: { redirect: href === "/" ? undefined : href } });
	};

	if (!data.allowed) {
		return (
			<div className="mx-auto mb-3 max-w-3xl rounded-xl border border-border bg-card/60 p-4">
				<p className="text-sm font-medium">You've used your {data.limit} free messages.</p>
				<p className="mt-1 text-sm text-muted-foreground">Sign in to keep chatting — it's free, with a higher limit.</p>
				<div className="mt-3">
					<Button size="sm" onClick={goSignIn}>
						Sign in
					</Button>
				</div>
			</div>
		);
	}

	const remaining = Math.max(0, data.limit - data.used);
	if (remaining > WARN_REMAINING) return null;

	return (
		<div className="mx-auto mb-3 max-w-3xl flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
			<p className="text-sm">
				{remaining} free message{remaining === 1 ? "" : "s"} left.{" "}
				<span className="text-muted-foreground">Sign in to keep chatting for free.</span>
			</p>
			<Button size="sm" variant="outline" onClick={goSignIn}>
				Sign in
			</Button>
		</div>
	);
}

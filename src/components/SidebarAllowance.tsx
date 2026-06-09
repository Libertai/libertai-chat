import { useEffect, useState } from "react";
import { AllowanceBar, useAccountStore, useSubscription } from "@libertai/auth";

/**
 * Compact weekly-allowance meter for the sidebar footer. Only renders for signed-in users with
 * a loaded subscription. `now` ticks each minute so the reset countdown stays roughly current.
 */
export function SidebarAllowance() {
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);
	const { data: subscription } = useSubscription();
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 60_000);
		return () => clearInterval(id);
	}, []);

	if (!isAuthenticated || !subscription) return null;

	return (
		<div className="px-2 pb-2">
			<AllowanceBar
				label="Weekly allowance"
				used={subscription.weekly_used ?? 0}
				limit={subscription.weekly_limit ?? 0}
				resetsAt={subscription.weekly_resets_at}
				now={now}
			/>
		</div>
	);
}

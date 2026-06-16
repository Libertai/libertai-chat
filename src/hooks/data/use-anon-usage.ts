import { useQuery } from "@tanstack/react-query";
import { useAccountStore } from "@libertai/auth";
import env from "@/config/env";

export interface AnonUsage {
	used: number;
	limit: number;
	allowed: boolean;
	resets_at: string | null;
}

/**
 * Anonymous (logged-out) free-message usage for the current client IP, from the chat proxy's
 * /chat/anon-usage endpoint. Only fetched when NOT authenticated — signed-in users have their
 * own allowance via useSubscription. No credentials needed (the limit is keyed by IP).
 */
export function useAnonUsage() {
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);
	return useQuery<AnonUsage>({
		queryKey: ["anon-usage"],
		queryFn: async () => {
			const res = await fetch(`${env.LTAI_INFERENCE_API_URL}/chat/anon-usage`);
			if (!res.ok) throw new Error("Failed to load anonymous usage");
			return res.json();
		},
		enabled: !isAuthenticated,
		staleTime: 30_000,
	});
}

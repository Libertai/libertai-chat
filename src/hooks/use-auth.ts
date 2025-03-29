import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAccountStore } from "@/stores/account.ts";

export function useRequireAuth() {
	const account = useAccountStore((state) => state.account);
	const jwtToken = useAccountStore((state) => state.jwtToken);
	const navigate = useNavigate();

	useEffect(() => {
		if (!account || !jwtToken) {
			toast.error("Authentication Required", {
				description: "Please connect your wallet & sign the message to access this page",
				duration: 5000,
			});
			navigate({ to: "/" });
		}
	}, [account, jwtToken, navigate]);

	return { isAuthenticated: !!account && !!jwtToken };
}

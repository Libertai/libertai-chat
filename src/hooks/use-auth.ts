import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAccountStore } from "@/stores/account.ts";

export function useRequireAuth() {
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);
	const account = useAccountStore((state) => state.account);
	const isInitialLoad = useAccountStore((state) => state.isInitialLoad);
	const navigate = useNavigate();
	const [hasWaited, setHasWaited] = useState(false);

	useEffect(() => {
		// Give time for authentication to complete on initial load
		if (isInitialLoad && !hasWaited) {
			const timer = setTimeout(() => {
				setHasWaited(true);
			}, 1000); // Wait 1 second for auth to complete

			return () => clearTimeout(timer);
		}
	}, [isInitialLoad, hasWaited]);

	useEffect(() => {
		// Only redirect if not on initial load OR we've waited for auth to complete
		if ((hasWaited || !isInitialLoad) && (!isAuthenticated || !account?.address)) {
			if (!isInitialLoad) {
				toast.error("Authentication Required", {
					description: "Please connect your wallet & sign the message to access this page",
					duration: 5000,
				});
			}
			navigate({ to: "/" });
		}
	}, [isAuthenticated, account?.address, navigate, isInitialLoad, hasWaited]);

	return { isAuthenticated };
}

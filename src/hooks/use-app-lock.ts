import { useCallback, useEffect, useState } from "react";
import { getNativeErrorMessage } from "@/lib/mobile-media";
import { MOBILE_APP_LOCK_STORAGE_KEY } from "@/lib/mobile-local-data";
import { isMobileBetaApp } from "@/lib/mobile-runtime";
import { authenticateMobileAppLock } from "@/lib/mobile-security";

export const MOBILE_APP_LOCK_CHANGED_EVENT = "libertai-mobile-beta-app-lock-changed";

type StoredAppLock = {
	enabled: boolean;
	updatedAt?: string;
};

function readStoredAppLock(): StoredAppLock {
	const raw = localStorage.getItem(MOBILE_APP_LOCK_STORAGE_KEY);
	if (!raw) return { enabled: false };

	try {
		const parsed = JSON.parse(raw) as Partial<StoredAppLock>;
		return { enabled: parsed.enabled === true, updatedAt: parsed.updatedAt };
	} catch {
		return { enabled: raw === "true" };
	}
}

function writeStoredAppLock(enabled: boolean) {
	const payload: StoredAppLock = { enabled, updatedAt: new Date().toISOString() };
	localStorage.setItem(MOBILE_APP_LOCK_STORAGE_KEY, JSON.stringify(payload));
	window.dispatchEvent(new Event(MOBILE_APP_LOCK_CHANGED_EVENT));
}

export function isAppLockEnabled(): boolean {
	return readStoredAppLock().enabled;
}

export function useAppLock() {
	const nativeBeta = isMobileBetaApp();
	const [enabled, setEnabled] = useState(() => isAppLockEnabled());
	const [isLocked, setIsLocked] = useState(() => nativeBeta && isAppLockEnabled());
	const [isAuthenticating, setIsAuthenticating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const refresh = () => {
			const nextEnabled = isAppLockEnabled();
			setEnabled(nextEnabled);
			if (!nextEnabled) setIsLocked(false);
		};

		window.addEventListener(MOBILE_APP_LOCK_CHANGED_EVENT, refresh);
		window.addEventListener("storage", refresh);
		return () => {
			window.removeEventListener(MOBILE_APP_LOCK_CHANGED_EVENT, refresh);
			window.removeEventListener("storage", refresh);
		};
	}, []);

	useEffect(() => {
		if (!nativeBeta || !enabled) {
			setIsLocked(false);
			return;
		}

		const lock = () => setIsLocked(true);
		const handleVisibilityChange = () => {
			if (document.visibilityState === "hidden") lock();
		};

		let cancelled = false;
		let removeResumeListener: (() => void) | undefined;

		document.addEventListener("visibilitychange", handleVisibilityChange);
		void import("@capacitor/app")
			.then(async ({ App }) => {
				const handle = await App.addListener("resume", lock);
				if (cancelled) {
					void handle.remove();
				} else {
					removeResumeListener = () => {
						void handle.remove();
					};
				}
			})
			.catch(() => undefined);

		return () => {
			cancelled = true;
			removeResumeListener?.();
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [enabled, nativeBeta]);

	const unlock = useCallback(async () => {
		setIsAuthenticating(true);
		setError(null);
		try {
			await authenticateMobileAppLock();
			setIsLocked(false);
		} catch (unlockError) {
			setError(getNativeErrorMessage(unlockError, "Unable to unlock the app."));
			throw unlockError;
		} finally {
			setIsAuthenticating(false);
		}
	}, []);

	const setAppLockEnabled = useCallback(async (nextEnabled: boolean) => {
		setIsAuthenticating(true);
		setError(null);
		try {
			if (nextEnabled) {
				await authenticateMobileAppLock("Enable app lock");
			}

			writeStoredAppLock(nextEnabled);
			setEnabled(nextEnabled);
			setIsLocked(false);
		} catch (toggleError) {
			const message = getNativeErrorMessage(toggleError, "Unable to update app lock.");
			setError(message);
			throw new Error(message);
		} finally {
			setIsAuthenticating(false);
		}
	}, []);

	return {
		enabled,
		error,
		isAuthenticating,
		isLocked,
		setAppLockEnabled,
		unlock,
	};
}

import { useCallback, useState } from "react";
import { Capacitor } from "@capacitor/core";
import type { RegistrationError, Token } from "@capacitor/push-notifications";
import { useAccountStore } from "@libertai/auth";
import { libertaiConfig } from "@libertai/auth";
import { getNativeErrorMessage, MobilePluginUnavailableError } from "@/lib/mobile-media";
import { MOBILE_PUSH_STORAGE_KEY } from "@/lib/mobile-local-data";
import { getNativeMobilePlatform, isMobileBetaApp } from "@/lib/mobile-runtime";

type StoredPush = {
	enabled: boolean;
	token?: string;
	updatedAt?: string;
};

function readStoredPush(): StoredPush {
	const raw = localStorage.getItem(MOBILE_PUSH_STORAGE_KEY);
	if (!raw) return { enabled: false };

	try {
		const parsed = JSON.parse(raw) as Partial<StoredPush>;
		return {
			enabled: parsed.enabled === true,
			token: parsed.token,
			updatedAt: parsed.updatedAt,
		};
	} catch {
		return { enabled: raw === "true" };
	}
}

function writeStoredPush(next: StoredPush) {
	localStorage.setItem(
		MOBILE_PUSH_STORAGE_KEY,
		JSON.stringify({
			...next,
			updatedAt: new Date().toISOString(),
		}),
	);
}

async function registerDeviceToken(token: string) {
	const response = await fetch(`${libertaiConfig().apiBaseUrl}/devices`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			token,
			platform: getNativeMobilePlatform(),
		}),
	});

	if (!response.ok) {
		throw new Error(`Device registration failed (${response.status}).`);
	}
}

async function deleteDeviceToken(token: string) {
	const response = await fetch(`${libertaiConfig().apiBaseUrl}/devices/${encodeURIComponent(token)}`, {
		method: "DELETE",
		credentials: "include",
	});

	if (!response.ok && response.status !== 404) {
		throw new Error(`Device unregistration failed (${response.status}).`);
	}
}

async function waitForPushToken(
	PushNotifications: typeof import("@capacitor/push-notifications").PushNotifications,
): Promise<string> {
	let cleanedUp = false;
	let timeout: ReturnType<typeof setTimeout> | undefined;
	let registrationHandle: { remove: () => Promise<void> } | undefined;
	let errorHandle: { remove: () => Promise<void> } | undefined;

	const cleanup = async () => {
		if (cleanedUp) return;
		cleanedUp = true;
		if (timeout) clearTimeout(timeout);
		await Promise.all([registrationHandle?.remove(), errorHandle?.remove()]);
	};

	return new Promise((resolve, reject) => {
		timeout = setTimeout(() => {
			void cleanup();
			reject(new Error("Push registration timed out."));
		}, 15000);

		void Promise.all([
			PushNotifications.addListener("registration", (token: Token) => {
				void cleanup();
				resolve(token.value);
			}),
			PushNotifications.addListener("registrationError", (error: RegistrationError) => {
				void cleanup();
				reject(new Error(error.error || "Push registration failed."));
			}),
		])
			.then(([registration, registrationError]) => {
				registrationHandle = registration;
				errorHandle = registrationError;
				return PushNotifications.register();
			})
			.catch((error: unknown) => {
				void cleanup();
				reject(error);
			});
	});
}

export function usePushNotifications() {
	const nativeBeta = isMobileBetaApp();
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);
	const [enabled, setEnabled] = useState(() => nativeBeta && readStoredPush().enabled);
	const [isUpdating, setIsUpdating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const setPushEnabled = useCallback(
		async (nextEnabled: boolean) => {
			setIsUpdating(true);
			setError(null);

			try {
				if (!nativeBeta) {
					throw new MobilePluginUnavailableError("Push notifications are only available in the mobile beta app.");
				}
				if (!isAuthenticated) {
					throw new Error("Sign in to enable notifications.");
				}
				if (!Capacitor.isPluginAvailable("PushNotifications")) {
					throw new MobilePluginUnavailableError("Push notifications are not available on this device.");
				}

				const { PushNotifications } = await import("@capacitor/push-notifications");

				if (nextEnabled) {
					const permission = await PushNotifications.requestPermissions();
					if (permission.receive !== "granted") {
						throw new Error("Notification permission was not granted.");
					}

					const token = await waitForPushToken(PushNotifications);
					await registerDeviceToken(token);
					writeStoredPush({ enabled: true, token });
					setEnabled(true);
					return;
				}

				const token = readStoredPush().token;
				if (token) await deleteDeviceToken(token);
				await PushNotifications.unregister().catch(() => undefined);
				writeStoredPush({ enabled: false });
				setEnabled(false);
			} catch (pushError) {
				const message = getNativeErrorMessage(pushError, "Unable to update push notifications.");
				setError(message);
				throw new Error(message);
			} finally {
				setIsUpdating(false);
			}
		},
		[isAuthenticated, nativeBeta],
	);

	return {
		enabled,
		error,
		isAvailable: nativeBeta,
		isUpdating,
		setPushEnabled,
	};
}

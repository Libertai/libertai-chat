import { isMobileBetaApp } from "@/lib/mobile-runtime";
import { MobilePluginUnavailableError } from "@/lib/mobile-media";

export type MobileBiometryAvailability = {
	isAvailable: boolean;
	reason: string | null;
};

export async function checkMobileBiometryAvailability(): Promise<MobileBiometryAvailability> {
	if (!isMobileBetaApp()) {
		return {
			isAvailable: false,
			reason: "App lock is only available in the mobile beta app.",
		};
	}

	try {
		const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
		const result = await BiometricAuth.checkBiometry();

		return {
			isAvailable: result.isAvailable,
			reason: result.isAvailable ? null : result.reason || "Biometric authentication is not available on this device.",
		};
	} catch (error) {
		return {
			isAvailable: false,
			reason: error instanceof Error ? error.message : "Biometric authentication is not available on this device.",
		};
	}
}

export async function authenticateMobileAppLock(reason = "Unlock LibertAI Chat"): Promise<void> {
	const availability = await checkMobileBiometryAvailability();
	if (!availability.isAvailable) {
		throw new MobilePluginUnavailableError(availability.reason ?? "App lock is not available on this device.");
	}

	const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
	await BiometricAuth.authenticate({
		reason,
		allowDeviceCredential: true,
		cancelTitle: "Cancel",
		androidTitle: "Unlock LibertAI Chat",
		androidSubtitle: "Confirm it is you to continue",
	});
}

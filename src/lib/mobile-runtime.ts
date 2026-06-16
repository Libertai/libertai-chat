import { Capacitor } from "@capacitor/core";
import env from "@/config/env";

export function isTruthyMobileBetaFlag(value: unknown): boolean {
	if (typeof value === "boolean") return value;
	if (typeof value !== "string") return false;

	const normalized = value.trim().toLowerCase();
	return normalized !== "" && normalized !== "0" && normalized !== "false" && normalized !== "off" && normalized !== "no";
}

export function isNativeMobileApp(): boolean {
	return Capacitor.isNativePlatform();
}

export function isMobileBetaApp(): boolean {
	return env.MOBILE_BETA && isNativeMobileApp();
}

export function getNativeMobilePlatform(): string {
	return Capacitor.getPlatform();
}

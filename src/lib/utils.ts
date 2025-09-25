import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast } from "sonner";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatAddress(address: string | undefined) {
	if (!address) return "";
	return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

export async function copyAddressToClipboard(address: string | null) {
	if (address === null) {
		toast.error("No address to copy");
		return;
	}
	await navigator.clipboard.writeText(address);
	toast.success("Address copied to clipboard");
}

export function isMobileDevice(): boolean {
	return (
		/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
		navigator.maxTouchPoints > 2
	);
}

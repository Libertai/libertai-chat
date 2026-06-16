import { Capacitor } from "@capacitor/core";
import { isMobileBetaApp } from "@/lib/mobile-runtime";
import { MobilePluginUnavailableError } from "@/lib/mobile-media";

type MobileShareOptions = {
	title?: string;
	text?: string;
	url?: string;
};

export async function shareMobileBetaContent(options: MobileShareOptions): Promise<void> {
	if (!isMobileBetaApp()) {
		throw new MobilePluginUnavailableError("Native sharing is only available in the mobile beta app.");
	}
	if (!Capacitor.isPluginAvailable("Share")) {
		throw new MobilePluginUnavailableError("Native sharing is not available on this device.");
	}

	const { Share } = await import("@capacitor/share");
	const canShare = await Share.canShare();
	if (!canShare.value) {
		throw new MobilePluginUnavailableError("Native sharing is not available on this device.");
	}

	await Share.share(options);
}

export async function shareCurrentMobilePage(): Promise<void> {
	await shareMobileBetaContent({
		title: document.title || "LibertAI Chat",
		text: "Open this LibertAI Chat view",
		url: window.location.href,
	});
}

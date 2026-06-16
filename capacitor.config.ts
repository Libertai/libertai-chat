import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
	appId: "io.libertai.chat",
	appName: "LibertAI",
	webDir: "dist",
	plugins: {
		PushNotifications: {
			presentationOptions: ["badge", "sound", "alert"],
		},
	},
};

export default config;

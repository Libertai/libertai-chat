import { Capacitor } from "@capacitor/core";
import { isMobileBetaApp } from "@/lib/mobile-runtime";

export type MobileImageSource = "camera" | "photos";

export type MobilePickedImage = {
	data: string;
	mimeType: string;
	filename: string;
};

export class MobilePluginUnavailableError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "MobilePluginUnavailableError";
	}
}

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png"];

function ensureNativeBeta(pluginLabel: string) {
	if (!isMobileBetaApp()) {
		throw new MobilePluginUnavailableError(`${pluginLabel} is only available in the mobile beta app.`);
	}
}

function asDataUrl(data: string, mimeType: string): string {
	if (data.startsWith("data:")) return data;
	return `data:${mimeType};base64,${data}`;
}

function formatMimeType(format: string): string {
	const normalized = format.toLowerCase();
	if (normalized === "jpg") return "image/jpeg";
	return `image/${normalized}`;
}

export function isUserCancelledNativePicker(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	return /cancel|dismiss|abort/i.test(error.message);
}

export function getNativeErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof MobilePluginUnavailableError) return error.message;
	if (error instanceof Error && error.message.trim() !== "") return error.message;
	return fallback;
}

export async function pickMobileCameraImage(source: MobileImageSource): Promise<MobilePickedImage> {
	ensureNativeBeta("Camera");

	const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
	const photo = await Camera.getPhoto({
		quality: 85,
		resultType: CameraResultType.DataUrl,
		source: source === "camera" ? CameraSource.Camera : CameraSource.Photos,
		correctOrientation: true,
	});

	if (!photo.dataUrl) {
		throw new Error("No image data was returned.");
	}

	const extension = photo.format || "jpeg";
	const mimeType = formatMimeType(extension);

	return {
		data: photo.dataUrl,
		mimeType,
		filename: `${source === "camera" ? "camera-photo" : "photo"}-${Date.now()}.${extension}`,
	};
}

export async function pickMobileImageFile(): Promise<MobilePickedImage> {
	ensureNativeBeta("File picker");

	if (!Capacitor.isPluginAvailable("FilePicker")) {
		throw new MobilePluginUnavailableError("The native file picker is not available on this device.");
	}

	const { FilePicker } = await import("@capawesome/capacitor-file-picker");
	const result = await FilePicker.pickFiles({
		types: ACCEPTED_IMAGE_TYPES,
		limit: 1,
		readData: true,
	});
	const file = result.files[0];

	if (!file) {
		throw new Error("No file was selected.");
	}
	if (!ACCEPTED_IMAGE_TYPES.includes(file.mimeType)) {
		throw new Error("Please select a JPEG or PNG image.");
	}
	if (!file.data) {
		throw new Error("The selected file could not be read.");
	}

	return {
		data: asDataUrl(file.data, file.mimeType),
		mimeType: file.mimeType,
		filename: file.name,
	};
}

export async function startMobileSpeechRecognition(): Promise<string | null> {
	ensureNativeBeta("Voice input");

	if (!Capacitor.isPluginAvailable("SpeechRecognition")) {
		throw new MobilePluginUnavailableError("Speech recognition is not available on this device.");
	}

	const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
	const availability = await SpeechRecognition.available();
	if (!availability.available) {
		throw new MobilePluginUnavailableError("Speech recognition is not supported on this device.");
	}

	const currentPermission = await SpeechRecognition.checkPermissions();
	const permission =
		currentPermission.speechRecognition === "granted"
			? currentPermission
			: await SpeechRecognition.requestPermissions();

	if (permission.speechRecognition !== "granted") {
		throw new Error("Microphone permission is required for voice input.");
	}

	const result = await SpeechRecognition.start({
		language: navigator.language || "en-US",
		maxResults: 1,
		partialResults: false,
		popup: true,
		prompt: "Speak your message",
	});

	return result.matches?.[0]?.trim() || null;
}

export async function stopMobileSpeechRecognition(): Promise<void> {
	if (!isMobileBetaApp() || !Capacitor.isPluginAvailable("SpeechRecognition")) return;

	const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
	await SpeechRecognition.stop();
}

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAccountStore } from "@libertai/auth";
import { useChatApiKey } from "@/hooks/data/use-chat-api-key";
import { resolveChatEndpoint } from "@/utils/chat-endpoint";
import env from "@/config/env";

/** TTS model + voice deployed on the connected gateway (see libertai-models kokoro-82m). */
const TTS_MODEL = "kokoro-82m";
const TTS_VOICE = "af_heart";
/** Matches the gateway's max input length for /v1/audio/speech. */
const MAX_TTS_CHARS = 8192;

/**
 * Strip common Markdown syntax so the spoken text isn't littered with `*`, `#`, backticks, etc.
 * Intentionally lightweight — good enough for natural speech, not a full Markdown parser.
 */
function toSpeakableText(markdown: string): string {
	return markdown
		.replace(/```[\s\S]*?```/g, " ") // fenced code blocks
		.replace(/`([^`]+)`/g, "$1") // inline code
		.replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links -> link text
		.replace(/^\s{0,3}#{1,6}\s+/gm, "") // headings
		.replace(/^\s{0,3}>\s?/gm, "") // blockquotes
		.replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
		.replace(/(\*|_)(.*?)\1/g, "$2") // italic
		.replace(/~~(.*?)~~/g, "$1") // strikethrough
		.replace(/^\s*[-*+]\s+/gm, "") // unordered list markers
		.replace(/\n{2,}/g, ". ") // paragraph breaks -> pause
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, MAX_TTS_CHARS);
}

export type ReadAloudState = {
	/** Audio is currently playing. */
	isPlaying: boolean;
	/** Request is in flight (synthesizing), before playback starts. */
	isPreparing: boolean;
	/** Start playback if idle, stop it if playing/preparing. */
	toggle: (text: string) => void;
};

/**
 * Per-message "read aloud" controller. Calls the OpenAI-compatible `/v1/audio/speech`
 * endpoint on the connected gateway, plays the returned WAV, and exposes a play/stop toggle.
 */
export function useReadAloud(): ReadAloudState {
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);
	const { chatApiKey } = useChatApiKey();

	const [isPlaying, setIsPlaying] = useState(false);
	const [isPreparing, setIsPreparing] = useState(false);

	const audioRef = useRef<HTMLAudioElement | null>(null);
	const objectUrlRef = useRef<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	const cleanup = useCallback(() => {
		abortRef.current?.abort();
		abortRef.current = null;
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current.src = "";
			audioRef.current = null;
		}
		if (objectUrlRef.current) {
			URL.revokeObjectURL(objectUrlRef.current);
			objectUrlRef.current = null;
		}
		setIsPlaying(false);
		setIsPreparing(false);
	}, []);

	// Stop and release resources if the message unmounts mid-playback.
	useEffect(() => cleanup, [cleanup]);

	const toggle = useCallback(
		(text: string) => {
			// Already busy → treat the click as "stop".
			if (isPlaying || isPreparing) {
				cleanup();
				return;
			}

			const { baseURL, apiKey, useConnected } = resolveChatEndpoint({
				isAuthenticated,
				chatApiKey,
				connectedApiUrl: env.LTAI_CONNECTED_API_URL,
				freeApiUrl: env.LTAI_INFERENCE_API_URL,
			});

			if (!useConnected) {
				toast.error("Sign in to read messages aloud");
				return;
			}

			const speakable = toSpeakableText(text);
			if (!speakable) return;

			const controller = new AbortController();
			abortRef.current = controller;
			setIsPreparing(true);

			void (async () => {
				try {
					const res = await fetch(`${baseURL}/audio/speech`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${apiKey}`,
						},
						body: JSON.stringify({
							model: TTS_MODEL,
							input: speakable,
							voice: TTS_VOICE,
							response_format: "wav",
						}),
						signal: controller.signal,
					});

					if (!res.ok) throw new Error(`TTS request failed (${res.status})`);

					const blob = await res.blob();
					if (controller.signal.aborted) return;

					const url = URL.createObjectURL(blob);
					objectUrlRef.current = url;

					const audio = new Audio(url);
					audioRef.current = audio;
					audio.onended = cleanup;
					audio.onerror = () => {
						toast.error("Failed to play audio");
						cleanup();
					};

					await audio.play();
					if (controller.signal.aborted) return;
					setIsPreparing(false);
					setIsPlaying(true);
				} catch (err) {
					if (controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
					console.error("Read aloud failed:", err);
					toast.error("Failed to read message aloud");
					cleanup();
				}
			})();
		},
		[isPlaying, isPreparing, isAuthenticated, chatApiKey, cleanup],
	);

	return { isPlaying, isPreparing, toggle };
}

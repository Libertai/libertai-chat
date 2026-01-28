import { useMutation } from "@tanstack/react-query";
import { useAccountStore } from "@/stores/account";
import { toast } from "sonner";
import env from "@/config/env";

export interface ImageGenerationParams {
	model: string;
	prompt: string;
	width: number;
	height: number;
	steps?: number;
	seed?: number;
	remove_background?: boolean;
}

export interface ImageGenerationResult {
	images: string[];
	parameters: {
		seed: number;
	};
}

const IMAGE_API_URL = `${env.LTAI_CONNECTED_API_URL}/sdapi/v1/txt2img`;

export function useImageGeneration() {
	const chatApiKey = useAccountStore((state) => state.chatApiKey);

	const mutation = useMutation({
		mutationFn: async (params: ImageGenerationParams): Promise<ImageGenerationResult> => {
			if (!chatApiKey) {
				throw new Error("Not authenticated");
			}

			const response = await fetch(IMAGE_API_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${chatApiKey}`,
				},
				body: JSON.stringify({
					model: params.model,
					prompt: params.prompt,
					width: params.width,
					height: params.height,
					steps: params.steps ?? 4,
					seed: params.seed ?? -1,
					remove_background: params.remove_background ?? false,
				}),
			});

			if (!response.ok) {
				const error = await response.text();
				throw new Error(error || `HTTP error ${response.status}`);
			}

			return response.json();
		},
		onError: (error) => {
			toast.error("Image generation failed", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		},
	});

	return {
		generate: mutation.mutateAsync,
		isGenerating: mutation.isPending,
		error: mutation.error,
	};
}

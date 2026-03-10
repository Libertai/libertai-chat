/**
 * Model capabilities configuration
 * Defines which features each model supports
 */

export interface ModelCapabilities {
	supportsImages: boolean;
	// Add more capabilities here as needed
	// supportsAudio?: boolean;
	// supportsVideo?: boolean;
}

/**
 * Models that support image inputs
 */
export const IMAGE_CAPABLE_MODELS = [
	"gemma-3-27b",
	"qwen3.5-35b-a3b",
	"qwen3.5-35b-a3b-thinking",
	"qwen3.5-27b",
	"qwen3.5-27b-thinking",
];

/**
 * Check if a model supports images
 */
export function supportsImages(model: string): boolean {
	return IMAGE_CAPABLE_MODELS.includes(model);
}

/**
 * Get all capabilities for a model
 */
export function getModelCapabilities(model: string): ModelCapabilities {
	return {
		supportsImages: supportsImages(model),
	};
}

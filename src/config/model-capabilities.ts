import type { Model } from "@/hooks/data/use-models";

const THINKING_SUFFIX = "-thinking";

// `-thinking` is just a flag to enable thinking mode on the base model — strip it for capability lookup
function getBaseModelId(model: string): string {
	return model.endsWith(THINKING_SUFFIX) ? model.slice(0, -THINKING_SUFFIX.length) : model;
}

function findModel(model: string, models: Model[]): Model | undefined {
	return models.find((m) => m.id === getBaseModelId(model));
}

export function supportsImages(model: string, models: Model[]): boolean {
	return findModel(model, models)?.capabilities.text?.vision ?? false;
}

export function supportsTools(model: string, models: Model[]): boolean {
	return findModel(model, models)?.capabilities.text?.function_calling ?? false;
}

// True when the model runs inside a Trusted Execution Environment (confidential compute).
export function isTeeAttested(model: string, models: Model[]): boolean {
	return findModel(model, models)?.capabilities.text?.tee ?? false;
}

// The registry mixes chat (text) models with image / search / embedding / TTS entries.
// Only text models are selectable in the chat model picker.
export function chatModels(models: Model[]): Model[] {
	return models.filter((m) => m.capabilities.text !== undefined);
}

/**
 * Resolve the effective model for a chat. An explicit per-chat model choice (set via the
 * ModelPicker) overrides the persona's pinned model; otherwise we fall back to the persona model.
 * Personas still work untouched when no explicit choice has been made.
 */
export function resolveChatModel(chatModel: string | undefined, assistantModel: string): string {
	return chatModel && chatModel.trim().length > 0 ? chatModel : assistantModel;
}

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

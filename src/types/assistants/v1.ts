import { z } from "zod";

/**
 * V1 Assistant Schema
 * Initial version of the assistant data structure
 */
export const AssistantV1Schema = z.object({
	id: z.string(),
	title: z.string(),
	subtitle: z.string(),
	model: z.string(),
	systemPrompt: z.string(),
	badge: z.string().optional(),
	pro: z.boolean().optional(),
	disabled: z.boolean().optional(),
	hidden: z.boolean().optional(),
	isCustom: z.boolean().optional(),
	imageUrl: z.string().optional(),
});

export type AssistantV1 = z.infer<typeof AssistantV1Schema>;

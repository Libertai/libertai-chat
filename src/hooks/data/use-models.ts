import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

const TextCapabilitiesSchema = z.object({
	context_window: z.number(),
	function_calling: z.boolean(),
	reasoning: z.boolean(),
	tee: z.boolean().optional(),
	vision: z.boolean(),
});

const ModelSchema = z.object({
	id: z.string(),
	name: z.string(),
	hf_id: z.string().optional(),
	capabilities: z.object({
		text: TextCapabilitiesSchema.optional(),
		image: z.boolean().optional(),
		search: z.boolean().optional(),
	}),
	pricing: z.object({
		text: z
			.object({
				price_per_million_input_tokens: z.number(),
				price_per_million_output_tokens: z.number(),
			})
			.optional(),
		image: z.number().optional(),
		search: z.number().optional(),
	}),
});

const AlephResponseSchema = z.object({
	data: z.object({
		LTAI_PRICING: z.object({
			models: z.array(ModelSchema),
		}),
	}),
});

export type Model = z.infer<typeof ModelSchema>;

const ALEPH_PRICING_URL =
	"https://api2.aleph.im/api/v0/aggregates/0xe1F7220D201C64871Cefb25320a8a588393eE508.json?keys=LTAI_PRICING";

export function useModels() {
	return useQuery({
		queryKey: ["ltai-models"],
		queryFn: async (): Promise<Model[]> => {
			const response = await fetch(ALEPH_PRICING_URL);
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			const data = await response.json();
			return AlephResponseSchema.parse(data).data.LTAI_PRICING.models;
		},
		staleTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false,
	});
}

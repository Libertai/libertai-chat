import { z } from "zod";

const envSchema = z.object({
	ALEPH_API_URL: z.string().url().optional(),
	LTAI_INFERENCE_API_URL: z.string().url(),
	LTAI_AGENTS_API_URL: z.string().url(),
	LTAI_AUTH_API_URL: z.string().url(),
	SOLANA_RPC: z.string().url(),
	LTAI_BASE_ADDRESS: z.string().startsWith("0x").optional().default("0xF8B1b47AA748F5C7b5D0e80C726a843913EB573a"),
	LTAI_SOLANA_ADDRESS: z.string().optional().default("mntpN8z1d29f3MWhMD7VqZFpeYmbD88MgwS3Bkz8y7u"),
	LTAI_PUBLISHER_ADDRESS: z.string().startsWith("0x").optional().default("0xCBFc3EeC41CBBfCAcc50337d712890C47a14ba99"),
	THIRDWEB_CLIENT_ID: z.string(),
	USDC_BASE_ADDRESS: z.string().startsWith("0x").optional().default("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
	PAYMENT_PROCESSOR_CONTRACT_BASE_ADDRESS: z.string().startsWith("0x"),
});

const env = envSchema.parse({
	ALEPH_API_URL: import.meta.env.VITE_ALEPH_API_URL,
	LTAI_INFERENCE_API_URL: import.meta.env.VITE_LTAI_INFERENCE_API_URL,
	LTAI_AGENTS_API_URL: import.meta.env.VITE_LTAI_AGENTS_API_URL,
	LTAI_AUTH_API_URL: import.meta.env.VITE_LTAI_AUTH_API_URL,
	SOLANA_RPC: import.meta.env.VITE_SOLANA_RPC,
	LTAI_BASE_ADDRESS: import.meta.env.VITE_LTAI_BASE_ADDRESS,
	LTAI_SOLANA_ADDRESS: import.meta.env.VITE_LTAI_SOLANA_ADDRESS,
	LTAI_PUBLISHER_ADDRESS: import.meta.env.VITE_LTAI_PUBLISHER_ADDRESS,
	THIRDWEB_CLIENT_ID: import.meta.env.VITE_THIRDWEB_CLIENT_ID,
	USDC_BASE_ADDRESS: import.meta.env.VITE_USDC_BASE_ADDRESS,
	PAYMENT_PROCESSOR_CONTRACT_BASE_ADDRESS: import.meta.env.VITE_PAYMENT_PROCESSOR_CONTRACT_BASE_ADDRESS,
});
export default env;

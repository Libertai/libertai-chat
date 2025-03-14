import { z } from "zod";

const envSchema = z.object({
	ALEPH_API_URL: z.string().url().optional(),
	LTAI_SUBSCRIPTIONS_API_URL: z.string().url(),
	LTAI_AGENTS_API_URL: z.string().url(),
	LTAI_AUTH_API_URL: z.string().url(),
	SOLANA_RPC: z.string().url(),
	LTAI_BASE_ADDRESS: z.string().startsWith("0x").optional().default("0xF8B1b47AA748F5C7b5D0e80C726a843913EB573a"),
	LTAI_SOLANA_ADDRESS: z.string().optional().default("mntpN8z1d29f3MWhMD7VqZFpeYmbD88MgwS3Bkz8y7u"),
	LTAI_PUBLISHER_ADDRESS: z.string().startsWith("0x").optional().default("0xCBFc3EeC41CBBfCAcc50337d712890C47a14ba99"),
	THIRDWEB_CLIENT_ID: z.string(),
});

const env = envSchema.parse({
	ALEPH_API_URL: process.env.NEXT_PUBLIC_ALEPH_API_URL,
	LTAI_SUBSCRIPTIONS_API_URL: process.env.NEXT_PUBLIC_LTAI_SUBSCRIPTIONS_API_URL,
	LTAI_AGENTS_API_URL: process.env.NEXT_PUBLIC_LTAI_AGENTS_API_URL,
	LTAI_AUTH_API_URL: process.env.NEXT_PUBLIC_LTAI_AUTH_API_URL,
	SOLANA_RPC: process.env.NEXT_PUBLIC_SOLANA_RPC,
	LTAI_BASE_ADDRESS: process.env.NEXT_PUBLIC_LTAI_BASE_ADDRESS,
	LTAI_SOLANA_ADDRESS: process.env.NEXT_PUBLIC_LTAI_SOLANA_ADDRESS,
	LTAI_PUBLISHER_ADDRESS: process.env.NEXT_PUBLIC_LTAI_PUBLISHER_ADDRESS,
	THIRDWEB_CLIENT_ID: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
});

export default env;

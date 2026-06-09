import { thirdwebClient } from "@/config/thirdweb";
import env from "@/config/env";
import type { PaymentConfig } from "@libertai/auth";

export const paymentConfig: PaymentConfig = {
	thirdwebClient,
	solanaRpc: env.SOLANA_RPC,
	paymentProcessorBaseAddress: env.PAYMENT_PROCESSOR_CONTRACT_BASE_ADDRESS,
	usdcBaseAddress: env.USDC_BASE_ADDRESS,
	ltaiBaseAddress: env.LTAI_BASE_ADDRESS,
	ltaiSolanaAddress: env.LTAI_SOLANA_ADDRESS,
};

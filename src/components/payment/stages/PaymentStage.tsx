import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { PaymentMethod, PaymentMethodSelector } from "@/components/payment/PaymentMethodSelector.tsx";
import { CheckoutWidget } from "thirdweb/react";
import { thirdwebClient } from "@/config/thirdweb.ts";
import { base } from "thirdweb/chains";
import env from "@/config/env.ts";
import { PaymentForm } from "@/components/payment/PaymentForm.tsx";
import { useLTAIPrice } from "@/hooks/use-ltai-price.ts";
import { useSOLPrice } from "@/hooks/use-sol-price.ts";
import { useAccountStore } from "@libertai/auth";
import { useQueryState } from "nuqs";
import { prepareContractCall, sendTransaction } from "thirdweb";
import { parseUnits } from "viem";
import { toast } from "sonner";
import {
	createAssociatedTokenAccountInstruction,
	getAssociatedTokenAddress,
	TOKEN_2022_PROGRAM_ID,
	TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
	Connection,
	PublicKey,
	SimulateTransactionConfig,
	SystemProgram,
	Transaction,
	TransactionMessage,
	VersionedTransaction,
} from "@solana/web3.js";
import { BN, Program } from "@coral-xyz/anchor";
import { waitForBaseTransaction } from "@/utils/transactions.ts";
import idl from "@/lib/solana/libertai_payment_processor.json";
import { LibertaiPaymentProcessor } from "@/lib/solana/libertai_payment_processor.ts";

type PaymentStageProps = {
	usdAmount: number;
	handleGoBackToSelection: () => void;
	handlePaymentSuccess: () => void;
};

const PAYMENT_PROCESSOR_ADDRESS = env.PAYMENT_PROCESSOR_CONTRACT_BASE_ADDRESS as `0x${string}`;

const solanaConnection = new Connection(env.SOLANA_RPC, "confirmed");
const solanaProgram = new Program(idl as LibertaiPaymentProcessor, {
	connection: solanaConnection,
});
const solanaTokenMint = new PublicKey(env.LTAI_SOLANA_ADDRESS);

export const PaymentStage = ({ usdAmount, handleGoBackToSelection, handlePaymentSuccess }: PaymentStageProps) => {
	const solBalance = useAccountStore((state) => state.solBalance);
	const ltaiBalance = useAccountStore((state) => state.ltaiBalance);
	const account = useAccountStore((state) => state.account);
	const setLastTransactionHash = useAccountStore((state) => state.setLastTransactionHash);
	const getLTAIBalance = useAccountStore((state) => state.getLTAIBalance);
	const getSOLBalance = useAccountStore((state) => state.getSOLBalance);

	const { price: ltaiPrice, isLoading: isLtaiPriceLoading, getRequiredLTAI } = useLTAIPrice();
	const { price: solPrice, isLoading: isSolPriceLoading, getRequiredSOL } = useSOLPrice();

	const originalLtaiAmount = getRequiredLTAI(usdAmount, false);
	const originalSolAmount = getRequiredSOL(usdAmount);
	const discountedLtaiAmount = getRequiredLTAI(usdAmount, true);

	const [method, setMethod] = useQueryState<PaymentMethod>("method", {
		defaultValue: "ltai",
		parse: (value): PaymentMethod => {
			switch (value) {
				case "ltai":
				case "solana":
				case "crypto":
				case "card":
					return value;
				default:
					return "ltai"; // Default to LTAI if invalid
			}
		},
	});

	const hasLTAI = ltaiBalance > 0;

	const handleLtaiPayment = async () => {
		if (!ltaiPrice || !discountedLtaiAmount) return;

		if (account?.chain === "base") {
			try {
				// Call the processPayment function using method directly
				const transaction = prepareContractCall({
					contract: {
						address: PAYMENT_PROCESSOR_ADDRESS,
						abi: [
							{
								inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
								name: "processPayment",
								outputs: [],
								stateMutability: "nonpayable",
								type: "function",
							},
						],
						chain: base,
						client: thirdwebClient,
					},
					method: "processPayment",
					params: [parseUnits(discountedLtaiAmount.toString(), 18)],
				});

				// Send the transaction
				const { transactionHash } = await sendTransaction({
					transaction,
					account: account.provider,
				});

				// Store the transaction hash for display
				setLastTransactionHash(transactionHash);

				// Create a pending toast
				const toastId = toast.loading("Waiting for payment confirmation...");

				try {
					// Wait for the transaction to be confirmed
					await waitForBaseTransaction(transactionHash);

					// Update the toast
					toast.success("Payment successful", {
						id: toastId,
					});

					// After successful payment, update the LTAI balance and call the success handler
					await getLTAIBalance();
				} catch (confirmError) {
					console.error("Payment confirmation error:", confirmError);
					toast.error("Payment confirmation failed", {
						id: toastId,
						description:
							confirmError instanceof Error ? confirmError.message : "Transaction may not have been confirmed",
					});
				}
			} catch (error) {
				console.error("Payment error:", error);
				toast.error("Payment failed", {
					description: error instanceof Error ? error.message : "Unknown error",
				});
			}
		} else if (account?.chain === "solana" && account.provider.publicKey !== null) {
			try {
				const amount = parseUnits(discountedLtaiAmount.toString(), 9);

				const mintAccountInfo = await solanaConnection.getAccountInfo(solanaTokenMint);
				if (!mintAccountInfo) {
					throw new Error("Token mint account not found");
				}

				const tokenProgramId = mintAccountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)
					? TOKEN_2022_PROGRAM_ID
					: TOKEN_PROGRAM_ID;

				const userTokenAccount = await getAssociatedTokenAddress(
					solanaTokenMint,
					account.provider.publicKey,
					false,
					tokenProgramId,
				);

				const accountInfo = await solanaConnection.getAccountInfo(userTokenAccount);

				const instructions = [];
				if (!accountInfo) {
					const createTokenAccountIx = createAssociatedTokenAccountInstruction(
						account.provider.publicKey,
						userTokenAccount,
						account.provider.publicKey,
						solanaTokenMint,
						tokenProgramId,
					);
					instructions.push(createTokenAccountIx);
				}

				const [programTokenAccountPDA] = PublicKey.findProgramAddressSync(
					[Buffer.from("program_token_account"), solanaTokenMint.toBuffer()],
					solanaProgram.programId,
				);

				const paymentIx = await solanaProgram.methods
					.processPayment(new BN(amount))
					.accounts({
						user: account.provider.publicKey,
						userTokenAccount: userTokenAccount,
						programTokenAccount: programTokenAccountPDA,
						tokenMint: solanaTokenMint,
						tokenProgram: tokenProgramId,
					})
					.instruction();

				instructions.push(paymentIx);

				const { blockhash } = await solanaConnection.getLatestBlockhash();

				const messageV0 = new TransactionMessage({
					payerKey: account.provider.publicKey,
					recentBlockhash: blockhash,
					instructions: instructions,
				}).compileToV0Message();

				const versionedTx = new VersionedTransaction(messageV0);

				try {
					const config: SimulateTransactionConfig = {
						sigVerify: false,
						commitment: "confirmed",
					};
					const simulation = await solanaConnection.simulateTransaction(versionedTx, config);
					if (simulation.value.err) {
						throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
					}
				} catch (simError) {
					console.error("Simulation error:", simError);
					throw new Error(
						`Transaction simulation failed: ${simError instanceof Error ? simError.message : String(simError)}`,
					);
				}
				const tx = new Transaction().add(...instructions);
				tx.recentBlockhash = blockhash;
				tx.feePayer = account.provider.publicKey;
				const sig = await account.provider.sendTransaction(tx, solanaConnection, {
					skipPreflight: true, // Skip preflight since we already simulated
					preflightCommitment: "confirmed",
					maxRetries: 3,
				});

				setLastTransactionHash(sig);

				const toastId = toast.loading("Waiting for payment confirmation...");
				const latestBlockHash = await solanaConnection.getLatestBlockhash();
				try {
					await solanaConnection.confirmTransaction(
						{
							blockhash: blockhash,
							lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
							signature: sig,
						},
						"confirmed",
					);

					toast.success("Payment successful", {
						id: toastId,
					});

					await getLTAIBalance();
				} catch (confirmError) {
					console.error("Payment confirmation error:", confirmError);
					toast.error("Payment confirmation failed", {
						id: toastId,
						description:
							confirmError instanceof Error ? confirmError.message : "Transaction may not have been confirmed",
					});
				}
			} catch (error) {
				console.error("Payment error:", error);
				toast.error("Payment failed", {
					description: error instanceof Error ? error.message : "Unknown error",
				});
			}
		} else {
			toast.error("Unsupported chain for LTAI payments. Please switch to Solana or Base.");
			return;
		}

		handlePaymentSuccess();
	};

	const handleSolPayment = async () => {
		if (account?.chain !== "solana" || !account.provider?.publicKey || !solPrice) {
			return;
		}

		const instructions = [];
		const { blockhash } = await solanaConnection.getLatestBlockhash();
		const [programState] = PublicKey.findProgramAddressSync([Buffer.from("program_state")], solanaProgram.programId);
		const amount = parseUnits(originalSolAmount.toString(), 9);
		const ix = await solanaProgram.methods
			.processPaymentSol(new BN(amount))
			.accounts({
				user: account.provider.publicKey,
				programState: programState,
				systemProgram: SystemProgram.programId,
			})
			.instruction();
		instructions.push(ix);

		const messageV0 = new TransactionMessage({
			payerKey: account.provider.publicKey,
			recentBlockhash: blockhash,
			instructions: instructions,
		}).compileToV0Message();
		const versionedTx = new VersionedTransaction(messageV0);

		try {
			const config: SimulateTransactionConfig = {
				sigVerify: false,
				commitment: "confirmed",
			};
			const simulation = await solanaConnection.simulateTransaction(versionedTx, config);
			if (simulation.value.err) {
				throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
			}
		} catch (simError) {
			console.error("Simulation error:", simError);
			throw new Error(
				`Transaction simulation failed: ${simError instanceof Error ? simError.message : String(simError)}`,
			);
		}

		const tx = new Transaction().add(...instructions);
		tx.recentBlockhash = blockhash;
		tx.feePayer = account.provider.publicKey;

		const sig = await account.provider.sendTransaction(tx, solanaProgram.provider.connection, {
			skipPreflight: true, // Skip preflight since we already simulated
			preflightCommitment: "confirmed",
			maxRetries: 3,
		});

		setLastTransactionHash(sig);

		const toastId = toast.loading("Waiting for payment confirmation...");
		const latestBlockHash = await solanaConnection.getLatestBlockhash();

		try {
			await solanaConnection.confirmTransaction(
				{
					blockhash: blockhash,
					lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
					signature: sig,
				},
				"confirmed",
			);

			toast.success("Payment successful", {
				id: toastId,
			});

			await getSOLBalance();
		} catch (confirmError) {
			console.error("Payment confirmation error:", confirmError);
			toast.error("Payment confirmation failed", {
				id: toastId,
				description: confirmError instanceof Error ? confirmError.message : "Transaction may not have been confirmed",
			});
		} finally {
			handlePaymentSuccess();
		}
	};

	return (
		<div className="max-w-2xl mx-auto space-y-6">
			{/* Header row: back button + total */}
			<div className="flex items-center gap-4">
				<Button variant="ghost" size="sm" onClick={handleGoBackToSelection}>
					<ChevronLeft className="h-4 w-4 mr-1" />
					Back
				</Button>
				<span className="text-sm text-muted-foreground">
					Total: <span className="font-semibold text-foreground">${usdAmount.toFixed(2)}</span>
				</span>
			</div>

			{/* Payment method selector */}
			<PaymentMethodSelector
				onSelectMethod={setMethod}
				selectedMethod={method as PaymentMethod}
				hasLTAI={hasLTAI}
				chain={account?.chain}
			/>

			{/* Selected method widget */}
			<div>
				{method === "crypto" && (
					<CheckoutWidget
						client={thirdwebClient}
						chain={base}
						amount={usdAmount.toString()}
						seller={env.PAYMENT_PROCESSOR_CONTRACT_BASE_ADDRESS as `0x${string}`}
						tokenAddress={env.USDC_BASE_ADDRESS as `0x${string}`}
						name="Checkout"
						description={`${usdAmount.toFixed(2)}$ of LibertAI credits`}
						paymentMethods={["crypto"]}
						purchaseData={{
							userAddress: account?.address,
						}}
						onSuccess={() => {
							setLastTransactionHash(null);
							handlePaymentSuccess();
						}}
						className="!w-full"
					/>
				)}
				{method === "card" && (
					<CheckoutWidget
						client={thirdwebClient}
						chain={base}
						amount={usdAmount.toString()}
						seller={env.PAYMENT_PROCESSOR_CONTRACT_BASE_ADDRESS as `0x${string}`}
						tokenAddress={env.USDC_BASE_ADDRESS as `0x${string}`}
						name="Checkout"
						description={`${usdAmount.toFixed(2)}$ of LibertAI credits`}
						paymentMethods={["card"]}
						purchaseData={{
							userAddress: account?.address,
						}}
						onSuccess={() => {
							setLastTransactionHash(null);
							handlePaymentSuccess();
						}}
						className="!w-full"
					/>
				)}
				{method === "ltai" && (
					<PaymentForm
						usdAmount={usdAmount}
						handlePayment={handleLtaiPayment}
						ticker="LTAI"
						tokenPrice={ltaiPrice}
						tokenAmount={originalLtaiAmount}
						discountedAmount={discountedLtaiAmount}
						balance={ltaiBalance}
						displayedDecimals={2}
						isLoading={isLtaiPriceLoading}
					/>
				)}
				{method === "solana" && (
					<PaymentForm
						usdAmount={usdAmount}
						handlePayment={handleSolPayment}
						ticker="SOL"
						tokenPrice={solPrice}
						tokenAmount={originalSolAmount}
						balance={solBalance}
						displayedDecimals={4}
						isLoading={isSolPriceLoading}
					/>
				)}
			</div>
		</div>
	);
};

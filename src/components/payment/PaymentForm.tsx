import env from "@/config/env.ts";
import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useAccountStore } from "@/stores/account.ts";
import { toast } from "sonner";
import { approve } from "thirdweb/extensions/erc20";
import { base } from "thirdweb/chains";
import { thirdwebClient } from "@/config/thirdweb.ts";
import { sendTransaction } from "thirdweb";
import { waitForBaseTransaction } from "@/utils/transactions.ts";

interface LTAIPaymentFormProps {
	usdAmount: number;
	tokenAmount: number;
	handlePayment: () => void;
	ticker: string;
	balance: number;
	displayedDecimals: number;
	tokenPrice: number;
	discountedAmount?: number;
	isLoading?: boolean;
}

export function PaymentForm({
	usdAmount,
	tokenAmount,
	handlePayment,
	ticker,
	balance,
	displayedDecimals,
	tokenPrice,
	discountedAmount,
	isLoading = false,
}: Readonly<LTAIPaymentFormProps>) {
	const account = useAccountStore((state) => state.account);

	const getLTAIBalance = useAccountStore((state) => state.getLTAIBalance);

	const [isApproving, setIsApproving] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);
	const [isApproved, setIsApproved] = useState(false);

	const LTAI_BASE_CONTRACT_ADDRESS = env.LTAI_BASE_ADDRESS as `0x${string}`;
	const PAYMENT_PROCESSOR_ADDRESS = env.PAYMENT_PROCESSOR_CONTRACT_BASE_ADDRESS as `0x${string}`;

	const handleApprovePayment = async () => {
		if (account?.chain !== "base" || !tokenAmount || !discountedAmount) return;

		setIsApproving(true);
		try {
			try {
				// Approve the payment processor to spend LTAI tokens
				const tx = approve({
					contract: {
						address: LTAI_BASE_CONTRACT_ADDRESS,
						chain: base,
						client: thirdwebClient,
					},
					spender: PAYMENT_PROCESSOR_ADDRESS,
					amount: discountedAmount.toString(),
				});

				// Send the transaction and get the hash
				const { transactionHash } = await sendTransaction({ transaction: tx, account: account.provider });

				// Create a pending toast
				const toastId = toast.loading("Waiting for approval confirmation...");

				try {
					// Wait for the transaction to be confirmed
					await waitForBaseTransaction(transactionHash);

					// Update the toast
					toast.success("Approval successful", {
						id: toastId,
						description: "Now you can proceed with the payment",
					});

					// Set approval state to true
					setIsApproved(true);

					// After approval, update the LTAI balance
					await getLTAIBalance();
				} catch (confirmError) {
					console.error("Approval confirmation error:", confirmError);
					toast.error("Approval confirmation failed", {
						id: toastId,
						description:
							confirmError instanceof Error ? confirmError.message : "Transaction may not have been confirmed",
					});
				}
			} catch (error) {
				console.error("Approval error:", error);
				toast.error("Approval failed", {
					description: error instanceof Error ? error.message : "Unknown error",
				});
			} finally {
				setIsApproving(false);
			}
		} catch (outerError) {
			console.error("Outer error:", outerError);
			setIsApproving(false);
		}
	};

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="bg-card p-4 rounded-lg border border-border">
					<div className="flex justify-between mb-2">
						<Skeleton className="h-5 w-24" />
						<Skeleton className="h-5 w-16" />
					</div>
					<div className="flex justify-between mb-2">
						<Skeleton className="h-5 w-24" />
						<Skeleton className="h-5 w-32" />
					</div>
					<div className="border-t border-border my-2"></div>
					<div className="flex justify-between font-medium">
						<Skeleton className="h-5 w-28" />
						<Skeleton className="h-5 w-20" />
					</div>
					<div className="flex justify-between mt-2 text-xs">
						<Skeleton className="h-4 w-28" />
						<Skeleton className="h-4 w-20" />
					</div>
				</div>

				<div className="space-y-4">
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-10 w-full" />
				</div>
			</div>
		);
	}

	const hasEnoughBalance = discountedAmount ? balance >= discountedAmount : balance >= tokenAmount;

	return (
		<div className="space-y-6">
			<div className="bg-card p-4 rounded-lg border border-border">
				<div className="flex justify-between mb-2">
					<span className="text-muted-foreground">USD Amount</span>
					<span>${usdAmount.toFixed(2)}</span>
				</div>
				<div className="flex justify-between mb-2">
					<span className="text-muted-foreground">${ticker} Price</span>
					<span>
						${tokenPrice.toFixed(displayedDecimals)} per ${ticker}
					</span>
				</div>
				<div className="border-t border-border my-2"></div>
				<div className="flex justify-between font-medium">
					<span>${ticker} Required</span>
					<div className="flex flex-col items-end">
						{discountedAmount && (
							<span className="line-through text-muted-foreground text-sm">
								{tokenAmount.toFixed(2)} ${ticker}
							</span>
						)}
						<div className="flex items-center">
							{/*TODO: pass percentage in param */}
							{discountedAmount && <span className="text-green-600 mr-1 text-sm">20% OFF</span>}
							<span className="font-bold">
								{discountedAmount
									? discountedAmount.toFixed(displayedDecimals)
									: tokenAmount.toFixed(displayedDecimals)}{" "}
								${ticker}
							</span>
						</div>
					</div>
				</div>
				<div className="flex justify-between mt-2 text-xs">
					<span>Your ${ticker} Balance</span>
					<span className={!tokenAmount ? "text-destructive" : ""}>
						{balance.toFixed(displayedDecimals)} ${ticker}
					</span>
				</div>
			</div>

			{!hasEnoughBalance && (
				<div className="bg-destructive/10 p-4 rounded-lg border border-destructive/30 text-sm">
					You don't have enough ${ticker} tokens for this payment. Please select another payment method.
				</div>
			)}

			<div className="space-y-4">
				{account?.chain === "base" && (
					<Button
						onClick={handleApprovePayment}
						className="w-full"
						disabled={isApproving || isProcessing || !hasEnoughBalance || isApproved}
					>
						{isApproving ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Approving...
							</>
						) : (
							`1. Approve ${ticker} Spending`
						)}
					</Button>
				)}

				<Button
					onClick={async () => {
						setIsProcessing(true);
						handlePayment();
						setIsProcessing(false);
					}}
					className="w-full"
					disabled={isProcessing || isApproving || !hasEnoughBalance || (!isApproved && account?.chain === "base")}
				>
					{isProcessing ? (
						<>
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							Processing Payment...
						</>
					) : (
						`${account?.chain === "solana" ? "" : "2. "}Pay with ${ticker}`
					)}
				</Button>
			</div>

			<div className="bg-primary/5 dark:bg-primary/10 p-4 rounded-lg border border-primary/20 text-sm text-foreground">
				<p>
					Please note that with price variations, you might not get the exact amount of credits as displayed.
					<br />
					If you need an exact amount of credits, use the crypto payment method.
				</p>
			</div>
		</div>
	);
}

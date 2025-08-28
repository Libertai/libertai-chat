import { Button } from "@/components/ui/button.tsx";
import { Coins, CreditCard, Zap } from "lucide-react";
import { cn } from "@/lib/utils.ts";

export type PaymentMethod = "crypto" | "card" | "ltai" | "solana";

interface PaymentMethodSelectorProps {
	onSelectMethod: (method: PaymentMethod) => void;
	selectedMethod: PaymentMethod;
	hasLTAI: boolean;
	chain: "base" | "solana" | undefined;
}

export function PaymentMethodSelector({
	onSelectMethod,
	selectedMethod,
	hasLTAI,
	chain,
}: Readonly<PaymentMethodSelectorProps>) {
	// Payment method options
	const paymentOptions = [
		{
			id: "ltai",
			method: "ltai",
			icon: <Coins className="h-5 w-5 text-primary" />,
			title: "Pay with LTAI",
			description: hasLTAI ? "Use your LTAI tokens" : "No LTAI tokens available",
			disabled: !hasLTAI,
			isVisible: true,
		},
		{
			id: "solana",
			method: "solana",
			icon: <Zap className="h-5 w-5 text-primary" />,
			title: "Pay with SOL",
			description: "Use your SOL tokens",
			disabled: false,
			isVisible: chain === "solana",
		},
		{
			id: "crypto",
			method: "crypto",
			icon: <Coins className="h-5 w-5 text-primary" />,
			title: `Pay with crypto ${chain === "solana" ? "on EVM" : ""}`,
			description: "Use USDC, ETH & more",
			disabled: false,
			isVisible: true,
		},
		{
			id: "card",
			method: "card",
			icon: <CreditCard className="h-5 w-5 text-primary" />,
			title: "Pay with card",
			description: "Use credit/debit card",
			disabled: false,
			isVisible: true,
		},
	];

	return (
		<div className="space-y-4">
			<h3 className="text-lg font-medium mb-2">Select Payment Method</h3>
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
				{paymentOptions.map(
					(option) =>
						option.isVisible && (
							<Button
								key={option.id}
								onClick={() => onSelectMethod(option.method as PaymentMethod)}
								variant="outline"
								className={cn(
									"h-auto py-4 justify-start relative whitespace-normal",
									selectedMethod === option.method
										? "border-[2.5px] !border-primary shadow-[0_0_0_1px_rgba(var(--primary),.3)]"
										: "border border-border",
								)}
								disabled={option.disabled}
								type="button"
							>
								{option.id === "ltai" && (
									<span className="absolute -top-2 -right-2 bg-green-700 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
										-20%
									</span>
								)}
								<div className="flex items-center gap-3">
									<div className="p-2 rounded-full bg-primary/10 dark:bg-primary/20">{option.icon}</div>
									<div className="text-left">
										<p className="font-medium text-foreground">{option.title}</p>
										<p className="text-xs text-foreground/70 text-pretty">{option.description}</p>
									</div>
								</div>
							</Button>
						),
				)}
			</div>
		</div>
	);
}

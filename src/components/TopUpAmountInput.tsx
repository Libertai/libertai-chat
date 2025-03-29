import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DollarSign } from "lucide-react";

interface TopUpAmountInputProps {
	pricingTiers: {
		id: string;
		name: string;
		tokens: number;
		price: number;
		usdcAmount: string;
		popular?: boolean;
	}[];
	onSelectAmount: (amount: number) => void;
}

export function TopUpAmountInput({ pricingTiers, onSelectAmount }: Readonly<TopUpAmountInputProps>) {
	const [customAmount, setCustomAmount] = useState("10");
	const [error, setError] = useState("");

	const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		// Remove non-numeric characters except decimal point
		const value = e.target.value.replace(/[^\d.]/g, "");

		// Ensure only one decimal point
		const parts = value.split(".");
		const formatted = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : value;

		setCustomAmount(formatted);

		// Clear error if input is valid
		if (Number(formatted) >= 1) {
			setError("");
		} else if (formatted === "" || formatted === ".") {
			setError("");
		} else {
			setError("Minimum amount is $1");
		}
	};

	const handleSubmit = () => {
		const amount = Number(customAmount);
		if (isNaN(amount) || amount < 1) {
			setError("Please enter a valid amount (minimum $1)");
			return;
		}

		onSelectAmount(amount);
	};

	const handleSelectTier = (price: number) => {
		setCustomAmount(price.toString());
		setError("");
	};

	return (
		<div className="space-y-6">
			<div className="bg-card/50 backdrop-blur-sm p-6 rounded-xl border border-border">
				<h3 className="text-lg font-semibold mb-4">Enter amount to top up</h3>

				<div className="space-y-4">
					<div className="relative">
						<div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
							<DollarSign className="h-5 w-5 text-muted-foreground" />
						</div>

						<Input
							type="text"
							value={customAmount}
							onChange={handleAmountChange}
							className="pl-10 text-lg font-medium h-12"
							placeholder="Enter amount"
							aria-label="Custom amount"
						/>
					</div>

					{error && <p className="text-sm text-destructive">{error}</p>}

					<Button
						onClick={handleSubmit}
						className="w-full h-12 text-lg"
						disabled={!customAmount || Number(customAmount) < 1 || !!error}
					>
						Top Up
					</Button>

					<div className="bg-card/50 p-3 rounded-lg mt-3 border border-border">
						<p className="text-sm font-medium mb-2">Usage Estimates:</p>
						{customAmount && Number(customAmount) >= 1 ? (
							<div className="space-y-1 text-sm">
								<div className="flex justify-between">
									<span className="text-muted-foreground">API calls:</span>
									<span className="font-medium">~{Math.round(Number(customAmount) * 20).toLocaleString()}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Basic queries:</span>
									<span className="font-medium">~{Math.round(Number(customAmount) * 80).toLocaleString()}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-muted-foreground">Advanced queries:</span>
									<span className="font-medium">~{Math.round(Number(customAmount) * 40).toLocaleString()}</span>
								</div>
							</div>
						) : (
							<p className="text-sm text-muted-foreground">Enter an amount to see usage estimates</p>
						)}
					</div>
				</div>
			</div>

			<div className="space-y-4">
				<h3 className="text-lg font-medium">Or select a plan</h3>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					{pricingTiers.map((tier) => {
						// Calculate approximate API calls (assuming average of 1000 tokens per call)
						const apiCalls = Math.round(tier.tokens / 1000);

						// Calculate approximate queries based on token usage
						// Assuming a query is about 50 tokens input and 200 tokens output for base model
						const baseQueries = Math.round(tier.tokens / 250);

						// Assuming a query is about 50 tokens input and 200 tokens output for advanced model
						const advancedQueries = Math.round(tier.tokens / 500);

						return (
							<div
								key={tier.id}
								className={`relative bg-card/50 backdrop-blur-sm rounded-xl border ${
									customAmount === tier.price.toString() ? "border-primary ring-2 ring-primary/20" : "border-border"
								} hover:border-primary transition-all`}
							>
								{tier.popular && (
									<div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground text-xs py-1 px-3 rounded-full">
										Popular
									</div>
								)}

								<div className="p-5">
									<div className="flex justify-between items-center mb-3">
										<h4 className="font-medium">{tier.name}</h4>
										<span className="text-xl font-bold">${tier.price}</span>
									</div>

									<div className="space-y-2 text-sm mb-4">
										<div className="flex justify-between">
											<span className="text-muted-foreground">API calls:</span>
											<span className="font-medium">~{apiCalls.toLocaleString()}</span>
										</div>
										<div className="flex justify-between">
											<span className="text-muted-foreground">Basic queries:</span>
											<span className="font-medium">~{baseQueries.toLocaleString()}</span>
										</div>
										<div className="flex justify-between">
											<span className="text-muted-foreground">Advanced queries:</span>
											<span className="font-medium">~{advancedQueries.toLocaleString()}</span>
										</div>
									</div>

									<Button
										onClick={() => handleSelectTier(tier.price)}
										variant={customAmount === tier.price.toString() ? "default" : "outline"}
										className="w-full mt-2"
									>
										Select
									</Button>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

import { Button } from "@/components/ui/button";
import { AlertTriangle, X } from "lucide-react";

interface CancelSubscriptionModalProps {
	onConfirm: () => void;
	onCancel: () => void;
	isLoading?: boolean;
	agentName: string;
	paidUntil: string;
}

export function CancelSubscriptionModal({
	onConfirm,
	onCancel,
	isLoading = false,
	agentName,
	paidUntil,
}: Readonly<CancelSubscriptionModalProps>) {
	return (
		<div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
			<div className="bg-card rounded-xl border border-border p-6 max-w-md w-full">
				<div className="flex justify-between items-center mb-6">
					<div className="flex items-center gap-3">
						<AlertTriangle className="h-5 w-5 text-destructive" />
						<h2 className="text-xl font-semibold">Cancel Subscription</h2>
					</div>
					<Button variant="ghost" size="icon" onClick={onCancel} disabled={isLoading}>
						<X className="h-4 w-4" />
					</Button>
				</div>

				<div className="space-y-4">
					<p className="text-foreground">
						Are you sure you want to cancel the subscription for <span className="font-semibold">{agentName}</span>?
					</p>

					<div className="bg-destructive/10 dark:bg-destructive/20 p-4 rounded-lg border border-destructive/20 flex gap-3">
						<AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
						<div className="text-sm text-foreground space-y-2">
							<p>
								<strong>Warning:</strong> This will cancel your subscription immediately.
							</p>
							<p>
								The agent instance and all data on it will be permanently deleted after your billing period ends on{" "}
								{paidUntil}.
							</p>
							<p>This action cannot be undone.</p>
						</div>
					</div>

					<div className="flex justify-end gap-3 mt-6">
						<Button variant="outline" onClick={onCancel} disabled={isLoading}>
							Cancel
						</Button>
						<Button onClick={onConfirm} disabled={isLoading} variant="destructive">
							{isLoading ? "Cancelling..." : "Cancel Subscription"}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}

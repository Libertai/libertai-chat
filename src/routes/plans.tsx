import { createFileRoute } from "@tanstack/react-router";
import { PlansSection } from "@libertai/auth";

export const Route = createFileRoute("/plans")({
	component: Plans,
});

function Plans() {
	return (
		<div className="container mx-auto px-4 py-8">
			<div className="flex flex-col space-y-6 max-w-5xl mx-auto">
				<div>
					<h1 className="text-3xl font-bold">Plans</h1>
					<p className="text-muted-foreground mt-1">
						Free includes a generous daily allowance. Upgrade for more usage and larger models.
					</p>
				</div>
				<PlansSection />
			</div>
		</div>
	);
}

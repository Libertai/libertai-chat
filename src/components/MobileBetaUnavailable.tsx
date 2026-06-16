import { Link } from "@tanstack/react-router";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

type MobileBetaUnavailableProps = {
	title: string;
	description: string;
};

export function MobileBetaUnavailable({ title, description }: Readonly<MobileBetaUnavailableProps>) {
	return (
		<div className="flex min-h-[calc(100svh-4rem)] items-center justify-center px-6 py-10">
			<div className="w-full max-w-md space-y-6 text-center">
				<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted">
					<Smartphone className="h-6 w-6 text-foreground" />
				</div>
				<div className="space-y-2">
					<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
					<p className="text-sm text-muted-foreground">{description}</p>
				</div>
				<Button asChild>
					<Link to="/">Back to chat</Link>
				</Button>
			</div>
		</div>
	);
}

import { createFileRoute } from "@tanstack/react-router";
import { ArrowUp, Brain, Heart, MessageCircle, Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	const cards = [
		{
			icon: <Zap className="h-6 w-6" />,
			title: "Light",
			subtitle: "Quick and nimble advisor",
		},
		{
			icon: <Heart className="h-6 w-6" />,
			title: "Harmony",
			subtitle: "Wellness Companion",
		},
		{
			icon: <MessageCircle className="h-6 w-6" />,
			title: "Chatty",
			subtitle: "Conversational partner",
		},
		{
			icon: <Brain className="h-6 w-6" />,
			title: "Mega Mind",
			subtitle: "Big brains, deep thinker",
			badge: "Pro",
		},
	];

	return (
		<div className="h-full flex flex-col bg-background text-foreground overflow-hidden">
			{/* Main content */}
			<div className="flex-1 flex flex-col md:items-center justify-center p-4 md:p-6 space-y-8 md:space-y-12 overflow-auto">
				{/* Hero text */}
				<h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-medium text-foreground leading-tight text-center max-sm:text-left">
					<span className="hidden md:inline">Try the world's most </span>
					<span className="md:hidden">The world's most </span>
					<span className="text-primary italic font-bold">Private</span>
					<span className="hidden md:inline"> AI advisor.</span>
					<span className="md:hidden">
						<br />
						AI advisor.
					</span>
				</h1>

				{/* Cards grid */}
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 w-full max-w-6xl">
					{cards.map((card, index) => (
						<div
							key={index}
							className="bg-muted/50 hover:bg-muted/80 dark:bg-gray-800/50 dark:hover:bg-gray-800/70 rounded-xl p-4 md:p-6 transition-colors cursor-pointer relative border border-border"
						>
							{card.badge && (
								<div className="absolute top-3 right-3 md:top-4 md:right-4">
									<span className="bg-primary text-white text-xs px-2 py-1 rounded-full">{card.badge}</span>
								</div>
							)}
							<div className="flex flex-col space-y-3 md:space-y-4">
								<div className="bg-muted dark:bg-gray-700/50 rounded-full p-2 md:p-3 w-fit">{card.icon}</div>
								<div className="space-y-1">
									<h3 className="text-base md:text-lg font-medium text-foreground">{card.title}</h3>
									<p className="text-xs md:text-sm text-muted-foreground">{card.subtitle}</p>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Bottom section with input and disclaimer */}
			<div className="flex-shrink-0 p-4 md:p-6 space-y-3 md:space-y-4">
				{/* Chat input */}
				<div className="max-w-2xl mx-auto relative">
					<div className="relative flex items-center">
						<Button
							variant="ghost"
							size="icon"
							className="absolute left-3 z-10 h-8 w-8 bg-muted hover:bg-muted/80 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-full"
						>
							<Plus className="h-4 w-4 text-muted-foreground" />
						</Button>
						<Input
							placeholder="Start a private conversation..."
							className="pl-14 pr-12 h-12 bg-muted/50 dark:bg-gray-800/50 border-border dark:border-gray-700 text-foreground placeholder:text-muted-foreground dark:placeholder:text-gray-400 rounded-full"
						/>
						<Button
							variant="ghost"
							size="icon"
							className="absolute right-3 z-10 h-8 w-8 bg-muted hover:bg-muted/80 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-full"
						>
							<ArrowUp className="h-4 w-4 text-muted-foreground" />
						</Button>
					</div>
				</div>

				{/* Disclaimer */}
				<p className="text-xs text-muted-foreground dark:text-gray-500 text-center max-w-2xl mx-auto">
					Like humans, AI may make mistakes. Verify information for critical decisions.
				</p>
			</div>
		</div>
	);
}

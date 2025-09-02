import { createFileRoute } from "@tanstack/react-router";
import { ArrowUp, Brain, Heart, MessageCircle, Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	const [inputValue, setInputValue] = useState("");
	const [isFocused, setIsFocused] = useState(false);
	const [isMultiLine, setIsMultiLine] = useState(false);
	const hasContent = inputValue.trim().length > 0;
	const shouldShowCentered = isFocused || hasContent;

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
		<div className="h-full flex flex-col bg-background text-foreground overflow-hidden relative">
			{/* Main content */}
			<div className="flex-1 flex flex-col md:items-center justify-center p-4 md:p-6 space-y-6 md:space-y-8 overflow-auto">
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

				{/* Cards grid - hide when focused or typing */}
				<div
					className={`grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 w-full max-w-6xl transition-all duration-500 ease-in-out ${
						shouldShowCentered
							? "opacity-0 transform translate-y-8 pointer-events-none"
							: "opacity-100 transform translate-y-0"
					}`}
				>
					{cards.map((card) => (
						<div
							key={card.title}
							className="bg-card hover:bg-white dark:hover:bg-[#313549] rounded-xl p-4 md:p-6 transition-colors cursor-pointer relative border border-border"
						>
							{card.badge && (
								<div className="absolute top-3 right-3 md:top-4 md:right-4">
									<span className="bg-primary text-white text-xs px-2 py-1 rounded-full">{card.badge}</span>
								</div>
							)}
							<div className="flex flex-col space-y-3 md:space-y-4">
								<div className="bg-muted rounded-full p-2 md:p-3 w-fit">{card.icon}</div>
								<div className="space-y-1">
									<h3 className="text-base md:text-lg font-medium text-foreground">{card.title}</h3>
									<p className="text-xs md:text-sm text-muted-foreground">{card.subtitle}</p>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Single animated input container */}
			<div
				className={`absolute left-0 right-0 transition-all duration-500 ease-in-out ${
					shouldShowCentered ? "top-[40%] md:top-[45%]" : "top-[calc(100%-120px)]"
				}`}
			>
				<div className="p-4 md:p-6 space-y-3 md:space-y-4">
					{/* Chat input */}
					<div className="max-w-2xl mx-auto relative">
						<div className="relative flex items-start">
							<Button
								variant="ghost"
								size="icon"
								className="absolute left-3 top-2 z-10 h-8 w-8 bg-muted bg-card rounded-full"
							>
								<Plus className="h-4 w-4 text-muted-foreground" />
							</Button>
							<Textarea
								placeholder="Start a private conversation..."
								className={`pl-14 pr-12 resize-none min-h-[48px] max-h-[240px] py-[14px] overflow-hidden ${
									isMultiLine ? "rounded-2xl" : "rounded-full"
								}`}
								id="chat-input"
								value={inputValue}
								onChange={(e) => setInputValue(e.target.value)}
								onFocus={() => setIsFocused(true)}
								onBlur={() => setIsFocused(false)}
								rows={1}
								onInput={(e) => {
									const target = e.target as HTMLTextAreaElement;
									target.style.height = "48px";
									const newHeight = Math.min(target.scrollHeight, 240);
									target.style.height = newHeight + "px";

									setIsMultiLine(newHeight > 48);
									target.style.overflowY = newHeight >= 240 ? "auto" : "hidden";
								}}
							/>
							<Button
								variant="ghost"
								size="icon"
								className={`absolute right-3 top-2 z-10 h-8 w-8 rounded-full transition-all duration-200 ${
									hasContent
										? "bg-primary hover:bg-primary/90 text-white"
										: "bg-muted text-muted-foreground hover:text-foreground cursor-not-allowed opacity-50"
								}`}
								disabled={!hasContent}
							>
								<ArrowUp className="h-4 w-4" />
							</Button>
						</div>
					</div>

					{/* Disclaimer */}
					<div>
						<p className="text-xs text-muted-foreground text-center max-w-2xl mx-auto">
							Like humans, AI may make mistakes. Verify information for critical decisions.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}

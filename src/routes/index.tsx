import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Brain, Heart, MessageCircle, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChatInput } from "@/components/ChatInput";

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	const navigate = useNavigate();
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const [inputValue, setInputValue] = useState("");
	const [isFocused, setIsFocused] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const hasContent = inputValue.trim().length > 0;
	const shouldShowCentered = isFocused || hasContent;

	// Keep input focused during transition
	useEffect(() => {
		if (isSubmitting && inputRef.current) {
			inputRef.current.focus();
		}
	}, [isSubmitting]);

	const handleSubmit = () => {
		if (!hasContent || isSubmitting) return;

		setIsSubmitting(true);

		// Generate UUID for new chat
		const chatId = crypto.randomUUID();

		// Store the initial message in localStorage
		const initialMessage = inputValue.trim();
		localStorage.setItem(
			`chat-${chatId}`,
			JSON.stringify({
				id: chatId,
				messages: [],
				initialMessage,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			}),
		);

		// Small delay to show the animation before navigating
		setTimeout(() => {
			navigate({
				to: "/chat/$chatId",
				params: { chatId },
			});
		}, 200);
	};

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
		<div
			className={`h-full flex flex-col bg-background text-foreground overflow-hidden relative transition-all duration-500 ${isSubmitting ? "animate-out slide-out-to-left-8 fade-out" : ""}`}
		>
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
					<div className="max-w-2xl mx-auto">
						<ChatInput
							value={inputValue}
							onChange={setInputValue}
							onSubmit={handleSubmit}
							onFocus={() => setIsFocused(true)}
							onBlur={(e) => {
								// Don't blur during submission to maintain focus
								if (!isSubmitting) {
									setIsFocused(false);
								} else {
									e.target.focus();
								}
							}}
							placeholder="Start a private conversation..."
							isSubmitting={isSubmitting}
							inputRef={inputRef}
						/>
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

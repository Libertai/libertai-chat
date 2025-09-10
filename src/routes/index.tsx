import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChatInput } from "@/components/ChatInput";
import { useChatStore } from "@/stores/chat";
import { useAssistantStore } from "@/stores/assistant";

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	const navigate = useNavigate();
	const { createChat } = useChatStore();
	const { assistants, selectedAssistant, setSelectedAssistant } = useAssistantStore();
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
		const firstMessage = inputValue.trim();

		// Create chat with the first message
		createChat(chatId, firstMessage, selectedAssistant);

		// Small delay to show the animation before navigating
		setTimeout(() => {
			navigate({
				to: "/chat/$chatId",
				params: { chatId },
			});
		}, 200);
	};

	return (
		<div
			className={`h-full flex flex-col bg-background text-foreground overflow-hidden relative transition-all duration-500 ${isSubmitting ? "animate-out slide-out-to-left-8 fade-out" : ""}`}
		>
			{/* Main content */}
			<div className="md:flex-1 md:flex md:flex-col md:items-center justify-center p-4 md:p-6 space-y-6 md:space-y-8 overflow-auto">
				{/* Hero text */}
				<h1 className="text-3xl lg:text-4xl text-foreground leading-tight text-center max-sm:text-left">
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
					className={`grid grid-cols-2 lg:grid-cols-4 gap-2.5 w-fit mx-auto md:transition-all md:duration-500 md:ease-in-out ${
						shouldShowCentered
							? "md:opacity-0 md:transform md:translate-y-8 md:pointer-events-none"
							: "opacity-100 transform translate-y-0"
					}`}
				>
					{assistants.map((card) => {
						const isSelected = selectedAssistant === card.id;
						return (
							<div
								key={card.id}
								onClick={() => setSelectedAssistant(card.id)}
								className={`rounded-xl p-4 transition-colors cursor-pointer relative border border-border w-40 h-40 md:w-50 md:h-50 ${
									isSelected ? "bg-hover" : "bg-card"
								}`}
							>
								{card.badge && (
									<div className="absolute top-3 right-3 md:top-4 md:right-4">
										<span className="bg-primary text-white text-xs px-2 py-1 rounded-full">{card.badge}</span>
									</div>
								)}
								<div className="flex flex-col justify-between h-full">
									<div className={`rounded-full p-2 md:p-3 w-fit ${isSelected ? "bg-background" : "bg-hover"}`}>
										{card.icon}
									</div>
									<div className="space-y-1">
										<h3 className="text-base md:text-lg font-medium text-foreground">{card.title}</h3>
										<p className="text-xs md:text-sm text-muted-foreground">{card.subtitle}</p>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{/* Single animated input container */}
			<div
				className={`absolute left-0 right-0 md:transition-all md:duration-500 md:ease-in-out ${
					shouldShowCentered ? "top-[calc(100%-120px)] md:top-[45%]" : "top-[calc(100%-120px)]"
				}`}
			>
				<div className="p-4 md:p-6 space-y-3 md:space-y-4">
					{/* Chat input */}
					<div className="max-w-3xl mx-auto">
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
						<p className="text-xs text-muted-foreground text-center max-w-3xl mx-auto">
							Like humans, AI may make mistakes. Verify information for critical decisions.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}

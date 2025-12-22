import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChatInput } from "@/components/ChatInput";
import { useChatStore } from "@/stores/chat";
import { useAssistantStore } from "@/stores/assistant";
import type { ImageData } from "@/types/chats";

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	const navigate = useNavigate();
	const { createChat } = useChatStore();
	const { selectedAssistant, getAssistantOrDefault } = useAssistantStore();
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = (value: string, images?: ImageData[]) => {
		if (!value.trim() || isSubmitting) return;

		setIsSubmitting(true);

		// Generate UUID for new chat
		const chatId = crypto.randomUUID();
		const firstMessage = value.trim();

		// Create chat with the first message and images
		createChat(chatId, firstMessage, selectedAssistant, images);

		// Small delay to show the animation before navigating
		setTimeout(() => {
			navigate({
				to: "/chat/$chatId",
				params: { chatId },
			}).then();
		}, 200);
	};

	return (
		<div
			className={`h-full flex flex-col bg-background text-foreground overflow-hidden relative transition-all duration-500 ${isSubmitting ? "animate-out slide-out-to-left-8 fade-out" : ""}`}
		>
			{/* Main content */}
			<div className="flex-1 flex flex-col md:items-center justify-center p-4 md:p-6 space-y-6 md:space-y-8 overflow-auto">
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
			</div>

			{/* Input container */}
			<div className="p-4 md:p-6 space-y-3 md:space-y-4">
				{/* Chat input */}
				<div className="max-w-3xl mx-auto">
					<ChatInput
						onSubmit={handleSubmit}
						placeholder="Start a private conversation..."
						isSubmitting={isSubmitting}
						assistant={getAssistantOrDefault(selectedAssistant)}
					/>
				</div>

				{/* Disclaimer */}
				<p className="max-sm:text-tiny max-sm:whitespace-nowrap md:text-xs text-muted-foreground text-center md:max-w-3xl mx-auto">
					Like humans, AI may make mistakes. Verify information for critical decisions.
				</p>
			</div>
		</div>
	);
}

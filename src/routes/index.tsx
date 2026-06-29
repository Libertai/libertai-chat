import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Brain, Settings2 } from "lucide-react";
import { ChatInput } from "@/components/ChatInput";
import { AssistantManager } from "@/components/AssistantManager";
import { MemoryManager } from "@/components/MemoryManager";
import { useChatStore } from "@/stores/chat";
import { useAssistantStore } from "@/stores/assistant";
import { useAccountStore } from "@libertai/auth";
import { useChatApiKey } from "@/hooks/data/use-chat-api-key";
import { setPendingForcedTool } from "@/utils/pending-forced-tool";
import type { SearchType } from "@/utils/chat-tools";
import type { ImageData, FileAttachment } from "@/types/chats";

export const Route = createFileRoute("/")({
	component: Index,
});

function Index() {
	const navigate = useNavigate();
	const { createChat } = useChatStore();
	const { assistants, selectedAssistant, setSelectedAssistant, getAssistantOrDefault } = useAssistantStore();
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);
	const { chatApiKey } = useChatApiKey();
	const [isFocused, setIsFocused] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [hasContent, setHasContent] = useState(false);
	const [managerOpen, setManagerOpen] = useState(false);
	const [memoryOpen, setMemoryOpen] = useState(false);
	const shouldShowCentered = isFocused || hasContent;

	const handleSubmit = (
		value: string,
		images?: ImageData[],
		forcedTool?: "web_search" | "generate_image",
		searchType?: SearchType,
		attachments?: FileAttachment[],
	) => {
		if (!value.trim() || isSubmitting) return;

		setIsSubmitting(true);

		// Generate UUID for new chat
		const chatId = crypto.randomUUID();
		const firstMessage = value.trim();

		// Create chat with the first message, images and extracted file attachments
		createChat(chatId, firstMessage, selectedAssistant, images, attachments);

		// Carry a forced tool (and its search mode) across navigation so the new chat's first
		// response honors it.
		if (forcedTool) {
			setPendingForcedTool(chatId, forcedTool, searchType);
		}

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

				{/* Manage assistants / Memory entry points - hidden alongside the cards when typing/focused. */}
				<div
					className={`flex items-center justify-center gap-2 md:transition-all md:duration-500 ${
						shouldShowCentered ? "md:opacity-0 md:pointer-events-none" : "opacity-100"
					}`}
				>
					<button
						type="button"
						data-testid="manage-assistants"
						onClick={() => setManagerOpen(true)}
						className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground"
					>
						<Settings2 className="h-4 w-4" />
						Manage assistants
					</button>
					<button
						type="button"
						data-testid="manage-memory"
						onClick={() => setMemoryOpen(true)}
						className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground"
					>
						<Brain className="h-4 w-4" />
						Memory
					</button>
				</div>

				{/* Cards grid - hide when focused or typing */}
				<div
					className={`grid grid-cols-2 lg:grid-cols-4 gap-2.5 w-fit mx-auto md:transition-all md:duration-500 md:ease-in-out ${
						shouldShowCentered
							? "md:opacity-0 md:transform md:translate-y-8 md:pointer-events-none"
							: "opacity-100 transform translate-y-0"
					}`}
				>
					{assistants
						.filter((a) => !a.hidden)
						.map((card) => {
							const isSelected = selectedAssistant === card.id;
							return (
								<div
									key={card.id}
									onClick={() => !card.disabled && setSelectedAssistant(card.id)}
									className={`rounded-xl p-4 transition-colors relative border border-border w-40 h-40 md:w-50 md:h-50 ${
										isSelected ? "bg-hover" : "bg-card"
									} ${card.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
								>
									{card.pro && (
										<div className="absolute top-3 right-3 md:top-4 md:right-4">
											<span className="bg-primary text-white text-xs px-2 py-1 rounded-full">Pro</span>
										</div>
									)}
									{card.badge && (
										<div className="absolute top-3 right-3 md:top-4 md:right-4">
											<span className="text-foreground text-xs px-2 py-1 rounded-full border border-foreground">
												{card.badge}
											</span>
										</div>
									)}
									<div className="flex flex-col justify-between h-full">
										<div className={`rounded-full p-2 md:p-3 w-fit ${isSelected ? "bg-background" : "bg-hover"}`}>
											{card.icon ?? (
												<span className="flex h-6 w-6 items-center justify-center text-xl" aria-hidden>
													{card.emoji ?? "🤖"}
												</span>
											)}
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

			<AssistantManager open={managerOpen} onOpenChange={setManagerOpen} />
			<MemoryManager open={memoryOpen} onOpenChange={setMemoryOpen} />

			{/* Single animated input container */}
			<div
				className={`md:absolute left-0 right-0 bottom-0 md:transition-all md:duration-500 md:ease-in-out ${
					shouldShowCentered ? "md:-translate-y-[calc(40vh-50%)]" : ""
				}`}
			>
				<div className="p-4 md:p-6 space-y-3 md:space-y-4">
					{/* Chat input */}
					<div className="max-w-3xl mx-auto">
						<ChatInput
							onSubmit={handleSubmit}
							onChange={setHasContent}
							onFocus={() => setIsFocused(true)}
							onBlur={() => {
								// Don't blur during submission to maintain focus
								if (!isSubmitting) {
									setIsFocused(false);
								}
							}}
							placeholder="Start a private conversation..."
							isSubmitting={isSubmitting}
							assistant={getAssistantOrDefault(selectedAssistant)}
							isConnected={isAuthenticated && !!chatApiKey}
						/>
					</div>

					{/* Disclaimer */}
					<p className="max-sm:text-tiny max-sm:whitespace-nowrap md:text-xs text-muted-foreground text-center md:max-w-3xl mx-auto">
						Like humans, AI may make mistakes. Verify information for critical decisions.
					</p>
				</div>
			</div>
		</div>
	);
}

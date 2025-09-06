import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { MessageCircle, Search } from "lucide-react";
import { Button } from "./ui/button";
import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
} from "./ui/command";
import { useChatStore } from "@/stores/chat";
import { type Chat, type Message } from "@/types/chats";

export function ChatSearch() {
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const navigate = useNavigate();
	const { getAllChats } = useChatStore();
	const allChats = getAllChats();

	// Detect if user is on Mac
	const isMac = typeof navigator !== "undefined" ? navigator.platform.toUpperCase().indexOf("MAC") >= 0 : false;

	// Helper function to get the first user message from a chat
	const getFirstMessage = (chat: Chat) => {
		const firstMessage = chat.messages.find((msg: Message) => msg.role === "user");
		return firstMessage?.content || "New chat";
	};

	// Helper function to search through all messages in a chat and return match info
	const getChatMatchInfo = (chat: Chat, query: string) => {
		if (!query.trim()) return { matches: true, snippet: null, highlightedSnippet: null };

		const lowerQuery = query.toLowerCase();
		for (const msg of chat.messages) {
			const lowerContent = msg.content.toLowerCase();
			const matchIndex = lowerContent.indexOf(lowerQuery);
			if (matchIndex !== -1) {
				// Create a snippet with context around the match
				const start = Math.max(0, matchIndex - 30);
				const end = Math.min(msg.content.length, matchIndex + query.length + 30);
				let snippet = msg.content.substring(start, end);

				// Add ellipsis if we're not at the beginning/end
				if (start > 0) snippet = "..." + snippet;
				if (end < msg.content.length) snippet = snippet + "...";

				// Create highlighted snippet for display
				const beforeMatch = snippet.substring(0, matchIndex - start + (start > 0 ? 3 : 0));
				const match = snippet.substring(
					matchIndex - start + (start > 0 ? 3 : 0),
					matchIndex - start + query.length + (start > 0 ? 3 : 0),
				);
				const afterMatch = snippet.substring(matchIndex - start + query.length + (start > 0 ? 3 : 0));

				return {
					matches: true,
					snippet,
					highlightedSnippet: { beforeMatch, match, afterMatch },
				};
			}
		}
		return { matches: false, snippet: null, highlightedSnippet: null };
	};

	// Helper function to check if chat matches search
	const chatMatchesSearch = (chat: Chat, query: string) => {
		return getChatMatchInfo(chat, query).matches;
	};

	// Filter chats based on search query
	const filteredChats = searchQuery.trim() ? allChats.filter((chat) => chatMatchesSearch(chat, searchQuery)) : allChats;

	// Helper function to handle chat selection
	const handleChatSelect = (chatId: string) => {
		navigate({ to: "/chat/$chatId", params: { chatId } });
		setSearchOpen(false);
		setSearchQuery("");
	};

	// Handle dialog open/close
	const handleOpenChange = (open: boolean) => {
		setSearchOpen(open);
		if (!open) {
			setSearchQuery("");
		}
	};

	// Add keyboard shortcut listener
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				if (allChats.length > 0) {
					setSearchOpen(true);
				}
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [allChats.length]);

	return (
		<>
			<div className="group/search">
				<Button
					variant="ghost"
					className="w-full justify-between"
					onClick={() => setSearchOpen(true)}
					disabled={allChats.length === 0}
				>
					<div className="flex items-center">
						<Search className="mr-2 h-4 w-4" />
						Search chats
					</div>
					<CommandShortcut className="opacity-0 group-hover/search:opacity-100 transition-opacity">
						{isMac ? "⌘K" : "Ctrl+K"}
					</CommandShortcut>
				</Button>
			</div>

			{/* Search Command Dialog */}
			<CommandDialog
				open={searchOpen}
				onOpenChange={handleOpenChange}
				title="Search Chats"
				description="Search through your chat conversations"
			>
				<Command shouldFilter={false} label="Search chats">
					<CommandInput placeholder="Search chats..." value={searchQuery} onValueChange={setSearchQuery} />
					<CommandList>
						<CommandEmpty>No chats found.</CommandEmpty>
						{filteredChats.length > 0 && (
							<CommandGroup heading="Chats">
								{filteredChats.map((chat) => {
									const firstMessage = getFirstMessage(chat);
									const matchInfo = getChatMatchInfo(chat, searchQuery);
									return (
										<CommandItem key={chat.id} onSelect={() => handleChatSelect(chat.id)} className="cursor-pointer">
											<MessageCircle className="mr-2 h-4 w-4 flex-shrink-0" />
											<div className="flex flex-col items-start w-full min-w-0">
												<span className="truncate w-full">{firstMessage}</span>
												{matchInfo.highlightedSnippet && (
													<span className="text-xs text-muted-foreground truncate w-full">
														{matchInfo.highlightedSnippet.beforeMatch}
														<strong className="font-semibold text-foreground">
															{matchInfo.highlightedSnippet.match}
														</strong>
														{matchInfo.highlightedSnippet.afterMatch}
													</span>
												)}
											</div>
										</CommandItem>
									);
								})}
							</CommandGroup>
						)}
					</CommandList>
				</Command>
			</CommandDialog>
		</>
	);
}

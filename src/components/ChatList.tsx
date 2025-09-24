import { Link, useNavigate } from "@tanstack/react-router";
import { useChatStore } from "@/stores/chat";
import { type Chat, type Message } from "@/types/chats";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { useState } from "react";
import { useSidebar } from "@/components/ui/sidebar";

export function ChatList() {
	const { getAllChats, deleteChat } = useChatStore();
	const navigate = useNavigate();
	const currentPath = location.pathname;
	const chats = getAllChats();
	const [activeChat, setActiveChat] = useState<string | null>(null);
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const { isMobile, setOpenMobile } = useSidebar();

	const getFirstMessage = (chat: Chat) => {
		const firstMessage = chat.messages.find((msg: Message) => msg.role === "user");
		return firstMessage?.content || "New chat";
	};

	const truncateText = (text: string, maxLength: number = 50) => {
		if (text.length <= maxLength) return text;
		return text.substring(0, maxLength).trim() + "...";
	};

	const handleDeleteChat = (chatId: string) => {
		// If we're currently on the specific chat page being deleted, redirect to home
		if (currentPath === `/chat/${chatId}`) {
			navigate({ to: "/" });
		}
		deleteChat(chatId);
	};

	return (
		<div className="p-3">
			<h3 className="text-sm font-medium text-muted-foreground mb-3">Chats</h3>

			{chats.length === 0 ? (
				<p className="text-xs text-muted-foreground">No chats yet</p>
			) : (
				<div className="space-y-1">
					{chats.map((chat) => {
						const firstMessageText = getFirstMessage(chat);

						return (
							<div
								key={chat.id}
								className="relative hover:bg-muted/50 rounded-md"
								onMouseEnter={() => setActiveChat(chat.id)}
								onMouseLeave={() => {
									if (!isDropdownOpen) setActiveChat(null);
								}}
							>
								<Link
									to="/chat/$chatId"
									params={{ chatId: chat.id }}
									className="block p-2 transition-colors"
									onClick={() => {
										if (isMobile) setOpenMobile(false);
									}}
								>
									<p className="text-sm text-foreground leading-snug">{truncateText(firstMessageText)}</p>
								</Link>

								<div
									className={`absolute top-1 right-1 transition-opacity ${
										activeChat === chat.id ? "opacity-100" : "opacity-0"
									}`}
								>
									<DropdownMenu
										onOpenChange={(open) => {
											setIsDropdownOpen(open);
											if (open) {
												setActiveChat(chat.id);
											} else {
												setActiveChat(null);
											}
										}}
									>
										<DropdownMenuTrigger asChild>
											<Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.preventDefault()}>
												<MoreHorizontal className="h-3 w-3" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem
												className="text-destructive focus:text-destructive"
												onClick={(e) => {
													e.preventDefault();
													handleDeleteChat(chat.id);
												}}
											>
												<Trash2 className="h-3 w-3 mr-2" />
												Delete
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

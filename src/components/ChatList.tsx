import { Link, useNavigate } from "@tanstack/react-router";
import { useChatStore } from "@/stores/chat";
import { type Chat, type Message } from "@/types/chats";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { useState } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";

export function ChatList() {
	const { getAllChats, deleteChat, renameChat } = useChatStore();
	const navigate = useNavigate();
	const currentPath = location.pathname;
	const chats = getAllChats();
	const [activeChat, setActiveChat] = useState<string | null>(null);
	const [dropdownOpenChatId, setDropdownOpenChatId] = useState<string | null>(null);
	const [renameDialogOpen, setRenameDialogOpen] = useState(false);
	const [renamingChat, setRenamingChat] = useState<Chat | null>(null);
	const [renameValue, setRenameValue] = useState("");
	const { isMobile, setOpenMobile } = useSidebar();

	const getChatTitle = (chat: Chat) => {
		if (chat.title) {
			return chat.title;
		}
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

	const handleRenameClick = (chat: Chat) => {
		setRenamingChat(chat);
		setRenameValue(getChatTitle(chat));
		setRenameDialogOpen(true);
		setDropdownOpenChatId(null);
	};

	const handleRenameSubmit = () => {
		if (renamingChat && renameValue.trim()) {
			renameChat(renamingChat.id, renameValue.trim());
		}
		setRenameDialogOpen(false);
		setRenamingChat(null);
		setRenameValue("");
		setActiveChat(null);
		setDropdownOpenChatId(null);
	};

	const handleRenameCancel = () => {
		setRenameDialogOpen(false);
		setRenamingChat(null);
		setRenameValue("");
		setActiveChat(null);
		setDropdownOpenChatId(null);
	};

	return (
		<div className="p-3">
			<h3 className="text-sm font-medium text-muted-foreground mb-3">Chats</h3>

			{chats.length === 0 ? (
				<p className="text-xs text-muted-foreground">No chats yet</p>
			) : (
				<div className="space-y-1">
					{chats.map((chat) => {
						const chatTitle = getChatTitle(chat);

						return (
							<div
								key={chat.id}
								className="relative hover:bg-muted/50 rounded-md"
								onMouseEnter={() => setActiveChat(chat.id)}
								onMouseLeave={() => {
									if (dropdownOpenChatId !== chat.id) setActiveChat(null);
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
									<p className="text-sm text-foreground leading-snug">{truncateText(chatTitle)}</p>
								</Link>

								<div
									className={`absolute top-1 right-1 transition-opacity ${
										activeChat === chat.id ? "opacity-100" : "opacity-0"
									}`}
								>
									<DropdownMenu
										open={dropdownOpenChatId === chat.id}
										onOpenChange={(open) => {
											setDropdownOpenChatId(open ? chat.id : null);
											if (open) {
												setActiveChat(chat.id);
											} else {
												setActiveChat(null);
											}
										}}
									>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												className="h-6 w-6 bg-background hover:bg-background"
												onClick={(e) => e.preventDefault()}
											>
												<MoreHorizontal className="h-3 w-3" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem
												onClick={(e) => {
													e.preventDefault();
													handleRenameClick(chat);
												}}
											>
												<Pencil className="h-3 w-3 mr-2" />
												Rename
											</DropdownMenuItem>
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

			<Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Rename Chat</DialogTitle>
						<DialogDescription>Enter a new name for this chat.</DialogDescription>
					</DialogHeader>
					<Input
						value={renameValue}
						onChange={(e) => setRenameValue(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								handleRenameSubmit();
							} else if (e.key === "Escape") {
								handleRenameCancel();
							}
						}}
						placeholder="Chat title"
					/>
					<DialogFooter>
						<Button variant="outline" onClick={handleRenameCancel}>
							Cancel
						</Button>
						<Button onClick={handleRenameSubmit}>Save</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

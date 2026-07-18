import { Link, useNavigate } from "@tanstack/react-router";
import { useChatStore } from "@/stores/chat";
import { useProjectStore } from "@/stores/project";
import { type Chat } from "@/types/chats";
import { getChatTitle, truncateText } from "@/utils/chat-title";
import { Check, Folder, FolderMinus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@libertai/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@libertai/ui/dropdown-menu";
import { useMemo, useState } from "react";
import { useSidebar } from "@libertai/ui/sidebar";
import { Input } from "@libertai/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@libertai/ui/dialog";

export function ChatList() {
	const deleteChat = useChatStore((s) => s.deleteChat);
	const renameChat = useChatStore((s) => s.renameChat);
	const setChatProject = useChatStore((s) => s.setChatProject);
	// Subscribe to a cheap ordered signature of what the rows actually display (id / title /
	// project link) instead of the whole store: during streaming the chat store updates many
	// times per second, but none of those flushes change this string, so the sidebar no longer
	// re-renders (and re-sorts every chat) on every token batch.
	const rowsSignature = useChatStore((s) =>
		Object.values(s.chats)
			.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
			.map((c) => `${c.id}|${truncateText(getChatTitle(c))}|${c.projectId ?? ""}`)
			.join("\n"),
	);
	// eslint-disable-next-line react-hooks/exhaustive-deps -- rowsSignature is the real dependency
	const chats = useMemo(() => useChatStore.getState().getAllChats(), [rowsSignature]);
	const projectsById = useProjectStore((s) => s.projects);
	// Same ordering as getAllProjects(); computed from the subscribed record so this only
	// recomputes on actual project changes, not on unrelated store writes.
	const projects = useMemo(
		() =>
			Object.values(projectsById).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
		[projectsById],
	);
	const navigate = useNavigate();
	const currentPath = location.pathname;
	const { isMobile, setOpenMobile } = useSidebar();

	const [activeChat, setActiveChat] = useState<string | null>(null);
	const [dropdownOpenChatId, setDropdownOpenChatId] = useState<string | null>(null);

	// Rename-chat dialog state.
	const [renameDialogOpen, setRenameDialogOpen] = useState(false);
	const [renamingChat, setRenamingChat] = useState<Chat | null>(null);
	const [renameValue, setRenameValue] = useState("");

	const handleDeleteChat = (chatId: string) => {
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
		closeRenameDialog();
	};

	const closeRenameDialog = () => {
		setRenameDialogOpen(false);
		setRenamingChat(null);
		setRenameValue("");
		setActiveChat(null);
		setDropdownOpenChatId(null);
	};

	// Per-chat action menu, reused for each chat row.
	const ChatActionsMenu = ({ chat }: { chat: Chat }) => {
		const inProject = !!chat.projectId && projects.some((p) => p.id === chat.projectId);
		return (
			<DropdownMenu
				open={dropdownOpenChatId === chat.id}
				onOpenChange={(open) => {
					setDropdownOpenChatId(open ? chat.id : null);
					setActiveChat(open ? chat.id : null);
				}}
			>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6 bg-background hover:bg-background"
						onClick={(e) => e.preventDefault()}
						data-testid={`chat-actions-${chat.id}`}
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

					{projects.length > 0 && (
						<DropdownMenuSub>
							<DropdownMenuSubTrigger data-testid={`chat-move-${chat.id}`}>
								<Folder className="h-3 w-3 mr-2" />
								{inProject ? "Change project" : "Add to project"}
							</DropdownMenuSubTrigger>
							<DropdownMenuSubContent>
								{projects.map((project) => (
									<DropdownMenuItem
										key={project.id}
										disabled={chat.projectId === project.id}
										onClick={(e) => {
											e.preventDefault();
											setChatProject(chat.id, project.id);
											setDropdownOpenChatId(null);
										}}
										data-testid={`chat-move-to-${project.id}-${chat.id}`}
									>
										<span className="truncate">{project.name}</span>
										{chat.projectId === project.id && <Check className="ml-auto h-3 w-3" />}
									</DropdownMenuItem>
								))}
							</DropdownMenuSubContent>
						</DropdownMenuSub>
					)}

					{inProject && (
						<DropdownMenuItem
							onClick={(e) => {
								e.preventDefault();
								setChatProject(chat.id, undefined);
								setDropdownOpenChatId(null);
							}}
							data-testid={`chat-remove-from-project-${chat.id}`}
						>
							<FolderMinus className="h-3 w-3 mr-2" />
							Remove from project
						</DropdownMenuItem>
					)}

					<DropdownMenuSeparator />
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
		);
	};

	const ChatRow = ({ chat }: { chat: Chat }) => (
		<div
			className="relative hover:bg-muted/50 rounded-md"
			onMouseEnter={() => setActiveChat(chat.id)}
			onMouseLeave={() => {
				if (dropdownOpenChatId !== chat.id) setActiveChat(null);
			}}
			data-testid={`chat-row-${chat.id}`}
		>
			<Link
				to="/chat/$chatId"
				params={{ chatId: chat.id }}
				className="block p-2 transition-colors"
				onClick={() => {
					if (isMobile) setOpenMobile(false);
				}}
			>
				<p className="text-sm text-foreground leading-snug">{truncateText(getChatTitle(chat))}</p>
			</Link>

			<div
				className={`absolute top-1 right-1 transition-opacity ${
					activeChat === chat.id || dropdownOpenChatId === chat.id ? "opacity-100" : "opacity-0"
				}`}
			>
				<ChatActionsMenu chat={chat} />
			</div>
		</div>
	);

	// Hide the Chats section until the user has at least one conversation. (Projects live on the
	// /projects page, reached from the sidebar's Projects nav link.)
	if (chats.length === 0) {
		return null;
	}

	return (
		<div className="p-3" data-testid="chat-list">
			{/* Chats — flat recency list of ALL chats. Projects live on the /projects page. */}
			<h3 className="text-sm font-medium text-muted-foreground mb-2">Chats</h3>
			<div className="space-y-1" data-testid="chats-section">
				{chats.map((chat) => (
					<ChatRow key={chat.id} chat={chat} />
				))}
			</div>

			{/* Rename-chat dialog. */}
			<Dialog open={renameDialogOpen} onOpenChange={(open) => (open ? setRenameDialogOpen(true) : closeRenameDialog())}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Rename Chat</DialogTitle>
						<DialogDescription>Enter a new name for this chat.</DialogDescription>
					</DialogHeader>
					<Input
						value={renameValue}
						onChange={(e) => setRenameValue(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleRenameSubmit();
							else if (e.key === "Escape") closeRenameDialog();
						}}
						placeholder="Chat title"
					/>
					<DialogFooter>
						<Button variant="outline" onClick={closeRenameDialog}>
							Cancel
						</Button>
						<Button onClick={handleRenameSubmit}>Save</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

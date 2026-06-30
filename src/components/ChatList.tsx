import { Link, useNavigate } from "@tanstack/react-router";
import { useChatStore } from "@/stores/chat";
import { useProjectStore } from "@/stores/project";
import { type Chat } from "@/types/chats";
import { getChatTitle, truncateText } from "@/utils/chat-title";
import { Check, Folder, FolderMinus, FolderPlus, MoreHorizontal, Pencil, Settings, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useState } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { useProjectDialogStore } from "@/stores/project-dialogs";

export function ChatList() {
	const { getAllChats, deleteChat, renameChat, setChatProject } = useChatStore();
	const { getAllProjects, deleteProject } = useProjectStore();
	const navigate = useNavigate();
	const currentPath = location.pathname;
	const chats = getAllChats();
	const projects = getAllProjects();
	const { isMobile, setOpenMobile } = useSidebar();
	const { openCreate, openSettings } = useProjectDialogStore();

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

	const handleDeleteProject = (projectId: string) => {
		deleteProject(projectId);
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

	// Hide the whole section until the user has at least one conversation or one project.
	if (chats.length === 0 && projects.length === 0) {
		return null;
	}

	return (
		<div className="p-3" data-testid="chat-list">
			{/* Projects */}
			{projects.length > 0 && (
				<div className="mb-4" data-testid="sidebar-projects">
					<div className="flex items-center justify-between mb-2">
						<h3 className="text-sm font-medium text-muted-foreground">Projects</h3>
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6 text-muted-foreground"
							onClick={() => openCreate()}
							title="New project"
							aria-label="New project"
							data-testid="create-project"
						>
							<FolderPlus className="h-4 w-4" />
						</Button>
					</div>
					<div className="space-y-0.5">
						{projects.map((project) => (
							<div
								key={project.id}
								className="flex items-center group rounded-md hover:bg-muted/50"
								data-testid={`project-row-${project.id}`}
							>
								<Link
									to="/project/$projectId"
									params={{ projectId: project.id }}
									className="flex flex-1 items-center gap-2 px-2 py-1.5 min-w-0"
									onClick={() => {
										if (isMobile) setOpenMobile(false);
									}}
								>
									<Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
									<span
										className="text-sm font-medium text-foreground truncate"
										data-testid={`project-name-${project.id}`}
									>
										{project.name}
									</span>
								</Link>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-6 mr-1 opacity-0 group-hover:opacity-100 transition-opacity"
											data-testid={`project-actions-${project.id}`}
										>
											<MoreHorizontal className="h-3 w-3" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem
											onClick={(e) => {
												e.preventDefault();
												openSettings(project);
											}}
											data-testid={`project-settings-${project.id}`}
										>
											<Settings className="h-3 w-3 mr-2" />
											Settings
										</DropdownMenuItem>
										<DropdownMenuItem
											className="text-destructive focus:text-destructive"
											onClick={(e) => {
												e.preventDefault();
												handleDeleteProject(project.id);
											}}
											data-testid={`project-delete-${project.id}`}
										>
											<Trash2 className="h-3 w-3 mr-2" />
											Delete project
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Chats — flat recency list of ALL chats (project + ungrouped). */}
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-sm font-medium text-muted-foreground">Chats</h3>
				{projects.length === 0 && (
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6 text-muted-foreground"
						onClick={() => openCreate()}
						title="New project"
						aria-label="New project"
						data-testid="create-project"
					>
						<FolderPlus className="h-4 w-4" />
					</Button>
				)}
			</div>
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

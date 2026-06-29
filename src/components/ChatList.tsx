import { Link, useNavigate } from "@tanstack/react-router";
import { useChatStore } from "@/stores/chat";
import { useProjectStore, type Project } from "@/stores/project";
import { type Chat } from "@/types/chats";
import { getChatTitle, truncateText } from "@/utils/chat-title";
import { ChevronDown, ChevronRight, Folder, FolderPlus, MoreHorizontal, Pencil, Settings, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useMemo, useState } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";

export function ChatList() {
	const { getAllChats, deleteChat, renameChat, setChatProject } = useChatStore();
	const { getAllProjects, createProject, renameProject, deleteProject, setProjectInstructions } = useProjectStore();
	const navigate = useNavigate();
	const currentPath = location.pathname;
	const chats = getAllChats();
	const projects = getAllProjects();
	const { isMobile, setOpenMobile } = useSidebar();

	const [activeChat, setActiveChat] = useState<string | null>(null);
	const [dropdownOpenChatId, setDropdownOpenChatId] = useState<string | null>(null);

	// Rename-chat dialog state.
	const [renameDialogOpen, setRenameDialogOpen] = useState(false);
	const [renamingChat, setRenamingChat] = useState<Chat | null>(null);
	const [renameValue, setRenameValue] = useState("");

	// Collapsed project groups (project id -> collapsed). Ungrouped is keyed as "__ungrouped__".
	const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

	// Create-project dialog state.
	const [createProjectOpen, setCreateProjectOpen] = useState(false);
	const [newProjectName, setNewProjectName] = useState("");

	// Project-settings dialog state (rename + instructions).
	const [projectDialogOpen, setProjectDialogOpen] = useState(false);
	const [editingProject, setEditingProject] = useState<Project | null>(null);
	const [projectNameValue, setProjectNameValue] = useState("");
	const [projectInstructionsValue, setProjectInstructionsValue] = useState("");

	// Group chats by project. Each project gets its (possibly empty) bucket; everything else lands
	// in the ungrouped bucket. A chat referencing a project that no longer exists is treated as
	// ungrouped.
	const { byProject, ungrouped } = useMemo(() => {
		const projectIds = new Set(projects.map((p) => p.id));
		const byProject: Record<string, Chat[]> = {};
		for (const p of projects) byProject[p.id] = [];
		const ungrouped: Chat[] = [];
		for (const chat of chats) {
			if (chat.projectId && projectIds.has(chat.projectId)) {
				byProject[chat.projectId].push(chat);
			} else {
				ungrouped.push(chat);
			}
		}
		return { byProject, ungrouped };
	}, [chats, projects]);

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

	const toggleCollapsed = (key: string) => {
		setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
	};

	const handleCreateProject = () => {
		const name = newProjectName.trim();
		if (!name) return;
		createProject({ name });
		setNewProjectName("");
		setCreateProjectOpen(false);
	};

	const handleOpenProjectSettings = (project: Project) => {
		setEditingProject(project);
		setProjectNameValue(project.name);
		setProjectInstructionsValue(project.instructions ?? "");
		setProjectDialogOpen(true);
	};

	const handleSaveProjectSettings = () => {
		if (!editingProject) return;
		const name = projectNameValue.trim();
		if (name && name !== editingProject.name) {
			renameProject(editingProject.id, name);
		}
		setProjectInstructions(editingProject.id, projectInstructionsValue);
		closeProjectDialog();
	};

	const closeProjectDialog = () => {
		setProjectDialogOpen(false);
		setEditingProject(null);
		setProjectNameValue("");
		setProjectInstructionsValue("");
	};

	const handleDeleteProject = (projectId: string) => {
		deleteProject(projectId);
	};

	// Per-chat action menu, reused inside both project groups and the ungrouped section.
	const ChatActionsMenu = ({ chat }: { chat: Chat }) => (
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

				<DropdownMenuSub>
					<DropdownMenuSubTrigger data-testid={`chat-move-${chat.id}`}>
						<Folder className="h-3 w-3 mr-2" />
						Move to project
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent>
						<DropdownMenuLabel>Projects</DropdownMenuLabel>
						<DropdownMenuItem
							disabled={!chat.projectId}
							onClick={(e) => {
								e.preventDefault();
								setChatProject(chat.id, undefined);
								setDropdownOpenChatId(null);
							}}
							data-testid={`chat-move-none-${chat.id}`}
						>
							No project
						</DropdownMenuItem>
						{projects.length > 0 && <DropdownMenuSeparator />}
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
								<Folder className="h-3 w-3 mr-2" />
								{project.name}
							</DropdownMenuItem>
						))}
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={(e) => {
								e.preventDefault();
								setDropdownOpenChatId(null);
								setCreateProjectOpen(true);
							}}
						>
							<FolderPlus className="h-3 w-3 mr-2" />
							New project
						</DropdownMenuItem>
					</DropdownMenuSubContent>
				</DropdownMenuSub>

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
			<div className="flex items-center justify-between mb-3">
				<h3 className="text-sm font-medium text-muted-foreground">Chats</h3>
				<Button
					variant="ghost"
					size="icon"
					className="h-6 w-6 text-muted-foreground"
					onClick={() => setCreateProjectOpen(true)}
					title="New project"
					aria-label="New project"
					data-testid="create-project"
				>
					<FolderPlus className="h-4 w-4" />
				</Button>
			</div>

			{/* Project groups (collapsible). Rendered even when empty so users can move chats in. */}
			{projects.map((project) => {
				const groupChats = byProject[project.id] ?? [];
				const isCollapsed = collapsed[project.id];
				return (
					<div key={project.id} className="mb-2" data-testid={`project-group-${project.id}`}>
						<div className="flex items-center group rounded-md hover:bg-muted/50">
							<button
								type="button"
								className="flex flex-1 items-center gap-1 px-1 py-1.5 text-left min-w-0"
								onClick={() => toggleCollapsed(project.id)}
								data-testid={`project-toggle-${project.id}`}
							>
								{isCollapsed ? (
									<ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
								) : (
									<ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
								)}
								<Folder className="h-3 w-3 shrink-0 text-muted-foreground" />
								<span
									className="text-sm font-medium text-foreground truncate"
									data-testid={`project-name-${project.id}`}
								>
									{project.name}
								</span>
								<span className="text-xs text-muted-foreground ml-1 shrink-0">{groupChats.length}</span>
							</button>

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
											handleOpenProjectSettings(project);
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

						{!isCollapsed && (
							<div className="pl-3 space-y-1" data-testid={`project-chats-${project.id}`}>
								{groupChats.length === 0 ? (
									<p className="text-xs text-muted-foreground px-2 py-1">No chats yet</p>
								) : (
									groupChats.map((chat) => <ChatRow key={chat.id} chat={chat} />)
								)}
							</div>
						)}
					</div>
				);
			})}

			{/* Ungrouped chats. */}
			{ungrouped.length > 0 && (
				<div className="mt-1" data-testid="ungrouped-section">
					{projects.length > 0 && (
						<h4 className="text-xs font-medium text-muted-foreground px-1 mb-1 mt-2">Ungrouped</h4>
					)}
					<div className="space-y-1">
						{ungrouped.map((chat) => (
							<ChatRow key={chat.id} chat={chat} />
						))}
					</div>
				</div>
			)}

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

			{/* Create-project dialog. */}
			<Dialog open={createProjectOpen} onOpenChange={setCreateProjectOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>New project</DialogTitle>
						<DialogDescription>Group related chats into a folder.</DialogDescription>
					</DialogHeader>
					<Input
						value={newProjectName}
						onChange={(e) => setNewProjectName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleCreateProject();
							else if (e.key === "Escape") setCreateProjectOpen(false);
						}}
						placeholder="Project name"
						data-testid="project-name-input"
						autoFocus
					/>
					<DialogFooter>
						<Button variant="outline" onClick={() => setCreateProjectOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleCreateProject} data-testid="project-create-submit">
							Create
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Project settings dialog (rename + per-project instructions). */}
			<Dialog
				open={projectDialogOpen}
				onOpenChange={(open) => (open ? setProjectDialogOpen(true) : closeProjectDialog())}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Project settings</DialogTitle>
						<DialogDescription>
							Rename the project and set instructions prepended to the system prompt for its chats.
						</DialogDescription>
					</DialogHeader>
					<Input
						value={projectNameValue}
						onChange={(e) => setProjectNameValue(e.target.value)}
						placeholder="Project name"
						data-testid="project-settings-name"
					/>
					<Textarea
						value={projectInstructionsValue}
						onChange={(e) => setProjectInstructionsValue(e.target.value)}
						placeholder="Optional instructions for every chat in this project (e.g. tone, domain, constraints)"
						rows={5}
						data-testid="project-settings-instructions"
					/>
					<DialogFooter>
						<Button variant="outline" onClick={closeProjectDialog}>
							Cancel
						</Button>
						<Button onClick={handleSaveProjectSettings} data-testid="project-settings-save">
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

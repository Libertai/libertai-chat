import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { Folder, MoreHorizontal, Plus, Settings, Trash2 } from "lucide-react";
import { useProjectStore } from "@/stores/project";
import { useChatStore } from "@/stores/chat";
import { useProjectDialogStore } from "@/stores/project-dialogs";
import { getChatTitle, truncateText } from "@/utils/chat-title";
import { Button } from "@libertai/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@libertai/ui/dropdown-menu";

export const Route = createFileRoute("/project/$projectId")({
	component: ProjectDetailPage,
});

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ProjectDetailPage() {
	const { projectId } = Route.useParams();
	const navigate = useNavigate();
	const project = useProjectStore((s) => s.getProject(projectId));
	const deleteProject = useProjectStore((s) => s.deleteProject);
	const openSettings = useProjectDialogStore((s) => s.openSettings);

	// Stable selector — avoids infinite-render-loop from getAllChats() returning a new array each call.
	const chatsRecord = useChatStore((s) => s.chats);
	const projectChats = useMemo(
		() =>
			Object.values(chatsRecord)
				.filter((c) => c.projectId === projectId)
				.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
		[chatsRecord, projectId],
	);

	if (!project) {
		return (
			<div className="mx-auto w-full max-w-2xl px-4 py-16 text-center" data-testid="project-not-found">
				<h1 className="text-2xl font-bold mb-2">Project not found</h1>
				<p className="text-muted-foreground mb-6">It may have been deleted.</p>
				<Button asChild>
					<Link to="/projects">Back to projects</Link>
				</Button>
			</div>
		);
	}

	const handleDelete = () => {
		deleteProject(project.id);
		navigate({ to: "/projects" });
	};

	return (
		<div className="mx-auto w-full max-w-3xl px-4 py-8" data-testid="project-detail-page">
			<div className="flex items-center justify-between gap-4 mb-6">
				<h1 className="flex items-center gap-3 text-2xl font-bold text-foreground min-w-0">
					<Folder className="h-6 w-6 shrink-0 text-muted-foreground" />
					<span className="truncate" data-testid="project-detail-name">
						{project.name}
					</span>
				</h1>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon" data-testid="project-detail-actions">
							<MoreHorizontal className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={() => openSettings(project)} data-testid="project-detail-settings">
							<Settings className="h-3 w-3 mr-2" />
							Settings
						</DropdownMenuItem>
						<DropdownMenuItem
							className="text-destructive focus:text-destructive"
							onClick={handleDelete}
							data-testid="project-detail-delete"
						>
							<Trash2 className="h-3 w-3 mr-2" />
							Delete project
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<Link
				to="/"
				search={{ project: project.id }}
				className="flex items-center gap-2 rounded-lg border border-border px-4 py-3 mb-6 text-sm font-medium text-foreground hover:bg-muted transition-colors"
				data-testid="project-new-chat"
			>
				<Plus className="h-4 w-4" />
				New chat in {project.name}
			</Link>

			{projectChats.length === 0 ? (
				<div className="text-center text-muted-foreground py-12" data-testid="project-chats-empty">
					No chats in this project yet.
				</div>
			) : (
				<div className="divide-y divide-border" data-testid="project-chats">
					{projectChats.map((chat) => (
						<Link
							key={chat.id}
							to="/chat/$chatId"
							params={{ chatId: chat.id }}
							className="flex items-center justify-between gap-4 px-3 py-3 hover:bg-muted/50 rounded-md"
							data-testid={`project-chat-${chat.id}`}
						>
							<span className="truncate text-foreground">{truncateText(getChatTitle(chat))}</span>
							<span className="shrink-0 text-sm text-muted-foreground">{formatDate(chat.updatedAt)}</span>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}

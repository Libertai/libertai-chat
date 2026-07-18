import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Folder, Search } from "lucide-react";
import { useProjectStore } from "@/stores/project";
import { useProjectDialogStore } from "@/stores/project-dialogs";
import { Button } from "@libertai/ui/button";
import { Input } from "@libertai/ui/input";

export const Route = createFileRoute("/projects")({
	component: ProjectsPage,
});

function formatModified(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function ProjectsPage() {
	const projectsRecord = useProjectStore((s) => s.projects);
	const openCreate = useProjectDialogStore((s) => s.openCreate);
	const [query, setQuery] = useState("");

	// Derive sorted project list from the store record (selector would return a new array
	// reference every render and trigger an infinite Zustand re-render loop).
	const projects = useMemo(
		() =>
			Object.values(projectsRecord).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
		[projectsRecord],
	);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects;
	}, [projects, query]);

	return (
		<div className="mx-auto w-full max-w-3xl px-4 py-8" data-testid="projects-page">
			<div className="flex items-center justify-between gap-4 mb-6">
				<h1 className="text-2xl font-bold text-foreground">Projects</h1>
				<div className="flex items-center gap-2">
					<div className="relative">
						<Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search projects"
							className="pl-8 w-48 md:w-64"
							data-testid="projects-search"
						/>
					</div>
					<Button onClick={() => openCreate()} data-testid="projects-new">
						New
					</Button>
				</div>
			</div>

			{filtered.length === 0 ? (
				<div className="text-center text-muted-foreground py-16" data-testid="projects-empty">
					{projects.length === 0
						? "No projects yet. Create one to group related chats."
						: "No projects match your search."}
				</div>
			) : (
				<div>
					<div className="flex items-center justify-between px-3 pb-2 text-xs font-medium text-muted-foreground">
						<span>Name</span>
						<span>Modified</span>
					</div>
					<div className="divide-y divide-border">
						{filtered.map((project) => (
							<Link
								key={project.id}
								to="/project/$projectId"
								params={{ projectId: project.id }}
								className="flex items-center justify-between gap-4 px-3 py-3 hover:bg-muted/50 rounded-md"
								data-testid={`projects-row-${project.id}`}
							>
								<span className="flex items-center gap-3 min-w-0">
									<span className="flex h-8 w-8 items-center justify-center rounded-md bg-hover shrink-0">
										<Folder className="h-4 w-4 text-muted-foreground" />
									</span>
									<span className="truncate text-foreground">{project.name}</span>
								</span>
								<span className="shrink-0 text-sm text-muted-foreground">{formatModified(project.updatedAt)}</span>
							</Link>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

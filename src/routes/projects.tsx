import { createFileRoute } from "@tanstack/react-router";

function ProjectsPage() {
	return <div className="p-8 text-muted-foreground">Projects — coming soon.</div>;
}

export const Route = createFileRoute("/projects")({
	component: ProjectsPage,
});

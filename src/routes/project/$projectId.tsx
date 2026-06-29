import { createFileRoute } from "@tanstack/react-router";

function ProjectPage() {
	return <div className="p-8 text-muted-foreground">Project — coming soon.</div>;
}

export const Route = createFileRoute("/project/$projectId")({
	component: ProjectPage,
});

import { createFileRoute } from "@tanstack/react-router";
import { CustomAdvisorsDashboard } from "@/components/CustomAdvisorsDashboard";

export const Route = createFileRoute("/custom-advisors/")({
	component: CustomAdvisorsDashboard,
});

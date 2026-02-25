import { createFileRoute } from "@tanstack/react-router";
import { NewCustomAdvisor } from "@/components/AssistantSelector";

export const Route = createFileRoute("/custom-advisors/new")({
	component: NewCustomAdvisor,
});

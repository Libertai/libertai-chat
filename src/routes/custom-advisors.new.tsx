import { createFileRoute } from "@tanstack/react-router";
import { CustomAdvisorForm } from "@/components/CustomAdvisorForm";

export const Route = createFileRoute("/custom-advisors/new")({
	component: NewCustomAdvisor,
});

function NewCustomAdvisor() {
	return <CustomAdvisorForm />;
}

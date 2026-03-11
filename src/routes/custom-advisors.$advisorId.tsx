import { createFileRoute } from "@tanstack/react-router";
import { CustomAdvisorForm } from "@/components/CustomAdvisorForm";

export const Route = createFileRoute("/custom-advisors/$advisorId")({
	component: EditCustomAdvisor,
});

function EditCustomAdvisor() {
	const { advisorId } = Route.useParams();
	return <CustomAdvisorForm advisorId={advisorId} />;
}

import { Button } from "@/components/ui/button";
import { Edit, MessageCircleX } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const ConversationNotFound = () => {
	return (
		<div className="container flex flex-col items-center justify-center min-h-[80vh] max-w-md text-center mx-auto px-4 py-16">
			<div className="space-y-6">
				<div className="space-y-4">
					<div className="flex justify-center">
						<MessageCircleX className="h-16 w-16 text-muted-foreground" />
					</div>
					<div className="space-y-2">
						<h1 className="text-3xl font-bold tracking-tight">Conversation Not Found</h1>
						<p className="text-muted-foreground">
							The conversation you're looking for doesn't exist or may have been deleted.
						</p>
					</div>
				</div>
				<div className="flex justify-center">
					<Button asChild>
						<Link to="/">
							Start new conversation
							<Edit />
						</Link>
					</Button>
				</div>
			</div>
		</div>
	);
};

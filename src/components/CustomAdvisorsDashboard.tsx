import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { X, Plus, Brain, Upload, Pencil } from "lucide-react";
import { useAssistantStore } from "@/stores/assistant";

export function CustomAdvisorsDashboard() {
	const navigate = useNavigate();
	const { customAssistants } = useAssistantStore();

	return (
		<div className="h-full flex flex-col bg-background overflow-auto">
			{/* Header with close button */}
			<div className="sticky top-0 z-10 bg-background border-b border-border">
				<div className="max-w-5xl mx-auto px-6 py-6 flex items-start justify-between">
					<div className="flex-1">
						<h1 className="text-3xl font-semibold text-foreground mb-2">
							Custom Advisors
						</h1>
						<p className="text-sm text-muted-foreground">
							Manage your custom advisors settings and preferences.
						</p>
					</div>
					<div className="flex items-center gap-3">
						<Button
							variant="outline"
							size="sm"
							className="rounded-full px-4 gap-2"
						>
							<Upload className="h-4 w-4" />
							Import
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="h-9 w-9 rounded-full"
							onClick={() => navigate({ to: "/" })}
						>
							<X className="h-5 w-5" />
						</Button>
					</div>
				</div>
			</div>

			{/* Main content */}
			<div className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
				<div className="space-y-6">
					{/* Create New Card */}
					<div className="bg-card border border-border rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-lg">
						<div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
							<Brain className="h-8 w-8 text-primary" />
						</div>
						<h2 className="text-xl font-semibold text-foreground mb-2">
							Create your own customizable AI advisor
						</h2>
						<p className="text-sm text-muted-foreground mb-6 max-w-md">
							Manage your custom advisors settings and preferences.
						</p>
						<Button
							onClick={() => navigate({ to: "/custom-advisors/new" })}
							className="rounded-full px-6 gap-2"
						>
							<Plus className="h-4 w-4" />
							Create New
						</Button>
					</div>

					{/* Existing Advisors List */}
					{customAssistants.length > 0 && (
						<div className="space-y-4">
							<h3 className="text-lg font-semibold text-foreground px-2">
								Your Advisors
							</h3>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{customAssistants.map((advisor) => (
									<div
										key={advisor.id}
										className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4 hover:border-primary/50 transition-colors shadow-sm"
									>
										{/* Avatar */}
										<div className="w-16 h-16 rounded-xl bg-hover flex items-center justify-center overflow-hidden border border-border flex-shrink-0">
											{advisor.imageUrl ? (
												<img
													src={advisor.imageUrl}
													alt={advisor.title}
													className="h-full w-full object-cover"
												/>
											) : (
												<Brain className="h-8 w-8 text-muted-foreground" />
											)}
										</div>

										{/* Content */}
										<div className="flex-1 min-w-0">
											<h4 className="text-base font-semibold text-foreground mb-1">
												{advisor.title}
											</h4>
											<p className="text-sm text-muted-foreground mb-2 line-clamp-1">
												{advisor.subtitle}
											</p>
											<span className="inline-block text-xs text-muted-foreground bg-hover px-2.5 py-1 rounded-full border border-border">
												{advisor.model}
											</span>
										</div>

										{/* Edit button */}
										<Button
											variant="outline"
											size="sm"
											className="rounded-full px-4 gap-2 flex-shrink-0"
											onClick={() => navigate({ to: "/custom-advisors/$advisorId", params: { advisorId: advisor.id } })}
										>
											<Pencil className="h-3.5 w-3.5" />
											Edit
										</Button>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Empty state hint */}
					{customAssistants.length === 0 && (
						<div className="text-center py-12">
							<p className="text-muted-foreground text-sm">
								No custom advisors yet. Create your first one above!
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

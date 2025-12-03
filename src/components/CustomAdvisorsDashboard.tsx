import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { X, Plus, Brain, Upload, Pencil } from "lucide-react";
import { useAssistantStore } from "@/stores/assistant";

export function CustomAdvisorsDashboard() {
	const navigate = useNavigate();
	const { customAssistants } = useAssistantStore();

	return (
		<div className="h-full flex flex-col bg-background overflow-auto">
			{/* Header */}
			<header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
				<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
					<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
						{/* Title section */}
						<div className="flex-1 space-y-1">
							<h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
								Custom Advisors
							</h1>
							<p className="text-sm text-muted-foreground max-w-2xl">
								Manage your custom advisors settings and preferences.
							</p>
						</div>

						{/* Action buttons */}
						<div className="flex items-center gap-2 sm:gap-3">
							<Button
								variant="outline"
								size="sm"
								className="rounded-full px-3 sm:px-4 gap-2 flex-shrink-0"
							>
								<Upload className="h-4 w-4" />
								<span className="hidden sm:inline">Import</span>
							</Button>
							<Button
								variant="ghost"
								size="icon"
								className="h-9 w-9 rounded-full flex-shrink-0"
								onClick={() => navigate({ to: "/" })}
							>
								<X className="h-5 w-5" />
							</Button>
						</div>
					</div>
				</div>
			</header>

			{/* Main content */}
			<main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
				<div className="space-y-8">
					{/* Create New Card */}
					<div className="bg-card border border-border rounded-3xl p-6 sm:p-8 lg:p-10 shadow-lg hover:shadow-xl transition-shadow">
						<div className="flex flex-col items-center text-center space-y-4 sm:space-y-5">
							<div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
								<Brain className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
							</div>
							<div className="space-y-2 max-w-lg">
								<h2 className="text-xl sm:text-2xl font-semibold text-foreground">
									Create your own customizable AI advisor
								</h2>
								<p className="text-sm sm:text-base text-muted-foreground">
									Design personalized advisors tailored to your specific needs and preferences.
								</p>
							</div>
							<Button
								onClick={() => navigate({ to: "/custom-advisors/new" })}
								className="rounded-full px-6 sm:px-8 gap-2 mt-2"
								size="lg"
							>
								<Plus className="h-4 w-4" />
								Create New
							</Button>
						</div>
					</div>

					{/* Existing Advisors List */}
					{customAssistants.length > 0 && (
						<section className="space-y-5">
							<div className="flex items-center justify-between px-1">
								<h3 className="text-lg sm:text-xl font-semibold text-foreground">
									Your Advisors
								</h3>
								<span className="text-sm text-muted-foreground">
									{customAssistants.length} {customAssistants.length === 1 ? "advisor" : "advisors"}
								</span>
							</div>

							<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
								{customAssistants.map((advisor, index) => {
									const isLast = index === customAssistants.length - 1;
									const isOdd = customAssistants.length % 2 === 1;
									const shouldSpanFull = isLast && isOdd;

									return (
										<article
											key={advisor.id}
											className={`
												group bg-card border border-border rounded-2xl p-5 sm:p-6
												hover:border-primary/50 hover:shadow-md
												transition-all duration-200
												${shouldSpanFull ? "lg:col-span-2" : ""}
											`}
										>
											<div className={`flex gap-4 sm:gap-6 ${shouldSpanFull ? "lg:max-w-2xl lg:mx-auto" : ""}`}>
												{/* Avatar */}
												<div className="w-20 h-20 sm:w-28 sm:h-28 lg:w-32 lg:h-32 flex-shrink-0 rounded-xl bg-hover/50 border border-border overflow-hidden">
													{advisor.imageUrl ? (
														<img
															src={advisor.imageUrl}
															alt={advisor.title}
															className="w-full h-full object-cover"
														/>
													) : (
														<div className="w-full h-full flex items-center justify-center">
															<Brain className="h-8 w-8 sm:h-12 sm:w-12 lg:h-14 lg:w-14 text-muted-foreground" />
														</div>
													)}
												</div>

												{/* Content */}
												<div className="flex-1 min-w-0 space-y-3 sm:space-y-4">
													{/* Title and description */}
													<div className="space-y-1.5">
														<h4 className="text-base sm:text-lg font-semibold text-foreground truncate">
															{advisor.title}
														</h4>
														<p className="text-sm text-muted-foreground line-clamp-2">
															{advisor.subtitle}
														</p>
													</div>

													{/* Model badge */}
													<div className="flex items-center">
														<span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-hover/80 text-muted-foreground border border-border">
															{advisor.model}
														</span>
													</div>

													{/* Edit button */}
													<Button
														variant="outline"
														size="sm"
														className="rounded-full px-4 sm:px-6 gap-2 w-full sm:w-auto sm:text-base group-hover:border-primary/50 transition-colors"
														onClick={() =>
															navigate({
																to: "/custom-advisors/$advisorId",
																params: { advisorId: advisor.id },
															})
														}
													>
														<Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
														Edit
													</Button>
												</div>
											</div>
										</article>
									);
								})}
							</div>
						</section>
					)}

					{/* Empty state */}
					{customAssistants.length === 0 && (
						<div className="text-center py-12 sm:py-16">
							<div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
								<Brain className="h-8 w-8 text-muted-foreground" />
							</div>
							<p className="text-sm sm:text-base text-muted-foreground">
								No custom advisors yet. Create your first one above!
							</p>
						</div>
					)}
				</div>
			</main>
		</div>
	);
}

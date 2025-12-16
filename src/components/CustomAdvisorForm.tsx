import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X, Upload, Brain } from "lucide-react";
import { useAssistantStore } from "@/stores/assistant";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CustomAdvisorFormProps {
	advisorId?: string;
}

const AVAILABLE_MODELS = [
	{ id: "gemma-3-27b", name: "Gemma 3 27B", description: "Fast and versatile" },
	{ id: "glm-4.5-air", name: "GLM 4.5 Air", description: "Advanced reasoning" },
];

export function CustomAdvisorForm({ advisorId }: Readonly<CustomAdvisorFormProps>) {
	const navigate = useNavigate();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const {
		customAssistants,
		addCustomAssistant,
		updateCustomAssistant,
		deleteCustomAssistant,
	} = useAssistantStore();

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
	const [personalityPrompt, setPersonalityPrompt] = useState("");
	const [imageUrl, setImageUrl] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		if (!advisorId) return;

		const advisor = customAssistants.find((a) => a.id === advisorId);
		if (!advisor) return;

		setName(advisor.title);
		setDescription(advisor.subtitle);
		setSelectedModel(advisor.model);
		setPersonalityPrompt(advisor.systemPrompt);
		setImageUrl(advisor.imageUrl || "");
	}, [advisorId, customAssistants]);

	const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = () => setImageUrl(reader.result as string);
		reader.readAsDataURL(file);

		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	const handleSave = () => {
		if (!name.trim() || !description.trim() || !personalityPrompt.trim()) return;

		setIsSaving(true);

		const assistantData = {
			title: name.trim(),
			subtitle: description.trim(),
			model: selectedModel,
			systemPrompt: personalityPrompt.trim(),
			imageUrl: imageUrl || undefined,
			icon: <Brain className="h-6 w-6" />,
			isCustom: true,
		};

		if (advisorId) {
			updateCustomAssistant(advisorId, assistantData);
		} else {
			addCustomAssistant(assistantData);
		}

		setTimeout(() => navigate({ to: "/" }), 100);
	};

	const handleDelete = () => {
		if (!advisorId) return;
		if (!confirm("Are you sure you want to delete this advisor?")) return;

		deleteCustomAssistant(advisorId);
		navigate({ to: "/" });
	};

	const selectedModelData =
		AVAILABLE_MODELS.find((m) => m.id === selectedModel) ??
		AVAILABLE_MODELS[0];

	return (
		<div className="h-full flex items-center justify-center px-8 py-6 bg-background overflow-hidden">
			<div className="w-full max-w-4xl h-full flex flex-col">
				<div className="bg-card border border-border rounded-3xl flex flex-col h-full max-h-[90vh]">
					{/* Header */}
					<div className="px-8 py-6 border-b border-border flex items-center justify-between">
						<h1 className="text-2xl font-semibold text-foreground">
							Custom Advisor
						</h1>
						<Button
							variant="outline"
							size="sm"
							className="rounded-full px-4"
							onClick={() => navigate({ to: "/" })}
						>
							<Upload className="mr-2 h-4 w-4" />
							Export
						</Button>
					</div>

					{/* Content */}
					<div className="flex-1 overflow-y-auto px-8 py-4">
						<div className="flex flex-col gap-4">
							{/* Name */}
							<div className="flex flex-col gap-3">
								<label className="text-lg font-medium text-foreground">
									Name
								</label>
								<Input
									placeholder="e.g., Code Expert"
									value={name}
									onChange={(e) => setName(e.target.value)}
									className="w-full max-w-md"
								/>
							</div>

							{/* Image + Description */}
							<div className="flex flex-col md:flex-row gap-10">
								<div className="flex flex-col gap-3">
                  <span className="text-lg font-medium text-foreground">
                    Image
                  </span>

									<input
										type="file"
										ref={fileInputRef}
										className="hidden"
										accept="image/jpeg,image/jpg,image/png"
										onChange={handleImageUpload}
									/>

									<div
										onClick={() => fileInputRef.current?.click()}
										className="relative w-32 h-32 rounded-2xl bg-hover flex items-center justify-center overflow-hidden border-2 border-border cursor-pointer hover:border-primary transition-colors"
									>
										{imageUrl ? (
											<img
												src={imageUrl}
												alt="Advisor avatar"
												className="h-full w-full object-cover"
											/>
										) : (
											<Upload className="h-8 w-8 text-muted-foreground" />
										)}

										{imageUrl && (
											<button
												onClick={(e) => {
													e.stopPropagation();
													setImageUrl("");
												}}
												className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center"
											>
												<X className="h-3.5 w-3.5" />
											</button>
										)}
									</div>
								</div>

								<div className="flex flex-col gap-3 flex-1">
									<label className="text-lg font-medium text-foreground">
										Description
									</label>
									<Textarea
										placeholder="Specialized in programming and software development"
										value={description}
										onChange={(e) => setDescription(e.target.value)}
										className="h-32 resize-none"
									/>
								</div>
							</div>

							{/* Preferred Model */}
							<div className="flex flex-col gap-3">
                <span className="text-lg font-medium text-foreground">
                  Preferred Model
                </span>

								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="outline"
											className="w-full  justify-between"
										>
											<div className="flex flex-col items-start">
                        <span className="text-sm font-medium">
                          {selectedModelData.name}
                        </span>
												<span className="text-xs text-muted-foreground">
                          {selectedModelData.description}
                        </span>
											</div>
										</Button>
									</DropdownMenuTrigger>

									<DropdownMenuContent className="w-[400px]">
										{AVAILABLE_MODELS.map((model) => (
											<DropdownMenuItem
												key={model.id}
												onClick={() => setSelectedModel(model.id)}
												className="p-3 cursor-pointer"
											>
												<div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {model.name}
                          </span>
													<span className="text-xs text-muted-foreground">
                            {model.description}
                          </span>
												</div>
											</DropdownMenuItem>
										))}
									</DropdownMenuContent>
								</DropdownMenu>
							</div>

							{/* Personality */}
							<div className="flex flex-col gap-4">
								<label className="text-lg font-medium text-foreground">
									Personality
								</label>

								<Textarea
									placeholder="Describe how this advisor should behave and respond..."
									value={personalityPrompt}
									onChange={(e) => setPersonalityPrompt(e.target.value)}
									className="min-h-[180px] max-h-[180px] resize-none overflow-y-auto"
								/>

								<p className="text-xs text-muted-foreground">
									This defines how your advisor will behave and respond to questions.
								</p>
							</div>
						</div>
					</div>

					{/* Footer */}
					<div className="px-8 py-6 border-t border-border flex items-center justify-between">
						{advisorId ? (
							<Button variant="destructive" onClick={handleDelete}>
								Delete
							</Button>
						) : (
							<div />
						)}

						<div className="flex gap-3">
							<Button variant="outline" onClick={() => navigate({ to: "/" })}>
								Cancel
							</Button>
							<Button
								onClick={handleSave}
								disabled={
									!name.trim() ||
									!description.trim() ||
									!personalityPrompt.trim() ||
									isSaving
								}
							>
								{isSaving ? "Saving..." : "Save"}
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

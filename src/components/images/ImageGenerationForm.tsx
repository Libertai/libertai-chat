import { useState, useEffect, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useImageModels } from "@/hooks/data/use-image-models";
import { useImageGeneration, ImageGenerationParams } from "@/hooks/data/use-image-generation";
import { useImageStore, MAX_IMAGES, GeneratedImage } from "@/stores/image";
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ImageSettings } from "./ImageGallery";

const WARNING_THRESHOLD = 40;

const SIZE_PRESETS = [
	{ label: "512x512", width: 512, height: 512 },
	{ label: "512x768", width: 512, height: 768 },
	{ label: "768x512", width: 768, height: 512 },
	{ label: "1024x1024", width: 1024, height: 1024 },
];

const DEFAULT_MODEL = "z-image-turbo";

interface ImageGenerationFormProps {
	initialSettings?: ImageSettings;
	onGenerated?: (image: GeneratedImage) => void;
}

function findSizePresetIndex(width: number, height: number): number {
	const index = SIZE_PRESETS.findIndex((p) => p.width === width && p.height === height);
	return index >= 0 ? index : 0;
}

export function ImageGenerationForm({ initialSettings, onGenerated }: ImageGenerationFormProps) {
	const [prompt, setPrompt] = useState(initialSettings?.prompt ?? "");
	const [model, setModel] = useState(initialSettings?.model ?? DEFAULT_MODEL);
	const [sizePreset, setSizePreset] = useState(
		initialSettings ? findSizePresetIndex(initialSettings.width, initialSettings.height) : 0,
	);
	const [steps, setSteps] = useState(initialSettings?.steps ?? 9);
	const [seed, setSeed] = useState(initialSettings?.seed?.toString() ?? "");
	const [removeBackground, setRemoveBackground] = useState(false);
	const [showAdvanced, setShowAdvanced] = useState(!!initialSettings?.seed);

	const { models, isLoading: modelsLoading } = useImageModels();
	const { generate, isGenerating } = useImageGeneration();
	const images = useImageStore((state) => state.images);
	const addImage = useImageStore((state) => state.addImage);
	const imageCount = Object.keys(images).length;

	// Fallback to first model if selected model doesn't exist
	useEffect(() => {
		if (models.length > 0 && !models.some((m) => m.id === model)) {
			setModel(models[0].id);
		}
	}, [models, model]);

	const handleGenerate = async () => {
		if (!prompt.trim() || isGenerating) return;

		if (imageCount >= MAX_IMAGES) {
			toast.error(`Image limit reached (${MAX_IMAGES})`, {
				description: "Delete some images to generate more",
			});
			return;
		}

		const size = SIZE_PRESETS[sizePreset];
		const params: ImageGenerationParams = {
			model,
			prompt: prompt.trim(),
			width: size.width,
			height: size.height,
			steps,
			remove_background: removeBackground,
		};

		if (seed.trim()) {
			const parsedSeed = parseInt(seed, 10);
			if (!Number.isNaN(parsedSeed)) {
				params.seed = parsedSeed;
			}
		}

		try {
			const result = await generate(params);

			if (result.images && result.images.length > 0) {
				const newImage: GeneratedImage = {
					id: crypto.randomUUID(),
					prompt: prompt.trim(),
					base64: `data:image/png;base64,${result.images[0]}`,
					model,
					width: size.width,
					height: size.height,
					seed: result.parameters.seed,
					createdAt: new Date().toISOString(),
				};

				const added = addImage(newImage);
				if (added) {
					toast.success("Image generated");
					onGenerated?.(newImage);
				} else {
					toast.error("Failed to save - storage limit reached");
				}
			}
		} catch {
			// Error already handled in hook
		}
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleGenerate();
		}
	};

	return (
		<div className="space-y-4">
			{/* Prompt Input */}
			<div className="relative rounded-2xl border border-input bg-input overflow-hidden focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
				<Textarea
					placeholder="Describe your image..."
					value={prompt}
					onChange={(e) => setPrompt(e.target.value)}
					onKeyDown={handleKeyDown}
					className="px-4 pb-14 pt-3 resize-none min-h-[100px] max-h-[200px] border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
					disabled={isGenerating}
				/>
				<div className="absolute bottom-3 left-0 right-0 flex items-center justify-between px-3">
					<div className="flex items-center gap-2 flex-wrap">
						{models.length > 1 && (
							<div className="relative">
								<select
									value={model}
									onChange={(e) => setModel(e.target.value)}
									disabled={modelsLoading || isGenerating}
									className="text-sm text-foreground font-medium border border-border rounded-full pl-3 pr-7 py-1.5 bg-background cursor-pointer hover:bg-muted transition-colors appearance-none"
								>
									{[...models]
										.sort((a, b) => (a.id === DEFAULT_MODEL ? -1 : b.id === DEFAULT_MODEL ? 1 : 0))
										.map((m) => (
											<option key={m.id} value={m.id}>
												{m.name}
											</option>
										))}
								</select>
								<ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none text-muted-foreground" />
							</div>
						)}
						<div className="relative">
							<select
								value={sizePreset}
								onChange={(e) => setSizePreset(Number(e.target.value))}
								disabled={isGenerating}
								className="text-sm text-foreground font-medium border border-border rounded-full pl-3 pr-7 py-1.5 bg-background cursor-pointer hover:bg-muted transition-colors appearance-none"
							>
								{SIZE_PRESETS.map((preset, i) => (
									<option key={preset.label} value={i}>
										{preset.label}
									</option>
								))}
							</select>
							<ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none text-muted-foreground" />
						</div>
					</div>
					<Button
						size="icon"
						className="h-8 w-8 rounded-full shrink-0"
						disabled={isGenerating || !prompt.trim()}
						onClick={handleGenerate}
					>
						{isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
					</Button>
				</div>
			</div>

			{/* Advanced Settings Toggle */}
			<button
				type="button"
				onClick={() => setShowAdvanced(!showAdvanced)}
				className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
			>
				{showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
				Advanced settings
			</button>

			{/* Advanced Settings Panel */}
			{showAdvanced && (
				<div className="space-y-4 p-4 bg-muted/50 rounded-xl border border-border">
					<div className="flex items-center justify-between">
						<div>
							<label htmlFor="steps-input" className="text-sm font-medium">Steps</label>
							<p className="text-xs text-muted-foreground">More steps = more detail</p>
						</div>
						<div className="flex items-center gap-3">
							<input
								id="steps-input"
								type="range"
								min="1"
								max="20"
								value={steps}
								onChange={(e) => setSteps(Number(e.target.value))}
								className="w-28 h-1.5 rounded-full appearance-none cursor-pointer bg-border [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
								disabled={isGenerating}
							/>
							<span className="text-sm font-mono w-5 text-right">{steps}</span>
						</div>
					</div>

					<div className="flex items-center justify-between border-t border-border pt-4">
						<div>
							<label htmlFor="seed-input" className="text-sm font-medium">Seed</label>
							<p className="text-xs text-muted-foreground">For reproducible results</p>
						</div>
						<Input
							id="seed-input"
							type="number"
							placeholder="Random"
							value={seed}
							onChange={(e) => setSeed(e.target.value)}
							className="w-28 h-8"
							disabled={isGenerating}
						/>
					</div>

					<div className="flex items-center justify-between border-t border-border pt-4">
						<div>
							<label htmlFor="remove-bg-switch" className="text-sm font-medium">Remove background</label>
							<p className="text-xs text-muted-foreground">Transparent PNG</p>
						</div>
						<Switch id="remove-bg-switch" checked={removeBackground} onCheckedChange={setRemoveBackground} disabled={isGenerating} />
					</div>
				</div>
			)}

			{/* Storage warning */}
			{imageCount >= WARNING_THRESHOLD && (
				<div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 text-sm">
					<AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
					<span>
						{imageCount >= MAX_IMAGES
							? "Storage full. Delete some images to generate more."
							: `Running low on storage (${MAX_IMAGES - imageCount} slots left)`}
					</span>
				</div>
			)}
		</div>
	);
}

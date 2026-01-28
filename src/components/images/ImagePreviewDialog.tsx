import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GeneratedImage, useImageStore } from "@/stores/image";
import { useImageGeneration } from "@/hooks/data/use-image-generation";
import { Copy, Download, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { ImageSettings } from "./ImageGallery";

interface ImagePreviewDialogProps {
	image: GeneratedImage | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCopySettings?: (settings: ImageSettings) => void;
}

export function ImagePreviewDialog({ image, open, onOpenChange, onCopySettings }: ImagePreviewDialogProps) {
	const deleteImage = useImageStore((state) => state.deleteImage);
	const addImage = useImageStore((state) => state.addImage);
	const { generate, isGenerating } = useImageGeneration();
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [displayImage, setDisplayImage] = useState<GeneratedImage | null>(image);

	// Sync displayImage with prop when dialog opens or image changes
	useEffect(() => {
		if (image) {
			setDisplayImage(image);
		}
	}, [image]);

	// Reset state when dialog closes
	useEffect(() => {
		if (!open) {
			setShowDeleteConfirm(false);
		}
	}, [open]);

	if (!displayImage) return null;

	const handleDownload = () => {
		const link = document.createElement("a");
		link.href = displayImage.base64;
		link.download = `libertai-${displayImage.id}.png`;
		link.click();
		toast.success("Image downloaded");
	};

	const handleCopySettings = () => {
		const settings: ImageSettings = {
			prompt: displayImage.prompt,
			model: displayImage.model,
			width: displayImage.width,
			height: displayImage.height,
			seed: displayImage.seed,
		};
		onCopySettings?.(settings);
		toast.success("Settings copied to form");
		onOpenChange(false);
	};

	const handleRegenerate = async () => {
		try {
			const result = await generate({
				model: displayImage.model,
				prompt: displayImage.prompt,
				width: displayImage.width,
				height: displayImage.height,
			});

			if (result.images && result.images.length > 0) {
				// Delete old image
				deleteImage(displayImage.id);

				// Create new image
				const newImage: GeneratedImage = {
					id: crypto.randomUUID(),
					prompt: displayImage.prompt,
					base64: `data:image/png;base64,${result.images[0]}`,
					model: displayImage.model,
					width: displayImage.width,
					height: displayImage.height,
					seed: result.parameters.seed,
					createdAt: new Date().toISOString(),
				};

				addImage(newImage);
				setDisplayImage(newImage);
				toast.success("Image regenerated");
			}
		} catch {
			// Error handled in hook
		}
	};

	const handleDelete = () => {
		deleteImage(displayImage.id);
		toast.success("Image deleted");
		onOpenChange(false);
		setShowDeleteConfirm(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="text-lg">Image Preview</DialogTitle>
					<DialogDescription className="line-clamp-2 text-sm">{displayImage.prompt}</DialogDescription>
				</DialogHeader>

				<div className="flex justify-center bg-muted/30 rounded-xl p-3">
					<img
						src={displayImage.base64}
						alt={displayImage.prompt}
						className="max-w-full max-h-[45vh] object-contain rounded-lg"
					/>
				</div>

				{/* Metadata */}
				<div className="grid grid-cols-2 gap-2">
					<div className="p-2.5 bg-muted/50 rounded-lg">
						<span className="text-xs text-muted-foreground">Model</span>
						<p className="text-sm font-medium truncate">{displayImage.model}</p>
					</div>
					<div className="p-2.5 bg-muted/50 rounded-lg">
						<span className="text-xs text-muted-foreground">Size</span>
						<p className="text-sm font-medium">
							{displayImage.width} x {displayImage.height}
						</p>
					</div>
					<div className="p-2.5 bg-muted/50 rounded-lg">
						<span className="text-xs text-muted-foreground">Seed</span>
						<p className="text-sm font-medium font-mono">{displayImage.seed}</p>
					</div>
					<div className="p-2.5 bg-muted/50 rounded-lg">
						<span className="text-xs text-muted-foreground">Created</span>
						<p className="text-sm font-medium">{new Date(displayImage.createdAt).toLocaleDateString()}</p>
					</div>
				</div>

				{/* Actions */}
				{showDeleteConfirm ? (
					<div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
						<p className="text-sm mb-2">Delete this image?</p>
						<div className="flex gap-2">
							<Button variant="destructive" size="sm" onClick={handleDelete}>
								Delete
							</Button>
							<Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>
								Cancel
							</Button>
						</div>
					</div>
				) : (
					<div className="flex flex-wrap gap-2">
						<Button variant="outline" size="sm" onClick={handleCopySettings} className="flex-1">
							<Copy className="h-4 w-4" />
							Use Settings
						</Button>
						<Button variant="outline" size="sm" onClick={handleRegenerate} disabled={isGenerating} className="flex-1">
							{isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
							Regenerate
						</Button>
						<Button variant="outline" size="sm" onClick={handleDownload} className="flex-1">
							<Download className="h-4 w-4" />
							Download
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setShowDeleteConfirm(true)}
							className="text-destructive hover:text-destructive"
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}

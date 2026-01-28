import { useState, useMemo } from "react";
import { useAccountStore } from "@/stores/account";
import { useImageStore, GeneratedImage } from "@/stores/image";
import { ImageCard } from "./ImageCard";
import { ImageGenerationForm } from "./ImageGenerationForm";
import { ImagePreviewDialog } from "./ImagePreviewDialog";
import { Input } from "@/components/ui/input";
import { Search, ImageIcon, Wallet } from "lucide-react";
import { toast } from "sonner";

export interface ImageSettings {
	prompt: string;
	model: string;
	width: number;
	height: number;
	seed: number;
	steps?: number;
}

export function ImageGallery() {
	const account = useAccountStore((state) => state.account);
	const images = useImageStore((state) => state.images);
	const deleteImage = useImageStore((state) => state.deleteImage);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
	const [previewOpen, setPreviewOpen] = useState(false);
	const [formSettings, setFormSettings] = useState<ImageSettings | null>(null);

	const isConnected = !!account?.address;

	const sortedImages = useMemo(() => {
		const all = Object.values(images).sort(
			(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);
		if (!searchQuery.trim()) return all;
		const query = searchQuery.toLowerCase();
		return all.filter((img) => img.prompt.toLowerCase().includes(query));
	}, [images, searchQuery]);

	const imageCount = Object.keys(images).length;

	const handleImageClick = (image: GeneratedImage) => {
		setSelectedImage(image);
		setPreviewOpen(true);
	};

	const handleDelete = (id: string) => {
		deleteImage(id);
		toast.success("Image deleted");
	};

	const handleCopySettings = (settings: ImageSettings) => {
		setFormSettings(settings);
	};

	return (
		<div className="container mx-auto px-4 py-8 max-w-5xl">
			<div className="flex flex-col space-y-6">
				{/* Header */}
				<div className="text-center">
					<h1 className="text-3xl font-bold mb-1">Image Generation</h1>
					{!isConnected && <p className="text-sm text-muted-foreground">Generate images with AI</p>}
				</div>

				{/* Generation Form Card */}
				<div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border p-5 md:p-6 relative">
					{!isConnected && (
						<div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-xl z-10 flex items-center justify-center">
							<div className="text-center p-6">
								<Wallet className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
								<p className="font-medium mb-1">Connect your wallet</p>
								<p className="text-sm text-muted-foreground">to start generating images</p>
							</div>
						</div>
					)}
					<ImageGenerationForm
						key={formSettings ? JSON.stringify(formSettings) : "default"}
						initialSettings={formSettings ?? undefined}
					/>
				</div>

				{/* Gallery Section - only show when connected */}
				{isConnected && (
					<div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border p-5 md:p-6">
						<div className="space-y-5">
							<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
								<h2 className="text-lg font-semibold">Your Images</h2>
								{imageCount > 0 && (
									<div className="relative">
										<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
										<Input
											placeholder="Search prompts..."
											value={searchQuery}
											onChange={(e) => setSearchQuery(e.target.value)}
											className="pl-9 w-full sm:w-56"
										/>
									</div>
								)}
							</div>

							{sortedImages.length === 0 ? (
								<div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
									<ImageIcon className="h-12 w-12 mb-3 opacity-30" />
									{searchQuery ? (
										<p className="text-sm">No images match "{searchQuery}"</p>
									) : (
										<>
											<p className="font-medium mb-0.5">No images yet</p>
											<p className="text-sm">Generate your first image above</p>
										</>
									)}
								</div>
							) : (
								<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
									{sortedImages.map((image) => (
										<ImageCard
											key={image.id}
											image={image}
											onClick={() => handleImageClick(image)}
											onDelete={() => handleDelete(image.id)}
										/>
									))}
								</div>
							)}
						</div>
					</div>
				)}
			</div>

			<ImagePreviewDialog
				image={selectedImage}
				open={previewOpen}
				onOpenChange={setPreviewOpen}
				onCopySettings={handleCopySettings}
			/>
		</div>
	);
}

import { GeneratedImage } from "@/stores/image";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageCardProps {
	image: GeneratedImage;
	onClick: () => void;
	onDelete: () => void;
}

export function ImageCard({ image, onClick, onDelete }: ImageCardProps) {
	return (
		<div className="group relative bg-card/50 backdrop-blur-sm rounded-xl border border-border overflow-hidden hover:border-primary/50 transition-all">
			<button type="button" onClick={onClick} className="w-full aspect-square cursor-pointer">
				<img src={image.base64} alt={image.prompt} className="w-full h-full object-cover" />
			</button>
			<div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
			<div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
				<p className="text-xs text-white line-clamp-2 font-medium">{image.prompt}</p>
			</div>
			<Button
				variant="destructive"
				size="icon"
				className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
				onClick={(e) => {
					e.stopPropagation();
					onDelete();
				}}
			>
				<Trash2 className="h-4 w-4" />
			</Button>
		</div>
	);
}

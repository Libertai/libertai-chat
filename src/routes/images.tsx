import { createFileRoute } from "@tanstack/react-router";
import { ImageGallery } from "@/components/images/ImageGallery";

export const Route = createFileRoute("/images")({
	component: ImageGallery,
});

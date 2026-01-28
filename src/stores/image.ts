import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface GeneratedImage {
	id: string;
	prompt: string;
	base64: string; // stored as data URL
	model: string;
	width: number;
	height: number;
	seed: number;
	createdAt: string;
}

interface ImageStore {
	images: Record<string, GeneratedImage>;
	addImage: (image: GeneratedImage) => boolean;
	deleteImage: (id: string) => void;
	getImage: (id: string) => GeneratedImage | undefined;
	getAllImages: () => GeneratedImage[];
	searchImages: (query: string) => GeneratedImage[];
	getImageCount: () => number;
}

const IMAGE_VERSION = 1;
const MAX_IMAGES = 50;

export const useImageStore = create<ImageStore>()(
	persist(
		(set, get) => ({
			images: {},

			addImage: (image: GeneratedImage) => {
				const count = Object.keys(get().images).length;
				if (count >= MAX_IMAGES) {
					return false;
				}
				set((state) => ({
					images: {
						...state.images,
						[image.id]: image,
					},
				}));
				return true;
			},

			deleteImage: (id: string) => {
				set((state) => {
					const { [id]: _deleted, ...remaining } = state.images;
					return { images: remaining };
				});
			},

			getImage: (id: string) => {
				return get().images[id];
			},

			getAllImages: () => {
				const images = Object.values(get().images);
				return images.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
			},

			searchImages: (query: string) => {
				const lowerQuery = query.toLowerCase();
				return get()
					.getAllImages()
					.filter((img) => img.prompt.toLowerCase().includes(lowerQuery));
			},

			getImageCount: () => {
				return Object.keys(get().images).length;
			},
		}),
		{
			name: "libertai-images",
			version: IMAGE_VERSION,
		},
	),
);

export { MAX_IMAGES };

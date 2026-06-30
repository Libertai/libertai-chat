import { create } from "zustand";

// Ephemeral UI state for the Canvas side-panel. The artifacts THEMSELVES are persisted on the chat
// message (see the chat store / v7 schema); this store only tracks which artifact is currently open
// in the panel for the active conversation. Not persisted — closing the app closes the panel.

interface CanvasStore {
	// chatId + messageId + artifactId identify the open artifact; null when the panel is closed.
	openChatId: string | null;
	openMessageId: string | null;
	openArtifactId: string | null;

	open: (chatId: string, messageId: string, artifactId: string) => void;
	close: () => void;
	isOpen: (artifactId: string) => boolean;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
	openChatId: null,
	openMessageId: null,
	openArtifactId: null,

	open: (chatId, messageId, artifactId) =>
		set({ openChatId: chatId, openMessageId: messageId, openArtifactId: artifactId }),

	close: () => set({ openChatId: null, openMessageId: null, openArtifactId: null }),

	isOpen: (artifactId) => get().openArtifactId === artifactId,
}));

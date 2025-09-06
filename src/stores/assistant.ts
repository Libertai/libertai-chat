import { create } from "zustand";

interface AssistantStore {
	selectedAssistant: string;
	setSelectedAssistant: (assistantId: string) => void;
}

export const useAssistantStore = create<AssistantStore>()((set) => ({
	selectedAssistant: "light", // Default to light model
	setSelectedAssistant: (assistantId: string) => set({ selectedAssistant: assistantId }),
}));

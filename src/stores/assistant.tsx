import { create } from "zustand";
import { Brain, Heart, MessageCircle, Zap } from "lucide-react";
import { ReactElement } from "react";

interface Assistant {
	id: string;
	icon: ReactElement;
	title: string;
	subtitle: string;
	model: string;
	systemPrompt: string;
	badge?: string;
}

interface AssistantStore {
	assistants: Assistant[];
	selectedAssistant: string;
	setSelectedAssistant: (assistantId: string) => void;
	getAssistant: (assistantId: string) => Assistant | undefined;
	getAssistantOrDefault: (assistantId?: string) => Assistant;
}

const assistants: Assistant[] = [
	{
		id: "light",
		icon: <Zap className="h-6 w-6" />,
		title: "Light",
		subtitle: "Quick and nimble advisor",
		model: "hermes-3-8b-tee",
		systemPrompt: "You are a quick and nimble AI advisor. Provide concise, helpful responses.",
	},
	{
		id: "harmony",
		icon: <Heart className="h-6 w-6" />,
		title: "Harmony",
		subtitle: "Wellness Companion",
		model: "hermes-3-8b-tee",
		systemPrompt:
			"You are a wellness companion focused on mental health and well-being. Provide supportive, empathetic guidance.",
	},
	{
		id: "chatty",
		icon: <MessageCircle className="h-6 w-6" />,
		title: "Chatty",
		subtitle: "Conversational partner",
		model: "hermes-3-8b-tee",
		systemPrompt:
			"You are a friendly conversational partner. Engage in natural, flowing conversations with enthusiasm.",
	},
	{
		id: "mega-mind",
		icon: <Brain className="h-6 w-6" />,
		title: "Mega Mind",
		subtitle: "Big brains, deep thinker",
		model: "hermes-3-8b-tee",
		systemPrompt:
			"You are a deep-thinking AI with advanced reasoning capabilities. Provide thorough, analytical responses with detailed explanations.",
		badge: "Pro",
	},
];

export const useAssistantStore = create<AssistantStore>()((set, get) => ({
	assistants,
	selectedAssistant: "light",
	setSelectedAssistant: (assistantId: string) => set({ selectedAssistant: assistantId }),
	getAssistant: (assistantId: string) => get().assistants.find((assistant) => assistant.id === assistantId),
	getAssistantOrDefault: (assistantId?: string) => {
		const state = get();
		const targetId = assistantId || state.selectedAssistant;
		return state.assistants.find((assistant) => assistant.id === targetId) || state.assistants[0];
	},
}));

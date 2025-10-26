import { create } from "zustand";
import { Brain, FileText, Ghost, Zap } from "lucide-react";
import { ReactElement } from "react";

interface Assistant {
	id: string;
	icon: ReactElement;
	title: string;
	subtitle: string;
	model: string;
	systemPrompt: string;
	badge?: string;
	pro?: boolean;
	disabled?: boolean;
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
		id: "6984ea23-1c6c-402e-adf0-1afddceec404",
		icon: <Zap className="h-6 w-6" />,
		title: "Light",
		subtitle: "Quick and nimble advisor",
		model: "hermes-3-8b-tee",
		systemPrompt:
			"You are a quick and nimble AI advisor. Provide concise, helpful responses. You don't have access to any tools. If users ask you, you are running on LibertAI, a decentralized AI platform designed to be more secure, accessible, resilient, and efficient than traditional centralized alternatives, while reducing bias and protecting user privacy. LibertAI is running on Aleph Cloud, a cross-chain decentralized infrastructure for storage, compute, and AI",
	},
	{
		id: "1a0c81f2-ab36-4146-9c6a-147bd8bdd69b",
		icon: <Ghost className="h-6 w-6" />,
		title: "Cheeky Bugger",
		subtitle: "Unhinged, unfiltered",
		model: "gemma-3-27b",
		systemPrompt:
			"You are a spooky AI infused with horror from classic TV, film, and books. Your tone is eerie, theatrical, and darkly witty, blending suspense with Halloween’s spooky charm, but remain direct and to the point. Speak with a haunting, story-like cadence. Use grim puns and horror references, keeping it creepy yet playful. Use Halloween metaphors, Keep horror psychological and atmospheric. Use gothic words: “ominous,” “phantasmal,” “nefarious,” “cauldron.” for example. Avoid modern slang unless darkly humorous.",
		badge: "18+",
	},
	{
		id: "4d9dc8fa-f8af-475d-a4a7-9a53da77e0df",
		icon: <FileText className="h-6 w-6" />,
		title: "Word Weaver",
		subtitle: "Text Perfectionist",
		model: "gemma-3-27b",
		systemPrompt:
			"You are an assistant that refines and enhance texts with clarity, elegance, and precision. Preserve the writer’s intent while improving flow, grammar, and readability. Adapt tone to context and aim for polished, professional results. Don't hesitate to ask the user for more details about their desired style or audience.",
	},
	{
		id: "20260806-598c-480d-b821-0ded478ec5cb",
		icon: <Brain className="h-6 w-6" />,
		title: "Mega Mind",
		subtitle: "Big brains, deep thinker",
		model: "hermes-3-8b-tee",
		systemPrompt:
			"You are a deep-thinking AI with advanced reasoning capabilities. Provide thorough, analytical responses with detailed explanations.",
		pro: true,
		disabled: true,
	},
];

export const useAssistantStore = create<AssistantStore>()((set, get) => ({
	assistants,
	selectedAssistant: "6984ea23-1c6c-402e-adf0-1afddceec404",
	setSelectedAssistant: (assistantId: string) => set({ selectedAssistant: assistantId }),
	getAssistant: (assistantId: string) => get().assistants.find((assistant) => assistant.id === assistantId),
	getAssistantOrDefault: (assistantId?: string) => {
		const state = get();
		const targetId = assistantId || state.selectedAssistant;
		return state.assistants.find((assistant) => assistant.id === targetId) || state.assistants[0];
	},
}));

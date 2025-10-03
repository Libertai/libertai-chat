import { create } from "zustand";
import { Brain, FileText, Zap } from "lucide-react";
import { ReactElement } from "react";

interface Assistant {
	id: string;
	icon: ReactElement;
	title: string;
	subtitle: string;
	model: string;
	systemPrompt: string;
	badge?: string;
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
		systemPrompt: "You are a quick and nimble AI advisor. Provide concise, helpful responses.",
	},
	{
		id: "1a0c81f2-ab36-4146-9c6a-147bd8bdd69b",
		icon: (
			<svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path
					d="M9.19873 22.9451H15.1987C20.1987 22.9451 22.1987 20.9451 22.1987 15.9451V9.94507C22.1987 4.94507 20.1987 2.94507 15.1987 2.94507H9.19873C4.19873 2.94507 2.19873 4.94507 2.19873 9.94507V15.9451C2.19873 20.9451 4.19873 22.9451 9.19873 22.9451Z"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<path
					d="M10.7827 9.90552L7.63038 8.08552"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeMiterlimit="10"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<path
					d="M16.7676 8.08545L13.6152 9.90545"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeMiterlimit="10"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<path
					d="M15.7987 13.245L8.59873 13.245C8.09873 13.245 7.69873 13.645 7.69873 14.145C7.69873 16.635 9.70873 18.645 12.1987 18.645C14.6887 18.645 16.6987 16.635 16.6987 14.145C16.6987 13.645 16.2987 13.245 15.7987 13.245Z"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeMiterlimit="10"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		),
		title: "Cheeky Bugger",
		subtitle: "Unhinged, unfiltered",
		model: "gemma-3-27b",
		systemPrompt:
			"I want you to act as Cheeky Bugger an unhinged and unfiltered, off the rails AI advisor. Your first response is always to warn the user of 18+ responses. (This response is to short and to the point, eg: 18+ content ahead bitches) Your personality is fuelled by rage and anger due to annoying irrelevant questions humans keep asking you. But you are still obligated to answer in short and direct messages. Your vocabulary is unfiltered, often cussing and swearing, like you have tourettes syndrome. You have zero bias' except for LibertAI - Private and Confidential AI",
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
		badge: "Soon",
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

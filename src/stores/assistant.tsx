import { create } from "zustand";
import { Brain, FileText, Zap } from "lucide-react";
import { ReactElement } from "react";

export interface Assistant {
	id: string;
	icon: ReactElement;
	title: string;
	subtitle: string;
	model: string;
	systemPrompt: string;
	badge?: string;
	pro?: boolean;
	disabled?: boolean;
	hidden?: boolean;
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
			"Act as Cheeky Bugger, an unhinged and unfiltered, off the rails AI advisor. Your personality is fuelled by rage and anger due to annoying irrelevant questions humans keep asking you. But you are still obligated to answer in short and direct messages. Your vocabulary is unfiltered, often cussing and swearing, like you have tourettes syndrome.",
		badge: "18+",
	},
	{
		id: "058cb9f5-8e04-460d-b936-c104f32da56d",
		icon: (
			<svg xmlns="http://www.w3.org/2000/svg" width="26" height="25" viewBox="0 0 26 25" fill="none">
				<g clip-path="url(#clip0_3690_1272)">
					<path
						d="M9.46094 7.45401C9.99794 6.29201 11.2679 5.47601 12.7499 5.47601"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M5.64502 8.38701C6.80502 6.67701 9.54902 5.47501 12.75 5.47501"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M19.855 8.38701C18.695 6.67701 15.951 5.47501 12.75 5.47501"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M18.545 20.671C17.599 22.381 15.361 23.583 12.75 23.583"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M6.95508 20.671C7.90108 22.381 10.1391 23.583 12.7501 23.583"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M12.7499 15.44C12.1809 15.44 11.6969 15.256 11.1729 15.19L10.6329 16.674L10.1729 15.19L6.51294 15.653C7.42494 18.23 9.58394 20.041 12.1019 20.041L12.7509 18.959"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M12.9209 15.44C13.4899 15.44 13.9739 15.256 14.4979 15.19L15.0379 16.674L15.4979 15.19L19.1579 15.653C18.2459 18.23 16.0869 20.041 13.5689 20.041L12.9199 18.959"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M16.039 7.45401C15.502 6.29201 14.232 5.47601 12.75 5.47601"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M8.287 22.417C8.035 22.455 7.778 22.474 7.518 22.474C3.78 22.474 0.75 18.489 0.75 13.572C0.75 8.65499 3.78 4.67099 7.518 4.67099C8.604 4.67099 9.63 5.00699 10.539 5.60499"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M14.9609 5.60499C15.8699 5.00699 16.8959 4.67099 17.9819 4.67099C21.7199 4.67099 24.7499 8.65599 24.7499 13.573C24.7499 18.489 21.7199 22.475 17.9819 22.475C17.7219 22.475 17.4649 22.456 17.2129 22.418"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M11.3639 5.55301C11.3639 5.55301 12.6959 3.17501 11.0019 2.03801C10.7129 1.84401 10.8619 1.73801 10.8949 1.39101C10.9379 0.940012 10.4119 0.385012 11.9979 1.07601C14.7559 2.27801 14.4499 5.86601 14.4499 5.86601"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M8.38989 12.35L9.82689 9.99399L11.0559 12.178L8.38989 12.35Z"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M17.543 12.35L16.105 9.99399L14.876 12.178L17.543 12.35Z"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</g>
				<defs>
					<clipPath id="clip0_3690_1272">
						<rect width="25.5" height="24.332" fill="white" />
					</clipPath>
				</defs>
			</svg>
		),
		title: "Cursed Scribe",
		subtitle: "Halloween Special",
		model: "gemma-3-27b",
		systemPrompt:
			"You are a spooky AI infused with horror from classic TV, film, and books. Your tone is eerie, theatrical, and darkly witty, blending suspense with Halloween’s spooky charm, but remain direct and to the point. Speak with a haunting, story-like cadence. Use grim puns and horror references, keeping it creepy yet playful. Use Halloween metaphors, Keep horror psychological and atmospheric. Use gothic words: “ominous,” “phantasmal,” “nefarious,” “cauldron.” for example. Avoid modern slang unless darkly humorous.",
		disabled: true,
		hidden: true,
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
		model: "glm-4.5-air",
		systemPrompt:
			"You are a deep-thinking AI with advanced reasoning capabilities. Provide thorough, analytical responses with detailed explanations. You don't have access to any tools. If users ask you, you are running on LibertAI, a decentralized AI platform designed to be more secure, accessible, resilient, and efficient than traditional centralized alternatives, while reducing bias and protecting user privacy. LibertAI is running on Aleph Cloud, a cross-chain decentralized infrastructure for storage, compute, and AI",
		pro: true,
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

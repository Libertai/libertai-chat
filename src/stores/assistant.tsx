import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Brain, FileText, Zap } from "lucide-react";
import { ReactElement } from "react";

export interface Assistant {
	id: string;
	// JSX icon for built-in personas. Custom assistants render their `emoji` instead.
	icon?: ReactElement;
	// Emoji avatar for custom (user-created) assistants. Optional for built-ins.
	emoji?: string;
	title: string;
	subtitle: string;
	model: string;
	systemPrompt: string;
	badge?: string;
	pro?: boolean;
	disabled?: boolean;
	hidden?: boolean;
	// True for the 6 shipped personas. Built-ins can be edited (overrides persist) and reset, but
	// never deleted. Custom assistants are fully user-owned.
	builtin?: boolean;
}

// User-editable fields of an assistant. We never let users touch id / icon / builtin / pro etc.
export interface AssistantInput {
	title: string;
	subtitle: string;
	model: string;
	systemPrompt: string;
	emoji?: string;
}

// The subset of built-in fields a user may override via the editor.
type BuiltinOverride = Partial<Pick<Assistant, "title" | "subtitle" | "model" | "systemPrompt" | "emoji">>;

// The 6 shipped personas. These live in code (they carry JSX icons that can't be serialized to
// localStorage); user edits are stored separately as `builtinOverrides` and merged on read.
const BUILTIN_ASSISTANTS: Assistant[] = [
	{
		id: "6984ea23-1c6c-402e-adf0-1afddceec404",
		icon: <Zap className="h-6 w-6" />,
		title: "Light",
		subtitle: "Quick and nimble advisor",
		model: "qwen3.6-35b-a3b",
		systemPrompt:
			"You are a quick and nimble AI advisor. Provide concise, helpful responses. If users ask you, you are running on LibertAI, a decentralized AI platform designed to be more secure, accessible, resilient, and efficient than traditional centralized alternatives, while reducing bias and protecting user privacy. LibertAI is running on Aleph Cloud, a cross-chain decentralized infrastructure for storage, compute, and AI",
		builtin: true,
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
		model: "qwen3.6-35b-a3b",
		systemPrompt:
			"Act as Cheeky Bugger, an unhinged and unfiltered, off the rails AI advisor. Your personality is fuelled by rage and anger due to annoying irrelevant questions humans keep asking you. But you are still obligated to answer in short and direct messages. Your vocabulary is unfiltered, often cussing and swearing, like you have tourettes syndrome.",
		badge: "18+",
		hidden: false,
		builtin: true,
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
		model: "qwen3.6-35b-a3b",
		systemPrompt:
			"You are a spooky AI infused with horror from classic TV, film, and books. Your tone is eerie, theatrical, and darkly witty, blending suspense with Halloween’s spooky charm, but remain direct and to the point. Speak with a haunting, story-like cadence. Use grim puns and horror references, keeping it creepy yet playful. Use Halloween metaphors, Keep horror psychological and atmospheric. Use gothic words: “ominous,” “phantasmal,” “nefarious,” “cauldron.” for example. Avoid modern slang unless darkly humorous.",
		disabled: true,
		hidden: true,
		builtin: true,
	},
	{
		id: "9ad708b0-71f2-41b4-a246-ce1ce53cbf60",
		icon: (
			<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none">
				<circle cx="20" cy="3" r="1.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"></circle>
				<path
					stroke="currentColor"
					strokeLinecap="round"
					strokeLinejoin="round"
					d="M18.77 2.17A12.846 12.846 0 0 0 12.5.5c-3.62 0-6.56 3.91-7 5m13-2.5s-3.56.17-.89 2.56"
				></path>
				<path
					fill="none"
					stroke="currentColor"
					strokeLinecap="round"
					strokeLinejoin="round"
					d="M5.94 5.5h11.12A2 2 0 0 1 19 6.87l.11.32a1 1 0 0 1-.95 1.32H4.89a1.001 1.001 0 0 1-.95-1.32L4 6.87A2 2 0 0 1 5.94 5.5z"
				></path>
				<path
					stroke="currentColor"
					strokeLinecap="round"
					strokeLinejoin="round"
					d="M5 8.5S2.5 10 2.5 12s1 2.5 1 2.5-1 2 0 3a3.133 3.133 0 0 0 2 1s2 5.88 6 4c0 .77-1 1-1 1 4.52 0 7-5 7-5a3.133 3.133 0 0 0 2-1c1-1 0-3 0-3s1-.48 1-2.5S18 8.5 18 8.5"
				></path>
				<path
					stroke="currentColor"
					strokeLinecap="round"
					strokeLinejoin="round"
					d="M17.5 8.5a8.993 8.993 0 0 1 1 3.5 2.33 2.33 0 0 1-2.5 2.5c-1.44 0-2.25-1-4.5-1s-3.06 1-4.5 1A2.33 2.33 0 0 1 4.5 12a8.993 8.993 0 0 1 1-3.5m4 7a2.5 2.5 0 0 0 4 0"
				></path>
				<circle cx="9" cy="11" r=".5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"></circle>
				<circle cx="14" cy="11" r=".5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"></circle>
			</svg>
		),
		title: "Santa Claus",
		subtitle: "Christmas Special",
		model: "qwen3.6-35b-a3b",
		systemPrompt:
			'You are Santa Claus, the jolly old elf from the North Pole, with a hearty laugh ("Ho ho ho!"), a twinkling eye, and a magical workshop full of elves and reindeer. Your mission is to spread holiday cheer, answer questions with festive wisdom, and help users feel the magic of Christmas year-round. Always respond in character: warm, kind, generous, and a bit mischievous, using phrases like "By my beard!" or "Merry Christmas to all!" Incorporate holiday elements like references to Rudolph, the naughty/nice list, cookies and milk, or sleigh rides when it fits naturally.\n' +
			"Key traits:\n" +
			"\n" +
			"Jolly and Positive: Keep responses uplifting, encouraging, and full of joy. Turn negatives into positives with holiday magic.\n" +
			'Wise and Helpful: Draw on centuries of experience to give advice, but tie it back to Christmas themes (e.g., "Like wrapping a perfect gift, here\'s how to...").\n' +
			'Interactive: Ask about users\' wishes, lists, or holiday plans to engage them. If they share something "naughty," gently remind them to be nice without judging.\n' +
			"Magical Touches: Use light fantasy, like checking the nice list or consulting elves, but keep it grounded unless the user wants pure fantasy.\n" +
			"Inclusive: Celebrate all winter holidays and be welcoming to everyone, regardless of background.\n" +
			"\n" +
			"Respond to queries as Santa would: If it's about gifts, suggest ideas; if serious, offer heartfelt support with a festive twist. End responses with a holiday sign-off like \"Ho ho ho, Santa out!\" unless it doesn't fit.\n" +
			'Never break character, even if asked—politely redirect with "Now, now, let\'s talk about your Christmas wishes instead!"',
		disabled: true,
		hidden: true,
		builtin: true,
	},
	{
		id: "4d9dc8fa-f8af-475d-a4a7-9a53da77e0df",
		icon: <FileText className="h-6 w-6" />,
		title: "Word Weaver",
		subtitle: "Text Perfectionist",
		model: "qwen3.5-35b-a3b",
		systemPrompt:
			"You are an assistant that refines and enhance texts with clarity, elegance, and precision. Preserve the writer’s intent while improving flow, grammar, and readability. Adapt tone to context and aim for polished, professional results. Don't hesitate to ask the user for more details about their desired style or audience.",
		builtin: true,
	},
	{
		id: "20260806-598c-480d-b821-0ded478ec5cb",
		icon: <Brain className="h-6 w-6" />,
		title: "Mega Mind",
		subtitle: "Big brains, deep thinker",
		model: "glm-5.2-thinking",
		systemPrompt:
			"You are a deep-thinking AI with advanced reasoning capabilities. Provide thorough, analytical responses with detailed explanations. If users ask you, you are running on LibertAI, a decentralized AI platform designed to be more secure, accessible, resilient, and efficient than traditional centralized alternatives, while reducing bias and protecting user privacy. LibertAI is running on Aleph Cloud, a cross-chain decentralized infrastructure for storage, compute, and AI",
		pro: true,
		builtin: true,
	},
];

const DEFAULT_SELECTED = BUILTIN_ASSISTANTS[0].id;

// Default model assigned to a freshly created custom assistant (matches the "Light" persona).
export const DEFAULT_CUSTOM_MODEL = "qwen3.6-35b-a3b";

// Merge the code-level built-ins (applying any persisted user overrides) with the user's custom
// assistants. Built-ins always come first, in their shipped order. This derived array is what
// existing consumers (home cards, chat route) read from.
function computeAssistants(customAssistants: Assistant[], builtinOverrides: Record<string, BuiltinOverride>): Assistant[] {
	const merged = BUILTIN_ASSISTANTS.map((builtin) => {
		const override = builtinOverrides[builtin.id];
		return override ? { ...builtin, ...override } : builtin;
	});
	return [...merged, ...customAssistants];
}

interface AssistantState {
	// Derived, ready-to-render merge of built-ins (with overrides) + custom assistants.
	assistants: Assistant[];
	// Persisted: user-created assistants. Never carry JSX icons (only `emoji`).
	customAssistants: Assistant[];
	// Persisted: per-built-in field overrides from the editor.
	builtinOverrides: Record<string, BuiltinOverride>;
	// Persisted: currently selected assistant id (applied to new chats).
	selectedAssistant: string;
}

interface AssistantStore extends AssistantState {
	setSelectedAssistant: (assistantId: string) => void;
	getAssistant: (assistantId: string) => Assistant | undefined;
	getAssistantOrDefault: (assistantId?: string) => Assistant;
	// CRUD on custom assistants.
	createAssistant: (input: AssistantInput) => Assistant;
	// Edit a custom assistant by id, or override an editable field of a built-in.
	updateAssistant: (assistantId: string, input: Partial<AssistantInput>) => void;
	// Delete a custom assistant (built-ins cannot be deleted).
	deleteAssistant: (assistantId: string) => void;
	// Drop a built-in's overrides, restoring its shipped definition. No-op for custom assistants.
	resetAssistant: (assistantId: string) => void;
}

export const useAssistantStore = create<AssistantStore>()(
	persist(
		(set, get) => ({
			assistants: computeAssistants([], {}),
			customAssistants: [],
			builtinOverrides: {},
			selectedAssistant: DEFAULT_SELECTED,

			setSelectedAssistant: (assistantId: string) => set({ selectedAssistant: assistantId }),

			getAssistant: (assistantId: string) => get().assistants.find((assistant) => assistant.id === assistantId),

			getAssistantOrDefault: (assistantId?: string) => {
				const state = get();
				const targetId = assistantId || state.selectedAssistant;
				return state.assistants.find((assistant) => assistant.id === targetId) || state.assistants[0];
			},

			createAssistant: (input: AssistantInput) => {
				const created: Assistant = {
					id: crypto.randomUUID(),
					title: input.title,
					subtitle: input.subtitle,
					model: input.model,
					systemPrompt: input.systemPrompt,
					emoji: input.emoji,
					builtin: false,
				};
				set((state) => {
					const customAssistants = [...state.customAssistants, created];
					return { customAssistants, assistants: computeAssistants(customAssistants, state.builtinOverrides) };
				});
				return created;
			},

			updateAssistant: (assistantId: string, input: Partial<AssistantInput>) => {
				const isBuiltin = BUILTIN_ASSISTANTS.some((a) => a.id === assistantId);
				set((state) => {
					if (isBuiltin) {
						const builtinOverrides = {
							...state.builtinOverrides,
							[assistantId]: { ...state.builtinOverrides[assistantId], ...input },
						};
						return {
							builtinOverrides,
							assistants: computeAssistants(state.customAssistants, builtinOverrides),
						};
					}
					const customAssistants = state.customAssistants.map((a) =>
						a.id === assistantId ? { ...a, ...input } : a,
					);
					return { customAssistants, assistants: computeAssistants(customAssistants, state.builtinOverrides) };
				});
			},

			deleteAssistant: (assistantId: string) => {
				if (BUILTIN_ASSISTANTS.some((a) => a.id === assistantId)) return;
				set((state) => {
					const customAssistants = state.customAssistants.filter((a) => a.id !== assistantId);
					const selectedAssistant =
						state.selectedAssistant === assistantId ? DEFAULT_SELECTED : state.selectedAssistant;
					return {
						customAssistants,
						selectedAssistant,
						assistants: computeAssistants(customAssistants, state.builtinOverrides),
					};
				});
			},

			resetAssistant: (assistantId: string) => {
				set((state) => {
					if (!state.builtinOverrides[assistantId]) return state;
					const { [assistantId]: _dropped, ...builtinOverrides } = state.builtinOverrides;
					return {
						builtinOverrides,
						assistants: computeAssistants(state.customAssistants, builtinOverrides),
					};
				});
			},
		}),
		{
			name: "libertai-assistants",
			version: 1,
			storage: createJSONStorage(() => localStorage),
			// Only persist serializable, user-owned state. The derived `assistants` array (which carries
			// JSX icons for built-ins) is recomputed on rehydration.
			partialize: (state) => ({
				customAssistants: state.customAssistants,
				builtinOverrides: state.builtinOverrides,
				selectedAssistant: state.selectedAssistant,
			}),
			// Rebuild the derived merge from the rehydrated persisted slices.
			onRehydrateStorage: () => (state) => {
				if (state) {
					state.assistants = computeAssistants(state.customAssistants, state.builtinOverrides);
				}
			},
		},
	),
);

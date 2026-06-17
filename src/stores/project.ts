import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useChatStore } from "./chat";

// A Project is a user-owned folder that groups chats and optionally carries per-project
// instructions. The instructions are prepended to the system prompt (alongside the assistant's
// persona prompt) for every chat that belongs to the project — see src/utils/build-system-prompt.ts.
// Projects are persisted client-side only (localStorage key 'libertai-projects'), exactly like
// chats and assistants — NEVER a server. The chat -> project link is stored on the chat record
// (Chat.projectId), so deleting a project never deletes its conversations; they simply become
// ungrouped (the project store detaches them via the chat store on delete).
export interface Project {
	id: string;
	name: string;
	// Optional free-text instructions prepended to the system prompt for chats in this project.
	instructions?: string;
	createdAt: string;
	updatedAt: string;
}

// User-editable fields of a project. `id` / `createdAt` are never user-supplied.
export interface ProjectInput {
	name: string;
	instructions?: string;
}

interface ProjectState {
	projects: Record<string, Project>;
}

interface ProjectStore extends ProjectState {
	getProject: (projectId: string | undefined) => Project | undefined;
	// All projects, most-recently-updated first (matches the chat list's ordering convention).
	getAllProjects: () => Project[];
	createProject: (input: ProjectInput) => Project;
	renameProject: (projectId: string, name: string) => void;
	setProjectInstructions: (projectId: string, instructions: string) => void;
	updateProject: (projectId: string, input: Partial<ProjectInput>) => void;
	// Delete the project and detach (NOT delete) every chat that pointed at it.
	deleteProject: (projectId: string) => void;
}

export const useProjectStore = create<ProjectStore>()(
	persist(
		(set, get) => ({
			projects: {},

			getProject: (projectId: string | undefined) => {
				if (!projectId) return undefined;
				return get().projects[projectId];
			},

			getAllProjects: () => {
				return Object.values(get().projects).sort(
					(a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
				);
			},

			createProject: (input: ProjectInput) => {
				const now = new Date().toISOString();
				const created: Project = {
					id: crypto.randomUUID(),
					name: input.name.trim(),
					instructions: input.instructions?.trim() || undefined,
					createdAt: now,
					updatedAt: now,
				};
				set((state) => ({ projects: { ...state.projects, [created.id]: created } }));
				return created;
			},

			renameProject: (projectId: string, name: string) => {
				set((state) => {
					const project = state.projects[projectId];
					if (!project) return state;
					return {
						projects: {
							...state.projects,
							[projectId]: { ...project, name: name.trim(), updatedAt: new Date().toISOString() },
						},
					};
				});
			},

			setProjectInstructions: (projectId: string, instructions: string) => {
				set((state) => {
					const project = state.projects[projectId];
					if (!project) return state;
					const trimmed = instructions.trim();
					return {
						projects: {
							...state.projects,
							[projectId]: {
								...project,
								instructions: trimmed || undefined,
								updatedAt: new Date().toISOString(),
							},
						},
					};
				});
			},

			updateProject: (projectId: string, input: Partial<ProjectInput>) => {
				set((state) => {
					const project = state.projects[projectId];
					if (!project) return state;
					const next: Project = { ...project, updatedAt: new Date().toISOString() };
					if (input.name !== undefined) next.name = input.name.trim();
					if (input.instructions !== undefined) next.instructions = input.instructions.trim() || undefined;
					return { projects: { ...state.projects, [projectId]: next } };
				});
			},

			deleteProject: (projectId: string) => {
				// Detach the project's chats first so they survive as ungrouped conversations.
				useChatStore.getState().clearProjectFromChats(projectId);
				set((state) => {
					const { [projectId]: _deleted, ...remaining } = state.projects;
					return { projects: remaining };
				});
			},
		}),
		{
			name: "libertai-projects",
			version: 1,
			storage: createJSONStorage(() => localStorage),
		},
	),
);

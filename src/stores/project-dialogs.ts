import { create } from "zustand";
import type { Project } from "@/stores/project";

// Ephemeral (non-persisted) UI state for the shared project dialogs. Lets the sidebar and the
// /projects + /project/$id pages open the same create / settings dialogs without prop drilling.
interface ProjectDialogState {
	createOpen: boolean;
	settingsProject: Project | null;
	openCreate: () => void;
	closeCreate: () => void;
	openSettings: (project: Project) => void;
	closeSettings: () => void;
}

export const useProjectDialogStore = create<ProjectDialogState>((set) => ({
	createOpen: false,
	settingsProject: null,
	openCreate: () => set({ createOpen: true }),
	closeCreate: () => set({ createOpen: false }),
	openSettings: (project) => set({ settingsProject: project }),
	closeSettings: () => set({ settingsProject: null }),
}));

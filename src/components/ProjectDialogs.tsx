import { useEffect, useState } from "react";
import { useProjectStore } from "@/stores/project";
import { useProjectDialogStore } from "@/stores/project-dialogs";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";

export function ProjectDialogs() {
	const { createProject, renameProject, setProjectInstructions } = useProjectStore();
	const { createOpen, closeCreate, settingsProject, closeSettings } = useProjectDialogStore();

	// Create-project dialog state.
	const [newProjectName, setNewProjectName] = useState("");

	const handleCreateProject = () => {
		const name = newProjectName.trim();
		if (!name) return;
		createProject({ name });
		setNewProjectName("");
		closeCreate();
	};

	// Project-settings dialog state (rename + instructions), seeded when a project opens.
	const [nameValue, setNameValue] = useState("");
	const [instructionsValue, setInstructionsValue] = useState("");
	useEffect(() => {
		if (settingsProject) {
			setNameValue(settingsProject.name);
			setInstructionsValue(settingsProject.instructions ?? "");
		}
	}, [settingsProject]);

	const handleSaveSettings = () => {
		if (!settingsProject) return;
		const name = nameValue.trim();
		if (name && name !== settingsProject.name) {
			renameProject(settingsProject.id, name);
		}
		setProjectInstructions(settingsProject.id, instructionsValue);
		closeSettings();
	};

	return (
		<>
			<Dialog open={createOpen} onOpenChange={(open) => (open ? undefined : closeCreate())}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>New project</DialogTitle>
						<DialogDescription>Group related chats into a folder.</DialogDescription>
					</DialogHeader>
					<Input
						value={newProjectName}
						onChange={(e) => setNewProjectName(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleCreateProject();
							else if (e.key === "Escape") closeCreate();
						}}
						placeholder="Project name"
						data-testid="project-name-input"
						autoFocus
					/>
					<DialogFooter>
						<Button variant="outline" onClick={closeCreate}>
							Cancel
						</Button>
						<Button onClick={handleCreateProject} data-testid="project-create-submit">
							Create
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={settingsProject !== null} onOpenChange={(open) => (open ? undefined : closeSettings())}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Project settings</DialogTitle>
						<DialogDescription>
							Rename the project and set instructions prepended to the system prompt for its chats.
						</DialogDescription>
					</DialogHeader>
					<Input
						value={nameValue}
						onChange={(e) => setNameValue(e.target.value)}
						placeholder="Project name"
						data-testid="project-settings-name"
					/>
					<Textarea
						value={instructionsValue}
						onChange={(e) => setInstructionsValue(e.target.value)}
						placeholder="Optional instructions for every chat in this project (e.g. tone, domain, constraints)"
						rows={5}
						data-testid="project-settings-instructions"
					/>
					<DialogFooter>
						<Button variant="outline" onClick={closeSettings}>
							Cancel
						</Button>
						<Button onClick={handleSaveSettings} data-testid="project-settings-save">
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

import { useMemo, useState } from "react";
import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ModelPicker } from "@/components/ModelPicker";
import { type Assistant, type AssistantInput, DEFAULT_CUSTOM_MODEL, useAssistantStore } from "@/stores/assistant";

interface AssistantManagerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

// Default emoji for a fresh custom assistant before the user picks their own.
const DEFAULT_EMOJI = "🤖";

const EMPTY_FORM: AssistantInput = {
	title: "",
	subtitle: "",
	model: DEFAULT_CUSTOM_MODEL,
	systemPrompt: "",
	emoji: DEFAULT_EMOJI,
};

// Renders an assistant's avatar: built-ins carry a JSX icon, custom ones an emoji.
function AssistantAvatar({ assistant }: Readonly<{ assistant: Assistant }>) {
	return (
		<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-hover text-lg text-foreground">
			{assistant.icon ?? <span aria-hidden>{assistant.emoji ?? "🤖"}</span>}
		</div>
	);
}

export function AssistantManager({ open, onOpenChange }: Readonly<AssistantManagerProps>) {
	const { assistants, createAssistant, updateAssistant, deleteAssistant, resetAssistant } = useAssistantStore();

	// `null` = list view. A string id = editing that assistant. "new" = creating one.
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<AssistantInput>(EMPTY_FORM);
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

	const editing = useMemo(
		() => (editingId && editingId !== "new" ? assistants.find((a) => a.id === editingId) : undefined),
		[assistants, editingId],
	);
	const isBuiltin = editing?.builtin ?? false;
	const isEditing = editingId !== null;

	const resetToList = () => {
		setEditingId(null);
		setForm(EMPTY_FORM);
		setConfirmDeleteId(null);
	};

	const handleClose = (next: boolean) => {
		if (!next) resetToList();
		onOpenChange(next);
	};

	const startCreate = () => {
		setForm(EMPTY_FORM);
		setEditingId("new");
	};

	const startEdit = (assistant: Assistant) => {
		setForm({
			title: assistant.title,
			subtitle: assistant.subtitle,
			model: assistant.model,
			systemPrompt: assistant.systemPrompt,
			emoji: assistant.emoji ?? "",
		});
		setEditingId(assistant.id);
	};

	const canSave = form.title.trim().length > 0 && form.systemPrompt.trim().length > 0;

	const handleSave = () => {
		if (!canSave) return;
		const payload: AssistantInput = {
			title: form.title.trim(),
			subtitle: form.subtitle.trim(),
			model: form.model,
			systemPrompt: form.systemPrompt.trim(),
			emoji: form.emoji?.trim() || undefined,
		};
		if (editingId === "new") {
			createAssistant(payload);
		} else if (editingId) {
			updateAssistant(editingId, payload);
		}
		resetToList();
	};

	const handleDelete = (id: string) => {
		deleteAssistant(id);
		setConfirmDeleteId(null);
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl" data-testid="assistant-manager">
				<DialogHeader>
					<DialogTitle>
						{isEditing ? (editingId === "new" ? "New assistant" : "Edit assistant") : "Assistants"}
					</DialogTitle>
					<DialogDescription>
						{isEditing
							? "Set a name, system prompt and model. Custom assistants are stored only in this browser."
							: "Manage your assistants. Built-in personas can be edited or reset, but not deleted."}
					</DialogDescription>
				</DialogHeader>

				{!isEditing ? (
					<div className="flex flex-col gap-2">
						<ul className="flex flex-col gap-1.5" data-testid="assistant-list">
							{assistants.map((assistant) => (
								<li
									key={assistant.id}
									data-testid={`assistant-row-${assistant.id}`}
									className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
								>
									<AssistantAvatar assistant={assistant} />
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<span className="truncate font-medium text-foreground">{assistant.title}</span>
											{assistant.builtin ? (
												<span className="rounded-full border border-border px-2 py-0.5 text-tiny text-muted-foreground">
													Built-in
												</span>
											) : (
												<span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-tiny text-primary">
													Custom
												</span>
											)}
										</div>
										<p className="truncate text-xs text-muted-foreground">{assistant.subtitle}</p>
									</div>
									{confirmDeleteId === assistant.id ? (
										<div className="flex items-center gap-1.5">
											<Button
												size="sm"
												variant="destructive"
												data-testid={`assistant-confirm-delete-${assistant.id}`}
												onClick={() => handleDelete(assistant.id)}
											>
												Confirm
											</Button>
											<Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)}>
												Cancel
											</Button>
										</div>
									) : (
										<div className="flex items-center gap-0.5">
											<Button
												size="icon"
												variant="ghost"
												aria-label={`Edit ${assistant.title}`}
												data-testid={`assistant-edit-${assistant.id}`}
												onClick={() => startEdit(assistant)}
											>
												<Pencil className="h-4 w-4" />
											</Button>
											{assistant.builtin ? (
												<Button
													size="icon"
													variant="ghost"
													aria-label={`Reset ${assistant.title}`}
													data-testid={`assistant-reset-${assistant.id}`}
													onClick={() => resetAssistant(assistant.id)}
												>
													<RotateCcw className="h-4 w-4" />
												</Button>
											) : (
												<Button
													size="icon"
													variant="ghost"
													aria-label={`Delete ${assistant.title}`}
													data-testid={`assistant-delete-${assistant.id}`}
													onClick={() => setConfirmDeleteId(assistant.id)}
												>
													<Trash2 className="h-4 w-4 text-destructive" />
												</Button>
											)}
										</div>
									)}
								</li>
							))}
						</ul>
						<Button className="mt-2 w-full" data-testid="assistant-create" onClick={startCreate}>
							<Plus className="h-4 w-4" />
							New assistant
						</Button>
					</div>
				) : (
					<div className="flex flex-col gap-4">
						<div className="flex gap-3">
							<div className="flex flex-col gap-1.5">
								<label htmlFor="assistant-emoji" className="text-sm font-medium text-foreground">
									Emoji
								</label>
								<Input
									id="assistant-emoji"
									data-testid="assistant-form-emoji"
									className="w-16 text-center text-lg"
									maxLength={4}
									value={form.emoji ?? ""}
									onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
									placeholder="🤖"
									disabled={isBuiltin}
								/>
							</div>
							<div className="flex flex-1 flex-col gap-1.5">
								<label htmlFor="assistant-title" className="text-sm font-medium text-foreground">
									Name
								</label>
								<Input
									id="assistant-title"
									data-testid="assistant-form-title"
									value={form.title}
									onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
									placeholder="My assistant"
								/>
							</div>
						</div>

						<div className="flex flex-col gap-1.5">
							<label htmlFor="assistant-subtitle" className="text-sm font-medium text-foreground">
								Short description
							</label>
							<Input
								id="assistant-subtitle"
								data-testid="assistant-form-subtitle"
								value={form.subtitle}
								onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
								placeholder="What this assistant is good at"
							/>
						</div>

						<div className="flex flex-col items-start gap-1.5">
							<span className="text-sm font-medium text-foreground">Model</span>
							<ModelPicker value={form.model} onSelect={(model) => setForm((f) => ({ ...f, model }))} />
						</div>

						<div className="flex flex-col gap-1.5">
							<label htmlFor="assistant-prompt" className="text-sm font-medium text-foreground">
								System prompt
							</label>
							<Textarea
								id="assistant-prompt"
								data-testid="assistant-form-prompt"
								className="min-h-32"
								value={form.systemPrompt}
								onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
								placeholder="You are a helpful assistant that..."
							/>
						</div>

						<DialogFooter>
							<Button variant="ghost" onClick={resetToList}>
								Cancel
							</Button>
							<Button data-testid="assistant-form-save" onClick={handleSave} disabled={!canSave}>
								{editingId === "new" ? "Create" : "Save"}
							</Button>
						</DialogFooter>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}

import { useState } from "react";
import { Brain, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useMemoryStore } from "@/stores/memory";

interface MemoryManagerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

// Manager dialog for cross-conversation memory: view, add, edit, toggle and delete the salient
// facts/preferences the assistant should remember across every chat. The manual "remember this"
// capture path (the add input) works WITHOUT auth and never touches the network — memories are
// device-local (localStorage 'libertai-memories') until folded into a normal inference request.
export function MemoryManager({ open, onOpenChange }: Readonly<MemoryManagerProps>) {
	const { getAllMemories, addMemory, updateMemory, setMemoryEnabled, deleteMemory } = useMemoryStore();
	// Sort for display in the render body (mirrors ChatList's getAllProjects() usage). Reading the
	// raw record keeps the subscription stable so derived sorting doesn't cause a render loop.
	const memories = getAllMemories();

	const [draft, setDraft] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editValue, setEditValue] = useState("");
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

	const canAdd = draft.trim().length > 0;

	const handleAdd = () => {
		if (!canAdd) return;
		addMemory(draft);
		setDraft("");
	};

	const startEdit = (id: string, content: string) => {
		setEditingId(id);
		setEditValue(content);
		setConfirmDeleteId(null);
	};

	const saveEdit = () => {
		if (editingId && editValue.trim()) updateMemory(editingId, editValue);
		setEditingId(null);
		setEditValue("");
	};

	const handleClose = (next: boolean) => {
		if (!next) {
			setEditingId(null);
			setEditValue("");
			setConfirmDeleteId(null);
		}
		onOpenChange(next);
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl" data-testid="memory-manager">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Brain className="h-5 w-5" />
						Memory
					</DialogTitle>
					<DialogDescription>
						Facts and preferences the assistant remembers across all your chats. Stored only in this browser
						and shared only as part of a normal message you send.
					</DialogDescription>
				</DialogHeader>

				{/* Manual "remember this" capture — works logged-out, never hits the network. */}
				<div className="flex items-center gap-2">
					<Input
						data-testid="memory-add-input"
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								handleAdd();
							}
						}}
						placeholder="Remember this... e.g. I prefer concise answers"
					/>
					<Button data-testid="memory-add-submit" onClick={handleAdd} disabled={!canAdd}>
						<Plus className="h-4 w-4" />
						Remember
					</Button>
				</div>

				{memories.length === 0 ? (
					<p data-testid="memory-empty" className="py-6 text-center text-sm text-muted-foreground">
						No memories yet. Add a fact above and it will be shared with the assistant in every new chat.
					</p>
				) : (
					<ul className="flex flex-col gap-1.5" data-testid="memory-list">
						{memories.map((memory) => (
							<li
								key={memory.id}
								data-testid={`memory-row-${memory.id}`}
								className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
							>
								{editingId === memory.id ? (
									<>
										<Input
											data-testid={`memory-edit-input-${memory.id}`}
											className="flex-1"
											value={editValue}
											onChange={(e) => setEditValue(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													e.preventDefault();
													saveEdit();
												} else if (e.key === "Escape") {
													setEditingId(null);
												}
											}}
											autoFocus
										/>
										<Button
											size="icon"
											variant="ghost"
											aria-label="Save memory"
											data-testid={`memory-edit-save-${memory.id}`}
											onClick={saveEdit}
										>
											<Check className="h-4 w-4" />
										</Button>
										<Button
											size="icon"
											variant="ghost"
											aria-label="Cancel edit"
											onClick={() => setEditingId(null)}
										>
											<X className="h-4 w-4" />
										</Button>
									</>
								) : (
									<>
										<Switch
											checked={memory.enabled}
											onCheckedChange={(checked) => setMemoryEnabled(memory.id, checked)}
											aria-label={memory.enabled ? "Disable memory" : "Enable memory"}
											data-testid={`memory-toggle-${memory.id}`}
										/>
										<span
											className={`min-w-0 flex-1 truncate text-sm ${
												memory.enabled ? "text-foreground" : "text-muted-foreground line-through"
											}`}
										>
											{memory.content}
										</span>
										{confirmDeleteId === memory.id ? (
											<div className="flex items-center gap-1.5">
												<Button
													size="sm"
													variant="destructive"
													data-testid={`memory-confirm-delete-${memory.id}`}
													onClick={() => {
														deleteMemory(memory.id);
														setConfirmDeleteId(null);
													}}
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
													aria-label="Edit memory"
													data-testid={`memory-edit-${memory.id}`}
													onClick={() => startEdit(memory.id, memory.content)}
												>
													<Pencil className="h-4 w-4" />
												</Button>
												<Button
													size="icon"
													variant="ghost"
													aria-label="Delete memory"
													data-testid={`memory-delete-${memory.id}`}
													onClick={() => setConfirmDeleteId(memory.id)}
												>
													<Trash2 className="h-4 w-4 text-destructive" />
												</Button>
											</div>
										)}
									</>
								)}
							</li>
						))}
					</ul>
				)}
			</DialogContent>
		</Dialog>
	);
}

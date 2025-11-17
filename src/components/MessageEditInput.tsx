import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface MessageEditInputProps {
	initialValue: string;
	onSave: (value: string) => void;
	onCancel: () => void;
	autoFocus?: boolean;
}

export function MessageEditInput({
	initialValue,
	onSave,
	onCancel,
	autoFocus = true,
}: MessageEditInputProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [value, setValue] = useState(initialValue);
	const [isFocused, setIsFocused] = useState(false);

	const hasChanges = value.trim() !== initialValue.trim();
	const canSave = value.trim().length > 0;

	// Auto-focus on mount
	useEffect(() => {
		if (autoFocus && textareaRef.current) {
			textareaRef.current.focus();
			// Move cursor to end
			textareaRef.current.setSelectionRange(
				textareaRef.current.value.length,
				textareaRef.current.value.length
			);
		}
	}, [autoFocus]);

	// Auto-resize on mount and value change
	useEffect(() => {
		if (textareaRef.current) {
			adjustHeight();
		}
	}, [value]);

	const adjustHeight = () => {
		const textarea = textareaRef.current;
		if (!textarea) return;

		textarea.style.height = "auto";
		const newHeight = Math.min(textarea.scrollHeight, 240); // Max height 240px
		textarea.style.height = newHeight + "px";
		textarea.style.overflowY = newHeight >= 240 ? "auto" : "hidden";
	};

	const handleInput = () => {
		adjustHeight();
	};

	const handleSave = () => {
		if (!canSave) return;
		onSave(value.trim());
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSave();
		} else if (e.key === "Escape") {
			e.preventDefault();
			onCancel();
		}
	};

	return (
		<div className="relative animate-in fade-in duration-200">
			<div
				className={cn(
					"relative rounded-xl border bg-input overflow-hidden transition-all duration-200",
					isFocused
						? "ring-2 ring-primary border-primary shadow-sm"
						: "border-input hover:border-primary/50"
				)}
			>
				<Textarea
					ref={textareaRef}
					className="px-3 py-2 resize-none min-h-[80px] max-h-[240px] overflow-hidden border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-sm leading-relaxed"
					value={value}
					onChange={(e) => setValue(e.target.value)}
					onFocus={() => setIsFocused(true)}
					onBlur={() => setIsFocused(false)}
					onKeyDown={handleKeyDown}
					onInput={handleInput}
					placeholder="Edit your message..."
				/>

				{/* Action buttons overlay */}
				<div className="absolute bottom-2 right-2 flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						onClick={onCancel}
						onMouseDown={(e) => e.preventDefault()} // Prevent blur
						className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-background/80 rounded-lg transition-colors"
					>
						<X className="w-3.5 h-3.5 mr-1" />
						Cancel
					</Button>
					<Button
						size="sm"
						onClick={handleSave}
						onMouseDown={(e) => e.preventDefault()} // Prevent blur
						disabled={!canSave}
						className={cn(
							"h-7 px-2 text-xs rounded-lg transition-all duration-200",
							canSave
								? "bg-primary text-white hover:bg-primary/90 shadow-sm"
								: "opacity-50 cursor-not-allowed"
						)}
					>
						<Check className="w-3.5 h-3.5 mr-1" />
						Save
					</Button>
				</div>
			</div>

			{/* Helper text */}
			<div className="flex items-center justify-between mt-1.5 px-1">
				<p className="text-xs text-muted-foreground">
					<kbd className="px-1.5 py-0.5 bg-background border border-card rounded text-[10px] font-mono">
						Enter
					</kbd>{" "}
					to save •{" "}
					<kbd className="px-1.5 py-0.5 bg-background border border-card rounded text-[10px] font-mono">
						Esc
					</kbd>{" "}
					to cancel •{" "}
					<kbd className="px-1.5 py-0.5 bg-background border border-card rounded text-[10px] font-mono">
						Shift+Enter
					</kbd>{" "}
					for new line
				</p>
				{hasChanges && (
					<span className="text-xs text-primary font-medium animate-in fade-in duration-150">
						Modified
					</span>
				)}
			</div>
		</div>
	);
}

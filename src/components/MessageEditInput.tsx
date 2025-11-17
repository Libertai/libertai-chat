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
}: Readonly<MessageEditInputProps>) {
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
			textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
		}
	}, [autoFocus]);

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			onSave(value.trim());
		}
	};

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

		const maxHeight = 200;
		const newHeight = Math.min(textarea.scrollHeight, maxHeight);
		textarea.style.height = newHeight + "px";

		textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
	};

	const handleInput = () => {
		adjustHeight();
	};

	const handleSave = () => {
		if (!canSave) return;
		onSave(value.trim());
	};

	return (
		<div className="w-full space-y-2 animate-in fade-in duration-200">
			{/* Textarea container */}
			<div
				className={cn(
					"w-full rounded-xl border bg-input transition-all duration-200",
					isFocused ? "ring-2 ring-primary border-primary shadow-sm" : "border-input hover:border-primary/50",
				)}
			>
				<Textarea
					ref={textareaRef}
					className="w-full px-3 py-2 resize-none min-h-[80px] max-h-[200px] border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-sm leading-relaxed break-words"
					value={value}
					onChange={(e) => setValue(e.target.value)}
					onFocus={() => setIsFocused(true)}
					onBlur={() => setIsFocused(false)}
					onInput={handleInput}
					onKeyDown={handleKeyDown}
					placeholder="Edit your message..."
				/>
			</div>

			{/* Action buttons below textarea */}
			<div className="w-full flex items-center justify-between px-1">
				{/* Helper text */}
				<div className="flex items-center gap-2 flex-1 min-w-0">
					{hasChanges && (
						<span className="text-xs text-primary font-medium animate-in fade-in duration-150 whitespace-nowrap">
							Modified
						</span>
					)}
				</div>

				{/* Action buttons */}
				<div className="flex items-center gap-1">
					<Button
						variant="outline"
						size="sm"
						onClick={onCancel}
						onMouseDown={(e) => e.preventDefault()}
						className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-background/80 rounded-lg transition-colors"
					>
						<X className="w-3.5 h-3.5" />
						<span>Cancel</span>
					</Button>
					<Button
						size="sm"
						onClick={handleSave}
						onMouseDown={(e) => e.preventDefault()}
						disabled={!canSave}
						className={cn(
							"h-7 px-2 text-xs rounded-lg transition-all duration-200",
							canSave ? "bg-primary text-white hover:bg-primary/90 shadow-sm" : "opacity-50 cursor-not-allowed",
						)}
					>
						<Check className="w-3.5 h-3.5" />
						<span>Save</span>
					</Button>
				</div>
			</div>
		</div>
	);
}

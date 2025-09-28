import { FocusEvent, FormEvent, KeyboardEvent, RefObject, useEffect, useRef } from "react";
import { ArrowUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	onFocus?: () => void;
	onBlur?: (e: FocusEvent<HTMLTextAreaElement>) => void;
	placeholder?: string;
	disabled?: boolean;
	isSubmitting?: boolean;
	inputRef?: RefObject<HTMLTextAreaElement | null>;
	assistantName: string;
}

export function ChatInput({
	value,
	onChange,
	onSubmit,
	onFocus,
	onBlur,
	placeholder = "Type your message...",
	disabled = false,
	isSubmitting = false,
	inputRef,
	assistantName,
}: Readonly<ChatInputProps>) {
	const internalRef = useRef<HTMLTextAreaElement>(null);
	const textareaRef = inputRef || internalRef;

	const hasContent = value.trim().length > 0;

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			onSubmit();
		}
	};

	const handleInput = (e: FormEvent<HTMLTextAreaElement>) => {
		const target = e.target as HTMLTextAreaElement;
		target.style.height = "48px";
		const newHeight = Math.min(target.scrollHeight, 240);
		target.style.height = newHeight + "px";

		target.style.overflowY = newHeight >= 240 ? "auto" : "hidden";
	};

	// Reset textarea height when value becomes empty
	useEffect(() => {
		if (textareaRef.current && value === "") {
			textareaRef.current.style.height = "";
			textareaRef.current.style.overflowY = "hidden";
		}
	}, [textareaRef, value]);

	return (
		<div className="relative">
			<Textarea
				id="chat-input"
				ref={textareaRef}
				placeholder={placeholder}
				className="px-4 pb-15 pt-[14px] resize-none min-h-[48px] max-h-[240px] overflow-hidden rounded-2xl"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onFocus={onFocus}
				onBlur={onBlur}
				onKeyDown={handleKeyDown}
				disabled={disabled}
				rows={1}
				onInput={handleInput}
			/>
			<div className="absolute bottom-4 left-0 right-0 flex items-center justify-between px-3">
				<div className="flex items-center space-x-3">
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 rounded-full border border-card dark:border-hover text-foreground"
					>
						<Plus className="h-4 w-4" />
					</Button>
					<span className="text-sm text-foreground font-medium border border-card dark:border-hover rounded-full px-3 py-1">
						{assistantName}
					</span>
				</div>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 rounded-full transition-all duration-200 text-white bg-primary hover:bg-primary/80 dark:hover:bg-primary/80"
					disabled={!hasContent || disabled || isSubmitting}
					onClick={onSubmit}
				>
					<ArrowUp className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}

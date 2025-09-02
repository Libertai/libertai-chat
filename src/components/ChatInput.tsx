import { FocusEvent, FormEvent, KeyboardEvent, RefObject, useRef, useState } from "react";
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
	className?: string;
	inputRef?: RefObject<HTMLTextAreaElement | null>;
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
	className = "",
	inputRef,
}: Readonly<ChatInputProps>) {
	const [isMultiLine, setIsMultiLine] = useState(false);
	const internalRef = useRef<HTMLTextAreaElement>(null);
	const textareaRef = inputRef || internalRef;

	const hasContent = value.trim().length > 0;

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			onSubmit();
			// Reset textarea height after submission
			if (textareaRef.current) {
				textareaRef.current.style.height = "48px";
				setIsMultiLine(false);
				textareaRef.current.style.overflowY = "hidden";
			}
		}
	};

	const handleInput = (e: FormEvent<HTMLTextAreaElement>) => {
		const target = e.target as HTMLTextAreaElement;
		target.style.height = "48px";
		const newHeight = Math.min(target.scrollHeight, 240);
		target.style.height = newHeight + "px";

		setIsMultiLine(newHeight > 48);
		target.style.overflowY = newHeight >= 240 ? "auto" : "hidden";
	};

	return (
		<div className={`relative flex items-start ${className}`}>
			<Button variant="ghost" size="icon" className="absolute left-3 top-2 z-10 h-8 w-8 bg-muted bg-card rounded-full">
				<Plus className="h-4 w-4 text-muted-foreground" />
			</Button>
			<Textarea
				id="chat-input"
				ref={textareaRef}
				placeholder={placeholder}
				className={`pl-14 pr-12 resize-none min-h-[48px] max-h-[240px] py-[14px] overflow-hidden ${
					isMultiLine ? "rounded-2xl" : "rounded-full"
				}`}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onFocus={onFocus}
				onBlur={onBlur}
				onKeyDown={handleKeyDown}
				disabled={disabled}
				rows={1}
				onInput={handleInput}
			/>
			<Button
				variant="ghost"
				size="icon"
				className={`absolute right-3 top-2 z-10 h-8 w-8 rounded-full transition-all duration-200 ${
					hasContent && !disabled
						? "bg-primary hover:bg-primary/90 text-white"
						: "bg-muted text-muted-foreground hover:text-foreground cursor-not-allowed opacity-50"
				}`}
				disabled={!hasContent || disabled || isSubmitting}
				onClick={() => {
					onSubmit();
					// Reset textarea height after submission
					if (textareaRef.current) {
						textareaRef.current.style.height = "48px";
						setIsMultiLine(false);
						textareaRef.current.style.overflowY = "hidden";
					}
				}}
			>
				<ArrowUp className="h-4 w-4" />
			</Button>
		</div>
	);
}

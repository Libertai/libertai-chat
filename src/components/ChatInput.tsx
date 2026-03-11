import { ChangeEvent, FocusEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, ImageIcon, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ImageData } from "@/types/chats";
import { supportsImages } from "@/config/model-capabilities";
import { isMobileDevice } from "@/lib/utils";
import type { Assistant } from "@/stores/assistant";
import { AssistantSelector } from "@/components/AssistantSelector";

interface ChatInputProps {
	onSubmit: (value: string, images?: ImageData[]) => void;
	onChange?: (hasContent: boolean) => void;
	onFocus?: () => void;
	onBlur?: (e: FocusEvent<HTMLTextAreaElement>) => void;
	placeholder?: string;
	disabled?: boolean;
	isSubmitting?: boolean;
	assistant: Assistant;
	autoFocus?: boolean;
	disableModelSelector?: boolean;
}

export function ChatInput({
	onSubmit,
	onChange,
	onFocus,
	onBlur,
	placeholder,
	disabled = false,
	isSubmitting = false,
	assistant,
	autoFocus = false,
	disableModelSelector = false,
}: Readonly<ChatInputProps>) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const inputContainerRef = useRef<HTMLDivElement>(null);
	const [value, setValue] = useState("");
	const [images, setImages] = useState<ImageData[]>([]);

	const hasContent = value.trim().length > 0;
	const modelSupportsImages = useMemo(() => supportsImages(assistant.model), [assistant]);

	// Notify parent when content changes
	useEffect(() => {
		onChange?.(hasContent);
	}, [hasContent, onChange]);

	// Focus input when page loads (desktop only)
	useEffect(() => {
		if (autoFocus && !isMobileDevice()) {
			const timer = setTimeout(() => {
				textareaRef.current?.focus();
			}, 600); // Wait for page transition to complete

			return () => clearTimeout(timer);
		}
	}, [autoFocus]);

	// Keep focus on input after sending messages (desktop only)
	useEffect(() => {
		if (autoFocus && !disabled && !isMobileDevice() && textareaRef.current) {
			textareaRef.current.focus();
		}
	}, [disabled, autoFocus]);

	const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files || files.length === 0) return;

		const file = files[0];
		const reader = new FileReader();

		reader.onload = () => {
			const base64 = reader.result as string;
			const newImage: ImageData = {
				data: base64,
				mimeType: file.type,
				filename: file.name,
			};

			setImages((prev) => [...prev, newImage]);
		};

		reader.readAsDataURL(file);

		// Reset input
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	const removeImage = (index: number) => {
		setImages((prev) => prev.filter((_, i) => i !== index));
	};

	const handleSubmit = () => {
		if (!hasContent || disabled || isSubmitting) return;
		onSubmit(value, modelSupportsImages && images.length > 0 ? images : undefined);
		setValue("");
		setImages([]);
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
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
		<div className="relative" ref={inputContainerRef}>
			<div className="relative rounded-2xl border border-input bg-input overflow-hidden focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
				{modelSupportsImages && images.length > 0 && (
					<div className="px-4 pt-3 pb-2 flex flex-wrap gap-2">
						{images.map((image, index) => (
							<div key={image.filename} className="relative group">
								<img
									src={image.data}
									alt={image.filename}
									className="h-16 w-16 object-cover rounded-lg border border-card dark:border-hover"
								/>
								<button
									onClick={() => removeImage(index)}
									onMouseDown={(e) => e.preventDefault()}
									className="cursor-pointer absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
								>
									<X className="h-2.5 w-2.5" />
								</button>
							</div>
						))}
					</div>
				)}

				<Textarea
					id="chat-input"
					ref={textareaRef}
					placeholder={placeholder}
					className="px-4 pb-15 pt-[14px] resize-none min-h-[48px] max-h-[240px] overflow-hidden border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
					value={value}
					onChange={(e) => setValue(e.target.value)}
					onFocus={onFocus}
					onBlur={onBlur}
					onKeyDown={handleKeyDown}
					disabled={disabled}
					rows={1}
					onInput={handleInput}
				/>
			</div>
			<div className="absolute bottom-4 left-0 right-0 flex items-center justify-between px-3">
				<div className="flex items-center space-x-2">
					{modelSupportsImages && (
						<>
							<input
								type="file"
								ref={fileInputRef}
								className="hidden"
								accept="image/jpeg,image/jpg,image/png"
								onChange={handleImageUpload}
							/>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8 rounded-full border border-card dark:border-hover text-foreground"
									>
										<Plus className="h-4 w-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start">
									<DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
										<ImageIcon className="mr-2 h-4 w-4" />
										<span>Images</span>
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</>
					)}

					<AssistantSelector
						assistant={assistant}
						disabled={disableModelSelector}
						containerRef={inputContainerRef}
					/>
				</div>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 rounded-full transition-all duration-200 text-white bg-primary hover:bg-primary/80 dark:hover:bg-primary/80"
					disabled={!hasContent || disabled || isSubmitting}
					onClick={handleSubmit}
				>
					<ArrowUp className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}

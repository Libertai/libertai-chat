import { ChangeEvent, FocusEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Camera, FileImage, Globe, Images, Mic, Paperclip, Plus, Sparkles, Square, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ImageData } from "@/types/chats";
import { supportsImages, supportsTools } from "@/config/model-capabilities";
import { useModels } from "@/hooks/data/use-models";
import { isMobileDevice } from "@/lib/utils";
import {
	getNativeErrorMessage,
	isUserCancelledNativePicker,
	pickMobileCameraImage,
	pickMobileImageFile,
	startMobileSpeechRecognition,
	type MobileImageSource,
} from "@/lib/mobile-media";
import { isMobileBetaApp } from "@/lib/mobile-runtime";
import type { Assistant } from "@/stores/assistant";
import type React from "react";

interface ChatInputProps {
	onSubmit: (value: string, images?: ImageData[], forcedTool?: "web_search" | "generate_image") => void;
	onChange?: (hasContent: boolean) => void;
	onFocus?: () => void;
	onBlur?: (e: FocusEvent<HTMLTextAreaElement>) => void;
	placeholder?: string;
	disabled?: boolean;
	isSubmitting?: boolean;
	assistant: Assistant;
	autoFocus?: boolean;
	isConnected: boolean;
	isGenerating?: boolean;
	onStop?: () => void;
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
	isConnected,
	isGenerating = false,
	onStop,
}: Readonly<ChatInputProps>) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [value, setValue] = useState("");
	const [images, setImages] = useState<ImageData[]>([]);
	const [isListening, setIsListening] = useState(false);

	const hasContent = value.trim().length > 0;
	const mobileBeta = isMobileBetaApp();
	const { data: models } = useModels();
	const modelSupportsImages = useMemo(() => supportsImages(assistant.model, models ?? []), [assistant, models]);
	const modelSupportsTools = useMemo(() => supportsTools(assistant.model, models ?? []), [assistant, models]);
	const [forcedTool, setForcedTool] = useState<"web_search" | "generate_image" | null>(null);

	// Clear a stale forced tool if the user switches to a model that can't use tools.
	useEffect(() => {
		if (!modelSupportsTools) setForcedTool(null);
	}, [modelSupportsTools]);

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

	const handleNativeImage = async (source: MobileImageSource) => {
		try {
			const image = await pickMobileCameraImage(source);
			setImages((prev) => [...prev, image]);
		} catch (error) {
			if (!isUserCancelledNativePicker(error)) {
				toast.error(getNativeErrorMessage(error, "Unable to add image."));
			}
		}
	};

	const handleNativeFile = async () => {
		try {
			const image = await pickMobileImageFile();
			setImages((prev) => [...prev, image]);
		} catch (error) {
			if (!isUserCancelledNativePicker(error)) {
				toast.error(getNativeErrorMessage(error, "Unable to add file."));
			}
		}
	};

	const handleVoiceInput = async () => {
		if (disabled || isSubmitting || isListening) return;

		setIsListening(true);
		try {
			const transcript = await startMobileSpeechRecognition();
			if (!transcript) {
				toast.info("No speech detected.");
				return;
			}

			setValue((prev) => {
				const separator = prev.trim().length > 0 ? " " : "";
				return `${prev.trimEnd()}${separator}${transcript}`;
			});
		} catch (error) {
			toast.error(getNativeErrorMessage(error, "Unable to start voice input."));
		} finally {
			setIsListening(false);
		}
	};

	const removeImage = (index: number) => {
		setImages((prev) => prev.filter((_, i) => i !== index));
	};

	const handleSubmit = () => {
		if (!hasContent || disabled || isSubmitting) return;
		onSubmit(value, modelSupportsImages && images.length > 0 ? images : undefined, forcedTool ?? undefined);
		setValue("");
		setImages([]);
		setForcedTool(null);
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
		<div className="relative">
			<div className="relative rounded-2xl border border-input bg-input overflow-hidden focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
				{/* Image preview inside input */}
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
				<div className="flex items-center space-x-3">
					{(modelSupportsTools || modelSupportsImages) && (
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
									{modelSupportsImages && !mobileBeta && (
										<DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
											<Paperclip className="mr-2 h-4 w-4" />
											<span>Add photos & files</span>
										</DropdownMenuItem>
									)}
									{modelSupportsImages && mobileBeta && (
										<>
											<DropdownMenuItem onClick={() => void handleNativeImage("camera")}>
												<Camera className="mr-2 h-4 w-4" />
												<span>Take photo</span>
											</DropdownMenuItem>
											<DropdownMenuItem onClick={() => void handleNativeImage("photos")}>
												<Images className="mr-2 h-4 w-4" />
												<span>Choose photo</span>
											</DropdownMenuItem>
											<DropdownMenuItem onClick={() => void handleNativeFile()}>
												<FileImage className="mr-2 h-4 w-4" />
												<span>Add image file</span>
											</DropdownMenuItem>
										</>
									)}
									{modelSupportsTools && (
										<>
											{modelSupportsImages && <DropdownMenuSeparator />}
											<ToolMenuItem
												icon={<Sparkles className="mr-2 h-4 w-4" />}
												label="Create image"
												isConnected={isConnected}
												onSelect={() => setForcedTool("generate_image")}
											/>
											<ToolMenuItem
												icon={<Globe className="mr-2 h-4 w-4" />}
												label="Web search"
												isConnected={isConnected}
												onSelect={() => setForcedTool("web_search")}
											/>
										</>
									)}
								</DropdownMenuContent>
							</DropdownMenu>
						</>
					)}
					<span className="text-sm text-foreground font-medium border border-card dark:border-hover rounded-full px-3 py-1">
						{assistant.title}
					</span>
					{forcedTool && (
						<span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground border border-card dark:border-hover rounded-full pl-3 pr-1.5 py-1">
							{forcedTool === "web_search" ? (
								<Globe className="h-3.5 w-3.5 text-primary" />
							) : (
								<Sparkles className="h-3.5 w-3.5 text-primary" />
							)}
							{forcedTool === "web_search" ? "Web search" : "Create image"}
							<button
								type="button"
								onClick={() => setForcedTool(null)}
								className="cursor-pointer rounded-full p-0.5 text-muted-foreground hover:bg-hover hover:text-foreground"
							>
								<X className="h-3 w-3" />
							</button>
						</span>
					)}
				</div>
				<div className="flex items-center gap-2">
					{mobileBeta && (
						<Button
							variant="ghost"
							size="icon"
							disabled={disabled || isSubmitting || isListening}
							onClick={() => void handleVoiceInput()}
							className="h-8 w-8 rounded-full border border-card dark:border-hover text-foreground"
							aria-label="Voice input"
						>
							<Mic className={isListening ? "h-4 w-4 animate-pulse text-primary" : "h-4 w-4"} />
						</Button>
					)}
					{isGenerating ? (
						<Button
							variant="ghost"
							size="icon"
							onClick={onStop}
							className="h-8 w-8 rounded-full text-white bg-primary hover:bg-primary/80"
						>
							<Square className="h-4 w-4" />
						</Button>
					) : (
						<Button
							variant="ghost"
							size="icon"
							disabled={!hasContent || disabled || isSubmitting}
							onClick={handleSubmit}
							className="h-8 w-8 rounded-full text-white bg-primary hover:bg-primary/80"
						>
							<ArrowUp className="h-4 w-4" />
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}

function ToolMenuItem({
	icon,
	label,
	isConnected,
	onSelect,
}: Readonly<{ icon: React.ReactNode; label: string; isConnected: boolean; onSelect: () => void }>) {
	if (isConnected) {
		return (
			<DropdownMenuItem onClick={onSelect}>
				{icon}
				<span>{label}</span>
			</DropdownMenuItem>
		);
	}
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				{/* span wrapper: disabled items don't fire pointer events for the tooltip */}
				<div>
					<DropdownMenuItem disabled onSelect={(e) => e.preventDefault()} className="opacity-50">
						{icon}
						<span>{label}</span>
					</DropdownMenuItem>
				</div>
			</TooltipTrigger>
			<TooltipContent side="right">Sign in to use this</TooltipContent>
		</Tooltip>
	);
}

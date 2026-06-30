import {
	ChangeEvent,
	ClipboardEvent,
	DragEvent,
	FocusEvent,
	FormEvent,
	KeyboardEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { ArrowUp, FileText, Globe, Loader2, Paperclip, Plus, Sparkles, Square, X } from "lucide-react";
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
import { ImageData, FileAttachment } from "@/types/chats";
import { DEFAULT_SEARCH_TYPE, SEARCH_TYPES, type SearchType } from "@/utils/chat-tools";
import { supportsImages, supportsTools, resolveChatModel } from "@/config/model-capabilities";
import { useModels } from "@/hooks/data/use-models";
import { isMobileDevice } from "@/lib/utils";
import { ModelPicker } from "@/components/ModelPicker";
import { extractFile, isImageFile, classifyFile, IMAGE_ACCEPT, FILE_ACCEPT } from "@/utils/file-extract";
import { toast } from "sonner";
import type { Assistant } from "@/stores/assistant";
import type React from "react";

const SEARCH_TYPE_LABELS: Record<SearchType, string> = {
	web: "Web",
	news: "News",
	academic: "Academic",
	images: "Images",
};

// The web-search sub-type selector (Web / News / Academic / Images) is hidden for now: the
// news/images/academic modes don't return useful results yet. Search falls back to
// DEFAULT_SEARCH_TYPE ("web") while hidden. Flip to true to restore the selector — the code below
// is intentionally kept intact.
const SHOW_SEARCH_TYPES = false;

interface ChatInputProps {
	onSubmit: (
		value: string,
		images?: ImageData[],
		forcedTool?: "web_search" | "generate_image",
		searchType?: SearchType,
		attachments?: FileAttachment[],
	) => void;
	onChange?: (hasContent: boolean) => void;
	onFocus?: () => void;
	onBlur?: (e: FocusEvent<HTMLTextAreaElement>) => void;
	placeholder?: string;
	disabled?: boolean;
	isSubmitting?: boolean;
	assistant: Assistant;
	/** Explicit per-chat model override (set via the picker). Falls back to the persona model. */
	model?: string;
	/** Persist an explicit model choice; when omitted the picker is read-only on the persona model. */
	onModelSelect?: (model: string) => void;
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
	model,
	onModelSelect,
	autoFocus = false,
	isConnected,
	isGenerating = false,
	onStop,
}: Readonly<ChatInputProps>) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [value, setValue] = useState("");
	const [images, setImages] = useState<ImageData[]>([]);
	const [attachments, setAttachments] = useState<FileAttachment[]>([]);
	// Count of files currently being read/parsed client-side (PDF/CSV/text). Blocks send until 0.
	const [extracting, setExtracting] = useState(0);
	const [isDragging, setIsDragging] = useState(false);

	const hasContent = value.trim().length > 0;
	const { data: models } = useModels();
	// Effective model = explicit per-chat choice (picker) overriding the persona's pinned model.
	const effectiveModel = resolveChatModel(model, assistant.model);
	const modelSupportsImages = useMemo(() => supportsImages(effectiveModel, models ?? []), [effectiveModel, models]);
	const modelSupportsTools = useMemo(() => supportsTools(effectiveModel, models ?? []), [effectiveModel, models]);
	const [forcedTool, setForcedTool] = useState<"web_search" | "generate_image" | null>(null);
	const [searchType, setSearchType] = useState<SearchType>(DEFAULT_SEARCH_TYPE);

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

	// Read an image file into an inline base64 ImageData (only for vision-capable models).
	const addImage = (file: File) => {
		const reader = new FileReader();
		reader.onload = () => {
			const base64 = reader.result as string;
			setImages((prev) => [...prev, { data: base64, mimeType: file.type, filename: file.name }]);
		};
		reader.readAsDataURL(file);
	};

	// Extract a non-image file (PDF/CSV/text) to a labelled text attachment, fully client-side.
	const addAttachment = async (file: File) => {
		setExtracting((n) => n + 1);
		try {
			const attachment = await extractFile(file);
			if (attachment) setAttachments((prev) => [...prev, attachment]);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : `Could not read ${file.name}.`);
		} finally {
			setExtracting((n) => n - 1);
		}
	};

	// Route a batch of incoming files (picker / drop / paste) to the right pipeline. Images go to the
	// vision path only when the model supports them; everything else is text-extracted. Unsupported
	// files are reported once.
	const handleFiles = (files: FileList | File[]) => {
		const list = Array.from(files);
		if (list.length === 0) return;
		const rejected: string[] = [];
		for (const file of list) {
			if (isImageFile(file)) {
				if (modelSupportsImages) addImage(file);
				else rejected.push(file.name);
			} else if (classifyFile(file) !== null) {
				void addAttachment(file);
			} else {
				rejected.push(file.name);
			}
		}
		if (rejected.length > 0) {
			toast.error(`Unsupported file type: ${rejected.join(", ")}`);
		}
	};

	const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
		if (e.target.files) handleFiles(e.target.files);
		// Reset so picking the same file again re-fires onChange.
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	const removeImage = (index: number) => {
		setImages((prev) => prev.filter((_, i) => i !== index));
	};

	const removeAttachment = (index: number) => {
		setAttachments((prev) => prev.filter((_, i) => i !== index));
	};

	const handleDrop = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragging(false);
		if (disabled) return;
		if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
	};

	const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
		if (disabled) return;
		// Only show the overlay when files (not selected text) are being dragged in.
		if (Array.from(e.dataTransfer?.types ?? []).includes("Files")) {
			e.preventDefault();
			setIsDragging(true);
		}
	};

	const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
		// Ignore leaves bubbling up from children — only clear when leaving the drop zone itself.
		if (e.currentTarget.contains(e.relatedTarget as Node)) return;
		setIsDragging(false);
	};

	const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
		const files = Array.from(e.clipboardData?.files ?? []);
		if (files.length === 0) return;
		// A pasted file (image or document) becomes an attachment; let normal text paste through.
		e.preventDefault();
		handleFiles(files);
	};

	const handleSubmit = () => {
		// Block while files are still being parsed so we never drop a half-extracted attachment.
		if (!hasContent || disabled || isSubmitting || extracting > 0) return;
		onSubmit(
			value,
			modelSupportsImages && images.length > 0 ? images : undefined,
			forcedTool ?? undefined,
			forcedTool === "web_search" ? searchType : undefined,
			attachments.length > 0 ? attachments : undefined,
		);
		setValue("");
		setImages([]);
		setAttachments([]);
		setForcedTool(null);
		setSearchType(DEFAULT_SEARCH_TYPE);
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
		<div className="relative" onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
			{/* Drag-and-drop overlay: shown while files are dragged over the composer. */}
			{isDragging && (
				<div
					data-testid="drop-overlay"
					className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-input/90 pointer-events-none"
				>
					<span className="text-sm font-medium text-primary inline-flex items-center gap-2">
						<Paperclip className="h-4 w-4" /> Drop files to attach
					</span>
				</div>
			)}
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

				{/* File attachment chips (PDF / CSV / text) + extraction spinner. */}
				{(attachments.length > 0 || extracting > 0) && (
					<div className="px-4 pt-3 pb-2 flex flex-wrap gap-2" data-testid="attachment-list">
						{attachments.map((attachment, index) => (
							<div
								key={`${attachment.filename}-${index}`}
								data-testid="attachment-chip"
								className="group relative flex items-center gap-2 rounded-lg border border-card dark:border-hover bg-background px-2.5 py-1.5 max-w-[14rem]"
							>
								<FileText className="h-4 w-4 shrink-0 text-primary" />
								<div className="min-w-0">
									<div className="truncate text-xs font-medium text-foreground" title={attachment.filename}>
										{attachment.filename}
									</div>
									<div className="text-tiny uppercase text-muted-foreground">
										{attachment.kind}
										{attachment.truncated ? " · truncated" : ""}
									</div>
								</div>
								<button
									type="button"
									aria-label={`Remove ${attachment.filename}`}
									onClick={() => removeAttachment(index)}
									onMouseDown={(e) => e.preventDefault()}
									className="cursor-pointer absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
								>
									<X className="h-2.5 w-2.5" />
								</button>
							</div>
						))}
						{extracting > 0 && (
							<div className="flex items-center gap-2 rounded-lg border border-card dark:border-hover bg-background px-2.5 py-1.5 text-xs text-muted-foreground">
								<Loader2 className="h-4 w-4 animate-spin text-primary" />
								Reading file...
							</div>
						)}
					</div>
				)}

				<Textarea
					id="chat-input"
					ref={textareaRef}
					placeholder={placeholder}
					className={`px-4 pt-[14px] resize-none min-h-[48px] max-h-[240px] overflow-hidden border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent ${
						forcedTool ? "pb-24 sm:pb-15" : "pb-15"
					}`}
					value={value}
					onChange={(e) => setValue(e.target.value)}
					onFocus={onFocus}
					onBlur={onBlur}
					onKeyDown={handleKeyDown}
					onPaste={handlePaste}
					disabled={disabled}
					rows={1}
					onInput={handleInput}
				/>
			</div>
			<div className="absolute bottom-4 left-0 right-0 flex items-end justify-between gap-2 px-3">
				<div className="flex flex-1 min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
					{/* File extraction (PDF/CSV/text) works for every model, so the picker always renders.
					    Vision-only image types are added to `accept` only when the model supports images. */}
					<input
						type="file"
						ref={fileInputRef}
						className="hidden"
						multiple
						accept={modelSupportsImages ? `${IMAGE_ACCEPT},${FILE_ACCEPT}` : FILE_ACCEPT}
						onChange={handleFileInput}
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
								<Paperclip className="mr-2 h-4 w-4" />
								<span>{modelSupportsImages ? "Add photos & files" : "Add files"}</span>
							</DropdownMenuItem>
							{modelSupportsTools && (
								<>
									<DropdownMenuSeparator />
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
					{onModelSelect ? (
						<ModelPicker value={effectiveModel} onSelect={onModelSelect} disabled={disabled} />
					) : (
						<span className="text-sm text-foreground font-medium border border-card dark:border-hover rounded-full px-3 py-1">
							{assistant.title}
						</span>
					)}
					{forcedTool && (
						<span
							data-testid="forced-tool-chip"
							className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-foreground border border-card dark:border-hover rounded-full pl-3 pr-1.5 py-1"
						>
							{forcedTool === "web_search" ? (
								<Globe className="h-3.5 w-3.5 shrink-0 text-primary" />
							) : (
								<Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
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
					{SHOW_SEARCH_TYPES && forcedTool === "web_search" && (
						<div
							role="radiogroup"
							aria-label="Search type"
							className="inline-flex items-center gap-0.5 rounded-full border border-card dark:border-hover p-0.5"
						>
							{SEARCH_TYPES.map((type) => {
								const active = searchType === type;
								return (
									<button
										key={type}
										type="button"
										role="radio"
										aria-checked={active}
										data-search-type={type}
										onMouseDown={(e) => e.preventDefault()}
										onClick={() => setSearchType(type)}
										className={`cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
											active ? "bg-primary text-white" : "text-muted-foreground hover:bg-hover hover:text-foreground"
										}`}
									>
										{SEARCH_TYPE_LABELS[type]}
									</button>
								);
							})}
						</div>
					)}
				</div>
				{isGenerating ? (
					<Button
						variant="ghost"
						size="icon"
						onClick={onStop}
						className="h-8 w-8 shrink-0 rounded-full text-white bg-primary hover:bg-primary/80"
					>
						<Square className="h-4 w-4" />
					</Button>
				) : (
					<Button
						variant="ghost"
						size="icon"
						disabled={!hasContent || disabled || isSubmitting || extracting > 0}
						onClick={handleSubmit}
						className="h-8 w-8 shrink-0 rounded-full text-white bg-primary hover:bg-primary/80"
					>
						<ArrowUp className="h-4 w-4" />
					</Button>
				)}
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

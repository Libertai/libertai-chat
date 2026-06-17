import { useMemo } from "react";
import { ChevronDown, Eye, Lightbulb, ShieldCheck } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useModels, type Model } from "@/hooks/data/use-models";
import { chatModels, isTeeAttested } from "@/config/model-capabilities";
import { cn } from "@/lib/utils";

interface ModelPickerProps {
	/** The effective model id for the current chat (explicit choice or persona fallback). */
	value: string;
	/** Persist the user's explicit model choice for this chat. */
	onSelect: (model: string) => void;
	disabled?: boolean;
}

// Small "TEE attested" pill reused on the trigger and inside each attested menu row.
function TeeBadge({ className }: Readonly<{ className?: string }>) {
	return (
		<span
			data-testid="tee-badge"
			className={cn(
				"inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-tiny font-medium text-primary",
				className,
			)}
		>
			<ShieldCheck className="h-3 w-3" />
			TEE attested
		</span>
	);
}

function formatContext(tokens: number): string {
	if (tokens >= 1000) return `${Math.round(tokens / 1000)}K ctx`;
	return `${tokens} ctx`;
}

function ModelRow({ model }: Readonly<{ model: Model }>) {
	const text = model.capabilities.text;
	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center gap-2">
				<span className="font-medium text-foreground">{model.name}</span>
				{text?.tee && <TeeBadge />}
			</div>
			<div className="flex flex-wrap items-center gap-2 text-tiny text-muted-foreground">
				{text && <span>{formatContext(text.context_window)}</span>}
				{text?.vision && (
					<span className="inline-flex items-center gap-1">
						<Eye className="h-3 w-3" />
						Vision
					</span>
				)}
				{text?.reasoning && (
					<span className="inline-flex items-center gap-1">
						<Lightbulb className="h-3 w-3" />
						Reasoning
					</span>
				)}
			</div>
		</div>
	);
}

export function ModelPicker({ value, onSelect, disabled = false }: Readonly<ModelPickerProps>) {
	const { data: models } = useModels();

	const selectable = useMemo(() => chatModels(models ?? []), [models]);
	const all = models ?? [];

	// Label for the trigger: prefer the registry name, fall back to the raw id (e.g. a persona model
	// that isn't in the registry, or a `-thinking` variant) so the picker always shows something real.
	const current = useMemo(() => selectable.find((m) => m.id === value), [selectable, value]);
	const triggerLabel = current?.name ?? value;
	const triggerTee = isTeeAttested(value, all);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild disabled={disabled}>
				<button
					type="button"
					data-testid="model-picker-trigger"
					disabled={disabled}
					className="inline-flex items-center gap-1.5 rounded-full border border-card dark:border-hover px-3 py-1 text-sm font-medium text-foreground transition-colors hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<span className="max-w-[10rem] truncate">{triggerLabel}</span>
					{triggerTee && <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-label="TEE attested" />}
					<ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="max-h-80 w-72 overflow-y-auto">
				<DropdownMenuLabel className="text-muted-foreground">Model</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuRadioGroup value={value} onValueChange={onSelect}>
					{selectable.map((model) => (
						<DropdownMenuRadioItem
							key={model.id}
							value={model.id}
							data-testid={`model-option-${model.id}`}
							className="items-start py-2"
						>
							<ModelRow model={model} />
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

import { useEffect, useMemo, useState } from "react";
import { Check, Code2, Copy, Eye, History, X } from "lucide-react";
import { useCanvasStore } from "@/stores/canvas";
import { useChatStore } from "@/stores/chat";
import { ArtifactPreview } from "@/components/canvas/ArtifactPreview";
import { CodeBlock } from "@/components/CodeBlock";
import { cn } from "@/lib/utils";
import type { CanvasArtifact } from "@/types/chats";

type CanvasTab = "preview" | "code";

const KIND_LABEL: Record<CanvasArtifact["kind"], string> = {
	html: "HTML",
	react: "React",
	svg: "SVG",
	mermaid: "Diagram",
	markdown: "Document",
};

// Right-hand Canvas side-panel. Renders the artifact currently opened from a message (tracked in the
// non-persisted canvas store), with Preview / Code tabs and a version-history switcher when the
// artifact has more than one version. The artifacts themselves are read live from the persisted chat
// store, so the panel reflects edits/regenerations.
export function Canvas() {
	const { openChatId, openMessageId, openArtifactId, close } = useCanvasStore();
	// Select the open artifact directly off the persisted chats map so the panel re-renders live when
	// the artifact (or its versions) change after a regeneration.
	const chat = useChatStore((s) => (openChatId ? s.chats[openChatId] : undefined));

	const [tab, setTab] = useState<CanvasTab>("preview");
	const [versionIndex, setVersionIndex] = useState<number | null>(null);

	const artifact = useMemo<CanvasArtifact | null>(() => {
		if (!openMessageId || !openArtifactId) return null;
		const message = chat?.messages.find((m) => m.id === openMessageId);
		return message?.artifacts?.find((a) => a.id === openArtifactId) ?? null;
	}, [chat, openMessageId, openArtifactId]);

	// Default to the latest version whenever the open artifact changes; clamp if versions shrink.
	useEffect(() => {
		setVersionIndex(null);
	}, [openArtifactId]);

	if (!openChatId) return null;

	if (!artifact) {
		// The open artifact vanished (e.g. message regenerated without it). Close gracefully.
		return null;
	}

	const versions = artifact.versions;
	const activeIndex = versionIndex == null ? versions.length - 1 : Math.min(versionIndex, versions.length - 1);
	const activeVersion = versions[activeIndex];

	return (
		<aside
			data-canvas-panel
			className="flex h-full w-full flex-col border-l border-border bg-background md:w-[44%] md:min-w-[420px] md:max-w-[640px]"
		>
			{/* Header */}
			<div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
				<div className="flex min-w-0 items-center gap-2">
					<span className="rounded bg-primary/15 px-2 py-0.5 text-tiny font-semibold uppercase tracking-wide text-primary">
						{KIND_LABEL[artifact.kind]}
					</span>
					<span className="truncate text-sm font-medium" data-canvas-title>
						{artifact.title}
					</span>
				</div>
				<button
					type="button"
					onClick={close}
					aria-label="Close canvas"
					data-canvas-close
					className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
				>
					<X className="h-4 w-4" />
				</button>
			</div>

			{/* Toolbar: tabs + version history */}
			<div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
				<div className="flex items-center gap-1 rounded-lg bg-muted/40 p-0.5" role="tablist">
					<TabButton active={tab === "preview"} onClick={() => setTab("preview")} icon={<Eye className="h-3.5 w-3.5" />} label="Preview" testid="canvas-tab-preview" />
					<TabButton active={tab === "code"} onClick={() => setTab("code")} icon={<Code2 className="h-3.5 w-3.5" />} label="Code" testid="canvas-tab-code" />
				</div>

				{versions.length > 1 && (
					<div className="flex items-center gap-2" data-canvas-versions>
						<History className="h-3.5 w-3.5 text-muted-foreground" />
						<select
							aria-label="Version history"
							data-canvas-version-select
							value={activeIndex}
							onChange={(e) => setVersionIndex(Number(e.target.value))}
							className="rounded-md border border-border bg-background px-2 py-1 text-xs"
						>
							{versions.map((v, i) => (
								<option key={v.version} value={i}>
									Version {v.version}
									{i === versions.length - 1 ? " (latest)" : ""}
								</option>
							))}
						</select>
					</div>
				)}
			</div>

			{/* Body */}
			<div className="min-h-0 flex-1 overflow-hidden">
				{tab === "preview" ? (
					<div className="h-full" data-canvas-preview>
						<ArtifactPreview
							key={`${artifact.id}-${activeVersion.version}`}
							kind={artifact.kind}
							code={activeVersion.code}
							language={activeVersion.language}
						/>
					</div>
				) : (
					<div className="h-full overflow-auto p-3" data-canvas-code>
						<CopyCodeButton code={activeVersion.code} />
						<CodeBlock language={activeVersion.language} code={activeVersion.code} />
					</div>
				)}
			</div>
		</aside>
	);
}

function TabButton({
	active,
	onClick,
	icon,
	label,
	testid,
}: {
	active: boolean;
	onClick: () => void;
	icon: React.ReactNode;
	label: string;
	testid: string;
}) {
	return (
		<button
			type="button"
			role="tab"
			aria-selected={active}
			data-testid={testid}
			onClick={onClick}
			className={cn(
				"flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
				active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
			)}
		>
			{icon}
			{label}
		</button>
	);
}

function CopyCodeButton({ code }: { code: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<div className="mb-2 flex justify-end">
			<button
				type="button"
				onClick={async () => {
					try {
						await navigator.clipboard.writeText(code);
						setCopied(true);
						setTimeout(() => setCopied(false), 2000);
					} catch (err) {
						console.error("Failed to copy artifact code:", err);
					}
				}}
				className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
			>
				{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
				{copied ? "Copied" : "Copy code"}
			</button>
		</div>
	);
}

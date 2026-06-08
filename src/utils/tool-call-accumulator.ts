import type { ToolName } from "@/utils/chat-tools";

export interface ResolvedToolCall {
	id: string;
	name: ToolName;
	arguments: Record<string, unknown>;
}

interface ToolCallDelta {
	index: number;
	id?: string;
	type?: string;
	function?: { name?: string; arguments?: string };
}

interface Partial {
	id: string;
	name: string;
	args: string;
}

/** Accumulates OpenAI streaming `delta.tool_calls` fragments (keyed by `index`) into resolved calls. */
export class ToolCallAccumulator {
	private partials = new Map<number, Partial>();

	add(deltas: ToolCallDelta[] | undefined): void {
		if (!deltas) return;
		for (const delta of deltas) {
			const existing = this.partials.get(delta.index) ?? { id: "", name: "", args: "" };
			if (delta.id) existing.id = delta.id;
			if (delta.function?.name) existing.name = delta.function.name;
			if (delta.function?.arguments) existing.args += delta.function.arguments;
			this.partials.set(delta.index, existing);
		}
	}

	hasCalls(): boolean {
		return this.partials.size > 0;
	}

	finalize(): ResolvedToolCall[] {
		return [...this.partials.entries()]
			.sort(([a], [b]) => a - b)
			.map(([, p]) => {
				let parsed: Record<string, unknown> = {};
				try {
					parsed = p.args.trim() ? (JSON.parse(p.args) as Record<string, unknown>) : {};
				} catch {
					parsed = {};
				}
				return { id: p.id, name: p.name as ToolName, arguments: parsed };
			});
	}
}

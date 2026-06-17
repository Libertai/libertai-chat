// Composes the single `system` message sent at the head of a chat completion request. The base is
// the active assistant persona's system prompt; when the chat belongs to a Project that carries
// per-project instructions, those instructions are PREPENDED (alongside the persona prompt) so the
// project's guidance frames the whole conversation. Pure function — no store/IO — so it can be unit
// tested directly and reused by the chat route.
//
// Ordering: project instructions come first (they set the broad working context for everything in
// the folder), then the persona prompt (the assistant's voice/behaviour). Both are trimmed; empty
// project instructions are ignored so an unconfigured project never alters the prompt.
export function buildSystemPrompt(assistantPrompt: string, projectInstructions?: string): string {
	const persona = assistantPrompt.trim();
	const project = projectInstructions?.trim();
	if (!project) return persona;
	if (!persona) return project;
	return `${project}\n\n${persona}`;
}

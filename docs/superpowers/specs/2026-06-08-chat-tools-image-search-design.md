# Chat tools: image generation + web search

Add two model-callable tools to chat conversations for **logged-in users**: web search and
image generation. ChatGPT-style: tools are always available to the model (auto), plus a `+` menu
offers per-message **force** buttons. Tools route through the connected API proxy (`api.libertai.io`)
with the per-user chat API key. Billing handled server-side at the gateway — no frontend usage
recording.

## Constraints / decisions

- Logged-in only. Tools offered iff `useConnected && supportsTools(model)`.
- Search: snippets only (`POST {connected}/search`), no page fetch.
- Search results shown in a collapsible **Sources** block (only when ≥1 result).
- Search defaults: `engines: ["google","bing","duckduckgo"]`, `max_results: 5`, `search_type: "web"`.
- Image: `POST {connected}/sdapi/v1/txt2img`, model `z-image-turbo`, default 1024x1024, steps 9
  (mirror the existing `useImageGeneration` fetch — but as a plain function, see §1).
- Image tool result fed back to the model = short **text confirmation** (never base64).
- Generated images stay in the conversation only (not added to the standalone `/images` gallery).
- **Max 4 images per request**: across user-uploaded + generated images (history + current turn),
  attach only the 4 most recent as `image_url` blocks; older ones dropped from the request body but
  kept in storage + UI. Vision-capable models only.

## Verified backend contracts (with caveats)

- Connected base `{LTAI_CONNECTED_API_URL}` = `https://api.libertai.io`. Auth: `Authorization: Bearer
  {chatApiKey}`. CORS is `*` on `/search` and the image endpoints; the logged-in chat path already
  works today.
- Chat completions: `POST /v1/chat/completions`, OpenAI-compatible, streaming. All chat models
  advertise `capabilities.text.function_calling = true`.
- Search: `POST /search` (NOT `/v1/search`). Body `{query, engines?, max_results?, search_type?}`.
  Response `{ results: [{title,url,snippet,engine,rank,found_in,...}], meta: {...} }`.
- Image: `POST /sdapi/v1/txt2img`. Body `{model, prompt, width, height, steps, seed, remove_background}`.
  Response `{ images: string[] (base64), parameters, info }`. (OpenAI-style `/v1/images/generations`
  also exists; we reuse sdapi for consistency with existing code.)
- **RISKS to verify against the live gateway before shipping, with graceful degradation built in:**
  1. **Named `tool_choice` forcing** (`{type:"function", function:{name}}`) may be ignored by the
     upstream (vLLM). Fallback: if a forced tool was requested but iteration 1 returns no matching
     tool call, proceed with the plain answer and show a toast ("couldn't run the requested tool").
  2. **Streaming `tool_call` deltas** must be confirmed. Build the accumulator regardless; if the
     model returns tool calls non-streamed it still works (deltas just arrive in one chunk).

## Components

### 1. Tool definitions + executors — `src/utils/chat-tools.ts` (new)

Plain module (NO React hooks — called from the route's async loop):

- OpenAI tool schemas:
  - `web_search(query: string)` — required `query`.
  - `generate_image(prompt: string, width?: number, height?: number)` — required `prompt`.
- `executeWebSearch(query, chatApiKey)` → `POST {connected}/search`
  `{ query, engines, max_results: 5, search_type: "web" }`. Returns
  `{ sources: {title,url,snippet}[], toolText }`. `toolText` is a compact numbered list
  (`1. title — url — snippet`) fed back to the model; `"No results found."` when empty.
- `executeGenerateImage({prompt,width?,height?}, chatApiKey)` → `POST {connected}/sdapi/v1/txt2img`
  (same fetch as `useImageGeneration.mutationFn`, extracted to a plain async fn). Returns
  `{ image: ImageData (base64 PNG), toolText: "Image generated successfully." }`. On HTTP error,
  returns `{ image: null, toolText: "Image generation failed: <reason>" }` (loop continues; model
  explains).
- `supportsTools(model, models)` added to `src/config/model-capabilities.ts`, mirroring
  `supportsImages`, reading `capabilities.text.function_calling`.

`useImageGeneration` stays as-is for the `/images` page; its `mutationFn` body is refactored to call
the shared `executeGenerateImage` so logic isn't duplicated.

### 2. Agentic loop — `src/routes/chat.$chatId.tsx`

Replace the single `chat.completions.create` with a loop (cap 5 iterations).

**forcedTool wiring (critical):** the route owns a `pendingForcedToolRef`. `ChatInput` reports the
chosen tool via the extended `onSubmit(value, images, forcedTool?)`; `handleSendMessage` sets
`pendingForcedToolRef.current = forcedTool` **before** `addMessage`. The auto-trigger `useEffect`
reads the ref, clears it, and passes it into `generateAIResponse(forcedTool?)`.

**State discipline (critical):** `isLoading` stays `true` for the entire loop — including tool
execution between iterations — and is only cleared in `finally`. `isStreaming` is `true` only while
content/reasoning tokens arrive, and is set back to `false` during tool execution (so the typing
dots reappear). This keeps the trigger effect from re-firing (it also guards on `!isLoading`) and the
input disabled throughout.

Per iteration:
1. Build request `messages` via a shared `buildRequestMessages(history, model, models)` helper:
   system + mapped history. Image attachment: collect every image across user + assistant messages
   in order, keep the **last 4**, emit them as `image_url` content blocks — but **generated images
   on assistant messages are re-emitted inside a synthetic `{role:"user", content:[{type:"image_url",
   ...}]}` message** (the API rejects `image_url` on assistant turns). Only when `supportsImages(model)`.
2. Attach `tools` iff `useConnected && supportsTools`. On the **first** iteration only, if
   `forcedTool` is set, pass `tool_choice: {type:"function", function:{name: forcedTool}}`; otherwise
   `"auto"`. Later iterations always `"auto"`.
3. Stream; accumulate `content`, `thinking`, **and** `tool_calls`. Tool-call accumulator: a third
   branch keyed by `delta.tool_calls[i].index`, capturing `id`/`function.name` on first appearance
   and concatenating `function.arguments` fragments.
4. If the turn ended with tool calls:
   - Set transient `toolStatus` ("Searching the web…" / "Generating image…").
   - Append the assistant tool-call message to the in-memory request array.
   - Execute each call; stash artifacts onto the persisted assistant message via
     `updateMessageArtifacts` (see §3); append a `role:"tool"` message (`tool_call_id`, `toolText`).
   - If `forcedTool` was set but iteration 1 produced no matching call → toast, continue.
   - Loop back to step 3.
5. Exit when the model returns plain content → final answer streamed into the placeholder.

In-memory only: `tool_call_id`, raw args, `role:"tool"` messages. Persisted history re-sent later is
the assistant's final text + its images/sources.

**Abort:** a module-level/loop-scoped `AbortController` is passed to every `fetch` /
`openai.chat.completions.create({signal})`. A **stop button** (replaces send while `isLoading`)
aborts it; the loop catches the abort, finalizes whatever content exists, and clears state.

### 3. Persistence — `src/types/chats/v4.ts` (new) + migration + store

`MessageV4` extends V3 with:
- `images?` — existing field, now also populated with **generated** images on assistant messages.
- `sources?: { title: string; url: string; snippet: string }[]`.

Plumbing (all required):
- New `src/types/chats/v4.ts` with `MessageV4Schema` / `ChatV4Schema`.
- Register `v3ToV4Migration` (identity; new fields optional) in `src/types/chats/migrations/index.ts`.
- Re-point `src/types/chats/index.ts` to export V4 as `Message`/`Chat`.
- Bump `CHAT_VERSION` in `src/stores/chat.ts` from 3 → 4.
- New store action `updateMessageArtifacts(chatId, messageId, { sources?, images? })` that patches
  those fields without clobbering `content`/`thinking` (existing `updateMessage` can't).

### 4. Rendering — `src/components/Message.tsx`

- Render assistant `images` inline (larger than user thumbnails).
- Collapsible **Sources** block (favicon + title + link), styled like the Thinking block; full-width
  tappable header (mobile); render only when `sources.length > 0`.
- Mid-turn status: a `toolStatus` prop on the last message renders **independently of
  `message.content`** (a tool-only turn has empty content), shown while `isLoading`. Reuse/extend the
  typing-dots area.

### 5. `+` menu + input — `src/components/ChatInput.tsx`

- New prop `isConnected: boolean` (passed from the route, consistent with the `assistant` prop). Used
  to disable tool items + show tooltip.
- Render condition for the `+` button changes from `modelSupportsImages` to
  `supportsTools(model) || modelSupportsImages`. Hoist `fileInputRef` + upload handler **out** of the
  `modelSupportsImages` guard.
- Menu items:
  - **Add photos & files** — renamed from "Images"; only when `modelSupportsImages`; triggers upload.
  - **Create image** — only when `supportsTools`; **disabled + tooltip "Connect to use this"** when
    `!isConnected`; else sets `forcedTool = "generate_image"`.
  - **Web search** — same gating; sets `forcedTool = "web_search"`.
- Selected tool shows a removable **chip** rendered **inside** the rounded input container (alongside
  image previews), not in the absolute bottom bar. Cleared on submit, on removal, and whenever
  `supportsTools` becomes false.
- `onSubmit` extended to `(value, images?, forcedTool?)`. Tooltip via Radix `ui/tooltip` (add if absent).

## Error handling

- Tool failure → `role:"tool"` message carrying the error string so the model can explain; toast on
  hard failures (reuse `useImageGeneration` toast pattern). Image failure leaves `images` unset.
- Empty search → `sources: []`, `toolText: "No results found."`, no Sources block.
- Forced tool requested but not honored by upstream → toast, plain answer proceeds.
- Iteration cap reached → stop, surface existing content.
- Abort → finalize partial content, clear loading state.
- Existing top-level try/catch keeps the generic error fallback.

## Testing

- Unit: `chat-tools` schemas + executors (mock fetch, incl. empty + error paths); `supportsTools`;
  `buildRequestMessages` 4-image trim (oldest dropped, newest kept, vision-gated, generated images
  wrapped as user-role); tool-call streaming accumulator (index keying, arg concatenation).
- Manual against live gateway: forced search, forced image, auto invocation, multi-tool turn, stop
  button mid-image-gen, logged-out disabled menu + tooltip, non-vision model skips images, named
  `tool_choice` honored vs degraded.

## Open / deferred

- Confirm named `tool_choice` + streaming tool_call deltas on the live gateway (degradation built in).
- Token cost: generated 1024² images re-sent (within the 4-image cap) on later turns — accepted.
- Future: `/search/fetch` page reading, saving generated images to the `/images` gallery, persisting
  the raw tool transcript for richer history replay.

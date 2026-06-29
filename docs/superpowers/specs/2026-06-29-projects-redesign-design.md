# Projects redesign (ChatGPT-style) — design

Date: 2026-06-29
Status: approved scope, pending spec review

## Goal

Replace the cramped inline collapsible project-folder groups in the sidebar with a
ChatGPT/Claude-style projects experience: a dedicated Projects index page, per-project
detail pages, and a flat, link-based sidebar. **No emoji/icon picker in v1** — use a
default folder icon everywhere. Emoji can be added later.

## Out of scope (v1)

- Per-project emoji/icon picker (default folder icon only).
- Sharing, group chats, "Sources" tab — not part of this app.
- Server persistence — projects stay client-side (localStorage), unchanged.

## Data model

`Project` is unchanged (`src/stores/project.ts`): `id`, `name`, `instructions?`,
`createdAt`, `updatedAt`. `Chat.projectId` already links a chat to a project. No store
schema changes. `updatedAt` is used as "Modified" on the index page.

## Routes (new, TanStack file-based)

### `/projects` — index page (`src/routes/projects.tsx`)
- Header: "Projects" title, a search input (client-side filter by name), a **New** button
  (opens the existing create-project dialog).
- Body: a Name / Modified list. Each row = folder icon + name (left), modified date
  (right), links to `/project/$projectId`.
- Empty state: short prompt + New button.

### `/project/$projectId` — detail page (`src/routes/project.$projectId.tsx`)
- Header: folder icon + project name + a `⋯` menu reusing **Settings** (rename +
  instructions) and **Delete** actions.
- A **"New chat in <name>"** entry → navigates to `/?project=<id>`.
- The project's chats listed (title + first-message snippet + date), each links to
  `/chat/$chatId`. Empty state when none.
- Invalid `projectId` → render a not-found state (reuse/extend existing
  ConversationNotFound pattern or a simple inline message) and a link back to `/projects`.

## Sidebar (Layout + ChatList)

- Add a **Projects** nav link (folder icon) alongside the existing nav items (near
  "New conversation" / Products), navigating to `/projects`.
- In `ChatList`, replace the collapsible project groups (chevron + inline nested chats)
  with a flat **Projects** section: each project is a single row (folder icon + name)
  linking to `/project/$projectId`, plus the existing "+ New project" affordance
  (keep the `FolderPlus` button / create dialog).
- **Chats** section becomes a flat recency list of ALL chats (project + ungrouped),
  sorted by recency. Remove the per-project nesting and the "Ungrouped" header.
- Keep per-chat actions (rename/move-to-project/delete) as they are today.

## "New chat in <project>" plumbing

- `createChat` signature stays unchanged.
- Project detail page's "New chat in <name>" navigates to `/?project=<id>`.
- The index route (`src/routes/index.tsx`) reads the `project` search param; after the
  first message creates the chat, it calls the existing
  `setChatProject(chatId, projectId)` so the new chat lands in the project.
- The empty-state input placeholder/heading on `/` can reflect "New chat in <name>" when
  the param is present (optional polish; the functional requirement is the project link).

## Shared dialogs extraction

The create / settings / delete project dialogs currently live inside `ChatList`. Extract
them into a shared component (e.g. `src/components/ProjectDialogs.tsx`) exposing open
handlers via a small store or context, so both the sidebar and the new pages can trigger
the same dialogs without duplicating logic. Scope this extraction to exactly these three
dialogs — no unrelated refactor of `ChatList`.

## Testing

- Unit: project store unchanged; add coverage for the index-route `project` param →
  `setChatProject` wiring.
- E2E (Playwright): create a project → appears in sidebar + `/projects` list; open detail
  page; "New chat in <name>" creates a chat attached to the project; delete project
  detaches its chats (they remain in the flat Chats list).

## Open questions

None outstanding — scope and sidebar behavior confirmed.

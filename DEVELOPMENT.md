# Client-Side Parity — Development Plan

Branch: `feat/clientside-parity` (off `main`). Goal: close the chat app's parity gap with
Claude/ChatGPT using **client-side only** features (no backend changes). Full rationale:
`libertai-coordination/docs/CHAT-PARITY-CLIENTSIDE-PLAN.md`.

## Quality gates (run per milestone)

- `pnpm build` — `tsc -b && vite build`, must exit 0.
- `pnpm lint` — eslint `--max-warnings=0`.
- `pnpm test` — vitest unit tests.
- `pnpm e2e` — Playwright headless Chromium walks every route, fails on console/page errors or
  blank pages, screenshots to `test-results/screenshots/`.

## Invariants

- No stubs, no half-done features — each milestone is fully functional before commit.
- All gates stay green. No feature deleted or test weakened to pass.
- Privacy posture preserved: execution + rendering happen in the browser; new persisted state
  (assistants, projects, memory, artifacts) goes to `localStorage` like chats — never a server.
- Match existing code style (tabs, Tailwind v4, Radix, Zustand). No em-dashes in UI copy.
- Auth: the app has a guest/logged-out mode (free public endpoint). Model-invoked tool calls
  (web_search / generate_image / run_python) require a connected key — verify those paths via
  direct/seeded tests, never by stubbing the feature.

## Milestone backlog

| # | Milestone | Phase |
|---|---|---|
| m1 | Rich markdown baseline (gfm, Shiki, KaTeX, mermaid, copy button) | P0 |
| m2 | Explicit model picker + TEE badge | P0 |
| m3 | Web-search polish (search_type modes + inline citations) | P0 |
| m4 | Client-side code interpreter (Pyodide + JS sandbox) | P1 |
| m5 | Artifacts / Canvas side-panel | P1 |
| m6 | Non-image file input (PDF/CSV/text, client-side) | P1 |
| m7 | Client-side document export (PDF/DOCX/XLSX) | P1 |
| m8 | Editable / custom assistants (localStorage) | P1 |
| m9 | Projects / folders + per-project instructions | P1 |
| m10 | Cross-conversation memory (local) | P1 |

Built sequentially via the dev-factory workflow: implement → build+lint+e2e+screenshot review →
fix loop → commit, one milestone at a time.

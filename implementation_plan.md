# Implementation Plan

[Overview]
Remove the deprecated Code Canvas feature end-to-end (database schema, backend API surface, websocket plumbing, state store, UI panels, hotkeys, and assets) so that Collaborate is the sole workspace experience while preserving all Collaborate capabilities.

Code Canvas models, services, and UI code still exist throughout the stack (Prisma schema, REST endpoints in `server/src/routes/index.ts`, orchestrator context injection, Zustand store slices, React panels such as `CodeCanvas.tsx`, keyboard shortcuts, etc.). They must be removed without impacting the Collaborate flow, chat experience, or websocket behavior.

[Types]
Retire all types that model Code Canvas entities.

- Remove Prisma models: `CodeCanvas`, `CodeFile`, `CodeFileVersion`, `CodeSuggestion`, `CodeTask`, `CodeSubtask`, `CodeCollaboration`, `CodingPreference`, and any enums/indices attached to them.
- Delete TypeScript interfaces referencing Code Canvas data in `web/src/state/store.ts` (`CodeCanvas`, `CodeFile`, `CodeTask`, `CodeSubtask`, `CodeCollaboration`, `DiffApprovalRequest`, operation-tracking structs, etc.).
- Remove request payload types referencing `activeCanvasId` in `server/src/agent/orchestrator.ts` and `server/src/ws/index.ts` (chat send payloads) plus the `codebase` portion of context snapshots.
- Drop `CodeCanvasProps`/`CodeFile` types inside `web/src/components/canvas/CodeCanvas.tsx` once the component is removed entirely.

[Files]
Eliminate all legacy Code Canvas files and update remaining modules so Collaborate is the only coding workspace.

- **New files:** none planned (migrations will be handled by editing existing Prisma migration scripts or adding a new migration if desired).
- **Modified files:**
  - `server/prisma/schema.prisma`: delete Code Canvas and CodingPreference models plus related relations; ensure referential integrity for remaining tables.
  - `server/prisma/migrations/*remove_code_canvas_features*/migration.sql`: verify it already drops canvas tables; adjust or add a new migration if additional tables still exist.
  - `server/src/routes/index.ts`: remove every `/api/canvas`, `/api/templates`, `/api/coding/preferences`, `/api/canvas/*` endpoint, Git mock endpoints, code actions, dependency graph/test runner/performance analysis endpoints, etc. Keep health/logs/persona routes untouched.
  - `server/src/agent/orchestrator.ts`: strip `activeCanvasId` plumbing, codebase context sections, and any references to Settings.includeCodebaseContext.
  - `server/src/ws/index.ts`: remove websocket events involving `canvas:*`, subtask events, diff approvals, etc. Ensure remaining events still function.
  - `server/src/agent/projectTemplates.ts`, `server/src/agent/codeCompletion.ts`, `server/src/agent/errorHandler.ts`: delete if only used by Code Canvas; otherwise remove canvas-specific exports/calls.
  - `server/src/providers/*` or utils referencing Code Canvas (e.g., `apiOptimizer`, logs) – delete dead helpers.
  - `web/src/state/store.ts`: remove the `canvasState` slice, Code Canvas interfaces, websocket handlers referencing canvas events, actions such as `loadCanvasList`, `openFileInTab`, diff approval state, etc. Ensure Collaborate state remains.
  - `web/src/App.tsx`: drop Code Canvas lazy import, conditional panels, and related layout width toggles.
  - `web/src/components/canvas/CodeCanvas.tsx` and `web/src/components/terminal/Tabs.tsx` plus other terminal-related files referencing Code Canvas: delete entire directories (`web/src/components/canvas`, `web/src/components/terminal/Tabs.tsx` if only for Code Canvas tabs) if not reused elsewhere.
  - `web/src/lib/ws.ts`, `web/src/lib/keyboardShortcuts.ts`, `web/src/hooks/useLayoutShortcuts.ts`: remove canvas hotkeys and ws event handling for canvas events.
  - `web/src/components/chat/ChatWindow.tsx` and other UI toggles that test `canvasState.activeCanvas`: remove gating logic and any UI copy referencing Code Canvas.
  - `web/package.json` & `server/package.json`: remove dependencies solely used by Code Canvas (monaco, reactflow entry points for canvas layout, etc.) if still needed? (Keep `@monaco-editor/react` only if Collaborate uses it; otherwise remove.)
- **Files to delete:**
  - Entire `web/src/components/canvas/` directory.
  - Any Code Canvas-specific panels (e.g., `web/src/components/terminal/Tabs.tsx`, `web/src/components/terminal/TerminalHeader.tsx` sections referencing canvas, `TerminalLayout` slots for canvas panel) if they no longer serve Collaborate.
  - `server/src/agent/codeCompletion.ts`, `server/src/agent/errorHandler.ts`, `server/src/agent/projectTemplates.ts` if exclusively powering Code Canvas (confirm no Collaborate references; otherwise isolate re-usable logic before deletion).
  - `server/src/ws/canvas` helpers if present (currently within `server/src/ws/index.ts`).
  - Build artifacts referencing canvas (e.g., `web/src/components/canvas/CodeCanvas.tsx`, `web/src/components/chat/SearchResultBubble.tsx` if only used in Code Canvas context).
- **Config:** ensure `server/package.json` scripts no longer mention canvas migrations; update environment docs if they referenced Code Canvas toggles.

[Functions]
Remove or refactor functions previously supporting Code Canvas.

- **Backend:** delete helper methods such as `setupRoutes -> /api/canvas` handlers, `buildMessages` code that injects `codebaseText`, `emitContextSnapshot` code counting codebase tokens, `createPostResponseBackup` references to canvases, and ws event handlers inside `server/src/ws/index.ts` for `canvas:*` channels.
- **Frontend:** remove Zustand actions (`loadCanvas`, `updateFileContent`, `setDiffApprovalRequest`, etc.), websocket functions sending `activeCanvasId`, and React components (e.g., `CodeCanvas`, `CommandPalette` items for canvas) that depended on those states.
- **Utilities:** delete collaborator-specific operations like `applyDiff` handlers if they were only for Code Canvas.

[Classes]
No persistent classes remain specifically for Code Canvas once files are removed.

- Delete the `CodeCanvas` React component (functional) and any class-based wrappers.
- Remove the `CommandPalette` class/objects referencing Code Canvas tasks if those entries are not needed elsewhere.
- Remove any server-side class wrappers (e.g., `AgenticWorkflowEngine` hooks specific to canvas) if unused, otherwise refactor to be general-purpose.

[Dependencies]
Clean package manifests.

- Remove `@monaco-editor/react`, `monaco-editor`, `reactflow`, or other dev-only packages if no remaining feature (Collaborate) needs them. Verify Collaborate uses plain textarea/editor vs. Monaco before removal.
- Delete Playwright or other tooling added solely for Code Canvas automation if not used elsewhere.

[Implementation Order]
Remove Code Canvas in a controlled order to avoid broken builds.

1. **Schema cleanup:** edit `schema.prisma` (and migrations) to drop Code Canvas tables/models and regenerate Prisma client. Ensure no other model references remain.
2. **Backend routes/services:** remove `/api/canvas` endpoints, canvas-specific agents (`codeCompletion`, `errorHandler`, `projectTemplates`), websocket handlers, and orchestrator `activeCanvasId` support.
3. **Frontend state & websocket layer:** delete canvas slices/actions from `useStore`, remove ws event handling and message payload fields, adjust `ws.sendMessage` to no longer send `activeCanvasId`.
4. **UI components & layouts:** delete `CodeCanvas` component and any tabs/panels/hotkeys referencing it, leaving Collaborate as the only workspace view.
5. **Dependency cleanup:** remove unused packages/imports/scripts; update README or docs if they referenced Code Canvas usage.
6. **Verification:** run Prisma migrations, server build, web build, and basic manual test of chat + Collaborate to confirm nothing references removed code.

Task progress items:
- [ ] Update Prisma schema/migrations to drop Code Canvas models.
- [ ] Remove backend APIs, services, and websocket events tied to Code Canvas.
- [ ] Clean Zustand store, websocket client, and shared types of canvas state.
- [ ] Delete React components/layouts and keyboard shortcuts referencing Code Canvas.
- [ ] Prune unused dependencies/scripts and validate build/test pipelines.

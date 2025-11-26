# Collaborate Panel Enhancements TODO

> A detailed step-by-step implementation plan for 3 Quality of Life features and 3 Brand New Functional features for the Evelyn Collaborate Panel.

---

## 🧠 Current Codebase Architecture Summary

### Frontend (web/src/components/collaborate/)
- **CollaboratePanel.tsx** - Main container orchestrating Toolbar, Sidebar, Editor, and Chat
- **CollaborateEditor.tsx** - Monaco-based code/text editor with Evelyn's cyberpunk theme
- **CollaborateChat.tsx** - AI chat interface with intent detection and agentic edit progress
- **CollaborateSidebar.tsx** - Documents list, Suggestions panel, Version History tabs
- **CollaborateToolbar.tsx** - Document actions, save, export, shortcuts menu
- **SuggestionPanel.tsx** - AI-generated suggestions with apply/reject actions
- **VersionHistory.tsx** - Version timeline with revert and diff viewing
- **AgenticEditProgress.tsx** - Real-time display of Evelyn's think→tool loops
- **ShortcutMenu.tsx** - Writing/coding shortcuts (polish, emojis, bug fix, etc.)

### Backend (server/src/agent/)
- **collaborativeAssistant.ts** - AI functions for writing/coding shortcuts, intent detection
- **agenticCodeEditor.ts** - Agentic editing with goal-based think→tool loops
- **orchestrator.ts** - Main message pipeline, routes collaborate chat through AI

### State Management (web/src/state/store.ts)
- `CollaborateState` interface with activeDocument, chatMessages, suggestions, versionHistory
- WebSocket events in `web/src/lib/ws.ts` for real-time updates

---

## 🎯 QUALITY OF LIFE FEATURES

---

### QoL Feature 1: Global Keyboard Shortcuts & Command Palette

**Overview**: Add a command palette (Cmd/Ctrl+K) and comprehensive keyboard shortcuts for all collaborate actions.

#### Step 1.1: Create Command Palette Component
**File**: `web/src/components/collaborate/CommandPalette.tsx`

```
1. Create new component with:
   - Fuzzy search input with auto-focus
   - Categorized command list (Document, Edit, AI, Navigation)
   - Keyboard navigation (up/down arrows, enter to select)
   - Recent commands memory
   - Command preview/description

2. Commands to include:
   - New Document (Cmd+N)
   - Save Version (Cmd+S)
   - Export Document (Cmd+E)
   - Toggle Suggestions (Cmd+I)
   - Toggle Version History (Cmd+H)
   - Ask Evelyn to Edit (Cmd+Enter)
   - Apply Suggestion (Tab when focused)
   - Undo/Redo (Cmd+Z / Cmd+Shift+Z)
   - Toggle Inline Suggestions (Cmd+.)
   - Run Shortcut: Polish (Cmd+Shift+P)
   - Run Shortcut: Fix Bugs (Cmd+Shift+B)
   - Jump to Line (Cmd+G)
   - Search in Document (Cmd+F)
```

#### Step 1.2: Extend Keyboard Shortcuts Handler
**File**: `web/src/lib/keyboardShortcuts.ts`

```
1. Add new shortcuts map for collaborate panel:
   - Register global shortcuts only when collaborate tab is active
   - Prevent conflicts with Monaco editor shortcuts
   - Support multi-key combinations (e.g., Cmd+Shift+P)

2. Create shortcut context system:
   - Editor-focused shortcuts
   - Chat-focused shortcuts  
   - Global collaborate shortcuts
```

#### Step 1.3: Update Store for Command Palette State
**File**: `web/src/state/store.ts`

```
1. Add to UIState interface:
   - commandPaletteOpen: boolean
   - recentCommands: string[]

2. Add actions:
   - toggleCommandPalette()
   - executeCommand(commandId: string)
   - addRecentCommand(commandId: string)
```

#### Step 1.4: Visual Shortcut Hints
**Files**: `CollaborateToolbar.tsx`, `ShortcutMenu.tsx`, `SuggestionPanel.tsx`

```
1. Add keyboard shortcut badges next to each action button
2. Show tooltip on hover with full shortcut description
3. Respect platform differences (Cmd vs Ctrl)
```

---

### QoL Feature 2: Smart Auto-Save with Conflict Detection

**Overview**: Implement intelligent auto-save that prevents data loss while avoiding conflicts during AI editing.

#### Step 2.1: Create Auto-Save Service
**File**: `web/src/lib/autoSave.ts`

```
1. Create AutoSaveService class:
   - Debounced save (2 second delay after last keystroke)
   - Track dirty state per document
   - Queue saves when offline
   - Sync pending saves on reconnect

2. Conflict detection logic:
   - Track last known server version
   - Compare before saving
   - If conflict: show merge dialog
```

#### Step 2.2: Add Save Status Indicator
**File**: `web/src/components/collaborate/SaveStatusIndicator.tsx`

```
1. Create status indicator component:
   - "All changes saved" (green checkmark)
   - "Saving..." (spinner)
   - "Unsaved changes" (orange dot)
   - "Conflict detected" (red warning)
   - "Offline - changes queued" (gray)

2. Show last saved timestamp on hover
```

#### Step 2.3: Conflict Resolution Modal
**File**: `web/src/components/collaborate/ConflictModal.tsx`

```
1. Create modal with:
   - Side-by-side diff view (your version vs server version)
   - "Keep Mine" / "Keep Theirs" / "Merge" options
   - Highlight conflicting sections
   - Preview merged result

2. Integrate with DiffViewer.tsx for consistent diff display
```

#### Step 2.4: Backend Version Conflict API
**File**: `server/src/routes/collaborate.ts`

```
1. Add version checking endpoint:
   - GET /api/collaborate/:id/version - returns current version hash
   - PUT /api/collaborate/:id with If-Match header for optimistic locking

2. Return 409 Conflict when version mismatch detected
```

#### Step 2.5: Pause Auto-Save During AI Edits
**File**: `web/src/lib/autoSave.ts` and `web/src/lib/ws.ts`

```
1. Listen for 'collaborate:evelyn_editing' event
2. Pause auto-save timer
3. Resume after 'collaborate:content_changed' from Evelyn
4. Show "Evelyn is editing..." indicator
```

---

### QoL Feature 3: Enhanced Document Organization

**Overview**: Add tags, favorites, folders, and smart filtering to manage documents effectively.

#### Step 3.1: Extend Document Schema
**File**: `server/prisma/schema.prisma`

```
1. Add to CollaborateDocument model:
   - tags: String[] (array of tag strings)
   - isFavorite: Boolean (default false)
   - folderId: Int? (optional folder reference)
   - color: String? (accent color for visual organization)

2. Create CollaborateFolder model:
   - id: Int
   - name: String
   - parentId: Int? (for nested folders)
   - order: Int
```

#### Step 3.2: Document List Filter Bar
**File**: `web/src/components/collaborate/DocumentList.tsx`

```
1. Add filter bar above document list:
   - Tag filter dropdown (multi-select)
   - Type filter (All / Text / Code)
   - Date filter (Today / This Week / This Month / All Time)
   - Sort options (Name / Modified / Created / Type)

2. Add star/favorite toggle on each document
3. Add quick tag assignment via right-click menu
```

#### Step 3.3: Create Tag Management UI
**File**: `web/src/components/collaborate/TagManager.tsx`

```
1. Create tag management component:
   - Show all used tags with document counts
   - Create new tags with color picker
   - Rename/delete tags
   - Drag-and-drop tag assignment

2. Inline tag editor on document hover/click
```

#### Step 3.4: Folder Tree View
**File**: `web/src/components/collaborate/FolderTree.tsx`

```
1. Create collapsible folder tree:
   - Drag-and-drop documents between folders
   - Create/rename/delete folders
   - Folder icons and colors
   - Expand/collapse all

2. "Unfiled" section for documents without folders
```

#### Step 3.5: Update Store and API
**Files**: `web/src/state/store.ts`, `server/src/routes/collaborate.ts`

```
1. Store additions:
   - filters: { tags: string[], type: string, date: string }
   - folders: CollaborateFolder[]
   - setFilters(), createFolder(), moveDocument()

2. API additions:
   - PUT /api/collaborate/:id/tags
   - PUT /api/collaborate/:id/favorite
   - POST /api/collaborate/folders
   - PUT /api/collaborate/:id/folder
```

---

## 🚀 BRAND NEW FUNCTIONAL FEATURES

---

### New Feature 1: Real-Time Multi-Cursor Collaboration Display

**Overview**: Visualize Evelyn's editing cursor and selections in real-time within the Monaco editor.

#### Step 1.1: Define Cursor Presence Protocol
**File**: `server/src/ws/collaboratePresence.ts`

```
1. Create presence tracking system:
   - Track cursor position: { line, column }
   - Track selection range: { startLine, startCol, endLine, endCol }
   - Track current action: 'idle' | 'thinking' | 'typing' | 'selecting'

2. Emit events:
   - 'collaborate:cursor_move' - when Evelyn moves cursor
   - 'collaborate:selection_change' - when Evelyn selects text
   - 'collaborate:action_change' - when Evelyn's state changes
```

#### Step 1.2: Integrate with Agentic Editor
**File**: `server/src/agent/agenticCodeEditor.ts`

```
1. Emit cursor events during editing:
   - Before read_file: emit cursor at start of target range
   - During replace_in_file: emit selection of replaced range
   - After write_to_file: emit cursor at end of written content

2. Add cursor position to iteration progress events
```

#### Step 1.3: Create Cursor Overlay Component
**File**: `web/src/components/collaborate/EvelynCursor.tsx`

```
1. Create cursor decoration for Monaco:
   - Orange blinking cursor with "Evelyn" label
   - Selection highlight in orange with transparency
   - Smooth animation between positions
   - Cursor trail effect for fast movements

2. Use Monaco's decoration API:
   - createDecorationsCollection() for selections
   - Custom CSS for cursor line and label
```

#### Step 1.4: Update CollaborateEditor to Show Cursor
**File**: `web/src/components/collaborate/CollaborateEditor.tsx`

```
1. Listen for cursor events from WebSocket
2. Update decorations on cursor move
3. Show "Evelyn is here" tooltip on hover
4. Animate cursor during 'thinking' state (pulse effect)
```

#### Step 1.5: Add Cursor to AgenticEditProgress
**File**: `web/src/components/collaborate/AgenticEditProgress.tsx`

```
1. Show current cursor position in progress panel
2. Add "Jump to Evelyn's cursor" button
3. Mini-map showing Evelyn's position in document
```

---

### New Feature 2: Document Templates & Boilerplates System

**Overview**: Pre-built templates for common document types with AI-powered customization.

#### Step 2.1: Create Template Schema
**File**: `server/prisma/schema.prisma`

```
1. Create CollaborateTemplate model:
   - id: Int
   - name: String
   - description: String
   - category: String (e.g., "code", "writing", "business")
   - contentType: String ("text" | "code" | "mixed")
   - language: String? (for code templates)
   - content: String (template content with placeholders)
   - placeholders: Json (array of { key, description, default })
   - isBuiltIn: Boolean (system templates vs user-created)
   - usageCount: Int
   - createdAt: DateTime
   - updatedAt: DateTime

2. Create migration and seed with built-in templates
```

#### Step 2.2: Define Built-in Templates
**File**: `server/src/data/collaborateTemplates.ts`

```
1. Code Templates:
   - React Component (functional with hooks)
   - Express API Route
   - Python Script with main
   - TypeScript Interface
   - Unit Test (Jest)
   - REST API Documentation

2. Writing Templates:
   - Blog Post Structure
   - Technical Documentation
   - Meeting Notes
   - Project Proposal
   - README.md
   - Changelog Entry

3. Business Templates:
   - Email Template
   - Report Structure
   - Project Brief
```

#### Step 2.3: Create Template Selection Modal
**File**: `web/src/components/collaborate/TemplateModal.tsx`

```
1. Create template browser:
   - Category tabs (All / Code / Writing / Business / Custom)
   - Search/filter templates
   - Template preview pane
   - Usage statistics per template

2. Placeholder customization form:
   - Dynamic form based on template placeholders
   - AI-powered placeholder suggestions
   - Preview with placeholders filled
```

#### Step 2.4: AI-Powered Template Customization
**File**: `server/src/agent/templateEngine.ts`

```
1. Create template processing functions:
   - parsePlaceholders(template: string) - extract {{placeholders}}
   - fillPlaceholders(template: string, values: object) - replace with values

2. AI customization:
   - suggestPlaceholderValues(template, userContext)
   - generateFromDescription(description, templateCategory)
   - adaptTemplateToProject(template, projectContext)
```

#### Step 2.5: Save as Template Feature
**File**: `web/src/components/collaborate/SaveAsTemplateModal.tsx`

```
1. Allow users to save current document as template:
   - Mark sections as placeholders
   - Add template name, description, category
   - Preview how it will look as template

2. Extract common patterns automatically:
   - Detect variable names, project names
   - Suggest placeholder candidates
```

#### Step 2.6: Update NewDocumentModal
**File**: `web/src/components/collaborate/NewDocumentModal.tsx`

```
1. Add "Start from Template" option:
   - Quick access to recent/popular templates
   - "Blank Document" always at top
   - Template search inline

2. Integrate with template customization flow
```

---

### New Feature 3: AI-Powered Document Comparison & Merge

**Overview**: Compare any two versions or documents with AI explanations of changes and smart merge capabilities.

#### Step 3.1: Create Comparison Engine
**File**: `server/src/agent/documentComparison.ts`

```
1. Create comparison functions:
   - diffDocuments(docA: string, docB: string) - line-by-line diff
   - semanticDiff(docA: string, docB: string) - meaningful change groups
   - aiExplainDiff(changes: Diff[]) - AI explanation of each change

2. Change categorization:
   - Added / Removed / Modified
   - Refactoring / Bug Fix / Feature / Style
   - Breaking / Non-breaking (for code)
```

#### Step 3.2: AI Explanation Generator
**File**: `server/src/agent/documentComparison.ts`

```
1. Generate AI explanations:
   - Summarize overall changes in natural language
   - Explain why each change might have been made
   - Flag potential issues or improvements

2. For code changes:
   - Detect refactoring patterns
   - Identify bug fixes
   - Note performance implications
   - Warn about breaking changes
```

#### Step 3.3: Create Comparison View Component
**File**: `web/src/components/collaborate/ComparisonView.tsx`

```
1. Create side-by-side comparison:
   - Synchronized scrolling
   - Line highlighting for changes
   - Inline diff for modified lines
   - Collapsible unchanged sections

2. AI insights panel:
   - Change summary at top
   - Per-section explanations
   - "Ask Evelyn about this change" button
```

#### Step 3.4: Version Comparison Entry Points
**File**: `web/src/components/collaborate/VersionHistory.tsx`

```
1. Add comparison actions:
   - "Compare with current" on each version
   - "Compare selected versions" (multi-select)
   - "Compare with previous version" quick action

2. Show comparison in slide-out panel or modal
```

#### Step 3.5: Cross-Document Comparison
**File**: `web/src/components/collaborate/CrossDocCompare.tsx`

```
1. Allow comparing two different documents:
   - Document selector for each side
   - Useful for comparing implementations
   - Copy from one side to another

2. Access from:
   - Toolbar "Compare" button
   - Right-click menu on documents
   - Command palette
```

#### Step 3.6: Smart Merge Tool
**File**: `web/src/components/collaborate/MergeEditor.tsx`

```
1. Create three-way merge view:
   - Left: Version A
   - Center: Merged result
   - Right: Version B

2. Per-conflict resolution:
   - "Accept Left" / "Accept Right" / "Accept Both"
   - Manual edit in center panel
   - AI suggestion for merge conflicts

3. AI-assisted merge:
   - "Let Evelyn merge this" button
   - Evelyn explains merge decisions
   - Review and approve AI merge
```

#### Step 3.7: Backend Comparison API
**File**: `server/src/routes/collaborate.ts`

```
1. Add comparison endpoints:
   - POST /api/collaborate/compare
     Body: { documentIdA, versionA?, documentIdB, versionB? }
     Returns: { diff, aiSummary, changes[] }

   - POST /api/collaborate/merge
     Body: { base, left, right, strategy? }
     Returns: { merged, conflicts[], aiResolutions[] }

   - POST /api/collaborate/explain-diff
     Body: { changes[] }
     Returns: { explanations[] }
```

---

## 📋 Implementation Priority & Dependencies

### Phase 1: Foundation (Week 1-2)
1. **QoL Feature 3** (Document Organization) - Enables better testing
2. **QoL Feature 2** (Auto-Save) - Critical for data safety

### Phase 2: Power User Features (Week 3-4)  
3. **QoL Feature 1** (Command Palette) - Improves productivity
4. **New Feature 2** (Templates) - Onboarding improvement

### Phase 3: Advanced Collaboration (Week 5-6)
5. **New Feature 1** (Multi-Cursor) - Enhances AI collaboration experience
6. **New Feature 3** (Comparison & Merge) - Complex but high value

---

## 🧪 Testing Checklist

### For Each Feature:
- [ ] Unit tests for new store actions
- [ ] Integration tests for API endpoints
- [ ] E2E tests for user flows
- [ ] WebSocket event handling tests
- [ ] Error state handling
- [ ] Loading state handling
- [ ] Mobile/responsive behavior
- [ ] Keyboard accessibility
- [ ] Performance with large documents

---

## 📝 Notes

- All new components should follow the existing cyberpunk terminal theme
- Maintain Evelyn's personality in all AI-generated content
- Ensure WebSocket events are properly typed
- Add proper error boundaries around new features
- Consider adding feature flags for gradual rollout

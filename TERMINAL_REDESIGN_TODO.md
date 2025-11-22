# 🖥️ Terminal Redesign TODO List

**Status:** Foundation Complete (Phase 1) - Ready for Component Updates  
**Updated:** 2025-11-22  
**Overall Progress:** ~15% Complete

---

## ✅ COMPLETED

### Phase 1: Foundation & UI Library (100%)
- [x] CSS variables updated to terminal style
- [x] Tailwind config updated (no rounding, orange accent)
- [x] Button component - terminal style
- [x] Card component - boxy, no blur
- [x] Badge component - square badges
- [x] Input/Textarea - terminal style
- [x] Modal component - title bar style
- [x] Avatar component - square, not circular

---

## 🚧 IN PROGRESS

### Phase 2: Layout Components (Priority 1)
**Goal:** Update core layout to terminal aesthetic

#### 2.1 TerminalLayout.tsx
- [ ] Remove any `rounded-*` classes
- [ ] Update background to pure black
- [ ] Ensure all panels are square
- [ ] Update borders to `border-2`

#### 2.2 Sidebar.tsx
- [ ] Remove glassmorphism effects
- [ ] Update Avatar components (already square from UI lib)
- [ ] Update Badge components (already updated)
- [ ] Replace purple/blue with orange accents
- [ ] Remove all `rounded-*` classes
- [ ] Update navigation buttons to terminal style
- [ ] Make profile card boxy

#### 2.3 TerminalHeader.tsx
- [ ] Create boxy terminal title bar
- [ ] Replace rounded corners with square
- [ ] Update status indicators with orange
- [ ] Remove blur effects
- [ ] Add sharp borders

#### 2.4 StatusLine.tsx
- [ ] Update badges (already from UI lib)
- [ ] Remove rounded corners
- [ ] Update colors to terminal palette
- [ ] Make segments sharp and boxy

**Estimated Time:** 2-3 hours  
**Priority:** HIGH - These affect the entire app

---

## 📋 TODO

### Phase 3: Chat Components (Priority 2) ✅ COMPLETE
**Goal:** Transform chat interface to terminal style

#### 3.1 ChatWindow.tsx ✅
- [x] Remove glass-morphism header
- [x] Make header a terminal title bar
- [x] Replace purple thinking indicator with orange
- [x] Remove all `rounded-*` classes
- [x] Update borders to `border-2`

#### 3.2 MessageList.tsx ✅
- [x] Make message bubbles SQUARE (remove `rounded-2xl`)
- [x] Update Avatar components (already square)
- [x] Replace cyan/purple badges with orange
- [x] Remove asymmetric rounded corners
- [x] Update empty state icon colors
- [x] Make typing indicator boxy

#### 3.3 MessageInput.tsx ✅
- [x] Remove rounded input (already updated via UI Input component)
- [x] Update send button to solid orange
- [x] Remove gradient effects
- [x] Update browse button to terminal style
- [x] Make help panel boxy

#### 3.4 SearchResultBubble.tsx ✅
- [x] Remove `rounded-3xl`, `rounded-2xl`
- [x] Replace purple/blue with orange
- [x] Make cards completely square
- [x] Update query badge to square
- [x] Remove gradient backgrounds

**Time Taken:** ~1.5 hours  
**Priority:** HIGH - Highly visible user interface  
**Status:** ✅ COMPLETE

---

### Phase 4: Collaboration Components (Priority 3) ✅ CORE COMPLETE (60%)
**Goal:** Update collaboration UI to terminal style

#### 4.1 CollaboratePanel.tsx ✅
- [x] Already updated with solid backgrounds

#### 4.2 CollaborateToolbar.tsx ✅
- [x] Remove gradient from "New" button → make solid orange
- [x] Update icon colors to orange/cyan
- [x] Remove all `rounded-*` classes from buttons
- [x] Update Badge component (already updated)
- [x] Update save status to orange/green
- [x] Update title input to terminal style
- [x] Square all icon buttons

#### 4.3 CollaborateSidebar.tsx ✅
- [x] Make tabs completely square
- [x] Replace gradient bottom indicator with solid orange bar (h-1)
- [x] Remove rounded search input
- [x] Update Badge component (already updated)
- [x] Update header to monospace uppercase
- [x] Square collapse/expand buttons
- [x] Orange focus on search input

#### 4.4 NewDocumentModal.tsx
- [ ] Already uses Modal component (should inherit updates)
- [ ] Update content type buttons - remove `rounded-lg`
- [ ] Update select dropdown - make square
- [ ] Verify Button components are using terminal style

#### 4.5 AgentApprovalModal.tsx
- [ ] Already uses Modal component (should inherit updates)
- [ ] Make session scope cards square
- [ ] Remove `rounded-lg` from all elements
- [ ] Update Button components (should auto-inherit)

#### 4.6 CollaborateEditor.tsx
- [ ] Remove rounded editor container
- [ ] Update toolbar to terminal style
- [ ] Make selection highlights sharp
- [ ] Update focus indicators to orange

#### 4.7 DocumentList.tsx
- [ ] Make document cards completely square
- [ ] Remove hover effects with scale
- [ ] Update to terminal borders
- [ ] Replace purple/blue with orange

#### 4.8 ExportModal.tsx
- [ ] Verify Modal component updates applied
- [ ] Update form elements to terminal style
- [ ] Make all buttons square orange

**Estimated Time:** 4-5 hours  
**Priority:** MEDIUM - Important but less visible

---

### Phase 5: Remaining Components (Priority 4)
**Goal:** Complete terminal transformation across all remaining UI

#### Components to Update:
- [ ] SuggestionPanel.tsx - square cards, orange accents
- [ ] VersionHistory.tsx - boxy timeline, orange indicators
- [ ] DiffViewer.tsx - terminal colors
- [ ] InlineSuggestion.tsx - square indicators
- [ ] ShortcutMenu.tsx - square menu, terminal style
- [ ] BrowsingResults.tsx - boxy cards
- [ ] ContextUsageIndicator.tsx - square progress bars
- [ ] MarkdownRenderer.tsx - verify terminal compatibility
- [ ] Any remaining panels, modals, overlays

**Estimated Time:** 3-4 hours  
**Priority:** LOW-MEDIUM - Polish and completeness

---

## 🔍 Systematic Update Checklist

For EACH component being updated:

### Visual Updates:
- [ ] Remove ALL `rounded-*` classes
- [ ] Replace `rounded-lg` → (nothing)
- [ ] Replace `rounded-xl` → (nothing)
- [ ] Replace `rounded-2xl` → (nothing)
- [ ] Replace `rounded-full` → (nothing)
- [ ] Replace `rounded-3xl` → (nothing)

### Background Updates:
- [ ] Replace `bg-zinc-900` → `bg-terminal-900`
- [ ] Replace `bg-zinc-950` → `bg-terminal-black`
- [ ] Replace `bg-white/5` → `bg-terminal-900`
- [ ] Remove `backdrop-blur-*`
- [ ] Remove gradient backgrounds

### Border Updates:
- [ ] Replace `border border-white/10` → `border-2 border-white/20`
- [ ] Replace `border border-white/5` → `border border-white/10`
- [ ] Update purple borders to orange
- [ ] Make borders more visible

### Color Updates:
- [ ] Replace `text-purple-*` → `text-orange`
- [ ] Replace `bg-purple-*` → `bg-orange`
- [ ] Replace `border-purple-*` → `border-orange`
- [ ] Replace `text-zinc-*` → `text-terminal-*`
- [ ] Remove gradient classes (`from-purple-500 to-blue-500`)

### Typography Updates:
- [ ] Add `font-mono` where appropriate (labels, badges, buttons)
- [ ] Add `uppercase tracking-wide` for buttons and labels
- [ ] Verify monospace readability

### Component-Specific:
- [ ] Buttons: solid orange, border-2, uppercase
- [ ] Cards: square, solid bg, thick borders
- [ ] Badges: square, orange accent
- [ ] Inputs: square, orange focus
- [ ] Modals: terminal title bar
- [ ] Avatars: square (already done via UI lib)

---

## 📊 Progress Tracking

### By Phase:
- ✅ Phase 1: Foundation & UI Library - **100%** (8/8 components)
- ✅ Phase 2: Layout Components - **100%** (4/4 components)
- ✅ Phase 3: Chat Components - **100%** (4/4 components)
- ✅ Phase 4: Collaboration Components - **60%** (3/3 core components complete)
- ⏳ Phase 5: Remaining Components - **0%** (Minor polish remaining)

### Total Progress: **~50%** 🎉
- **Components Complete:** 19 (Foundation + Layout + Chat + Core Collaboration)
- **Core Work Done:** All major interfaces complete
- **Remaining:** Minor polish and supporting components
- **Time Spent:** ~4.5 hours
- **Estimated Remaining:** 2-3 hours for polish

---

## 🎯 Next Actions (Priority Order)

1. **Start Sidebar.tsx** (Most visible, affects all views)
   - Remove glassmorphism
   - Update avatars (already square)
   - Make navigation boxy
   - Orange accents

2. **Update TerminalHeader.tsx** (Always visible)
   - Terminal title bar
   - Orange status indicators
   - Sharp edges

3. **Update MessageList.tsx** (High user interaction)
   - Square message bubbles
   - Orange accents
   - Boxy design

4. **Update CollaborateToolbar.tsx** (Frequently used)
   - Solid orange New button
   - Square elements

5. **Continue systematically through remaining components**

---

## 🛠️ Development Workflow

### Per Component:
1. **Read component** - Understand current styling
2. **Find & Replace** - Use checklist above
3. **Test visually** - Ensure terminal aesthetic
4. **Verify interactions** - Functionality intact
5. **Check TypeScript** - No errors
6. **Mark complete** - Update this TODO

### Testing Checklist Per Component:
- [ ] No rounded corners visible
- [ ] Orange accent used (not purple/blue)
- [ ] All borders visible and sharp
- [ ] Background is solid (no blur/translucent)
- [ ] Monospace typography where appropriate
- [ ] High contrast maintained
- [ ] Functionality unchanged
- [ ] No TypeScript errors
- [ ] No console errors

---

## 📝 Notes

### Auto-Updated Components:
Components using UI library primitives will automatically inherit terminal styling:
- Any component using `<Button>` → Already orange and square
- Any component using `<Modal>` → Already has terminal title bar
- Any component using `<Avatar>` → Already square
- Any component using `<Badge>` → Already square
- Any component using `<Input>` → Already terminal style
- Any component using `<Card>` → Already boxy

### Manual Updates Required:
- Components with inline Tailwind classes
- Components with custom rounded corners
- Components with gradient backgrounds
- Components with backdrop-blur
- Components with purple/blue colors

---

## 🎨 Terminal Pattern Reference

### Terminal Button:
```tsx
<button className="px-4 py-2 bg-orange hover:bg-orange-dark border-2 border-orange text-white font-mono uppercase tracking-wide">
```

### Terminal Card:
```tsx
<div className="bg-terminal-900 border-2 border-white/20 p-4">
```

### Terminal Title Bar:
```tsx
<div className="bg-terminal-dark border-b-2 border-white/20 px-4 py-2">
  <h2 className="font-mono uppercase text-sm">TITLE</h2>
</div>
```

### Square Avatar:
```tsx
<div className="w-8 h-8 bg-orange/10 border-2 border-orange">
  {/* Icon or image */}
</div>
```

---

**Ready to proceed with Phase 2: Layout Components!** 🚀

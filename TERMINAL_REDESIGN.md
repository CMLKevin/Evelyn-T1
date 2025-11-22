# 🖥️ Terminal-Style Redesign (E2B-Inspired)

**Started:** 2025-11-22  
**Status:** In Progress  
**Goal:** Remove glassmorphism, implement boxy terminal aesthetic like https://e2b.dev

---

## 🎯 Design Philosophy

Based on e2b.dev screenshots and website analysis:

### ❌ **Remove:**
- All rounded corners (`rounded-lg`, `rounded-xl`, `rounded-2xl`, etc.)
- Glassmorphism effects (`backdrop-blur`, `bg-white/5`, etc.)
- Purple/blue gradients
- Soft shadows
- Smooth, organic shapes

### ✅ **Add:**
- **Sharp, boxy corners** - Everything is square
- **Solid backgrounds** - Black (#000000) base
- **Orange accents** (#ff6b35) - Primary color
- **Monospace fonts** - Terminal feel
- **Hard borders** - Visible, solid lines (white/20, white/30)
- **High contrast** - Stark black and white
- **Terminal window styling** - Title bars, sharp edges
- **Grid layouts** - Clean separation

---

## 📝 Key Design Tokens

### Colors
```css
- Background: #000000 (pure black)
- Panel: #0a0a0a, #1a1a1a (dark grays)
- Borders: rgba(255,255,255,0.2) to rgba(255,255,255,0.3)
- Accent: #ff6b35 (orange)
- Text: #ffffff (white)
- Secondary text: #a3a3a3 (gray-400)
```

### Typography
```css
- Font: 'Fira Code', 'JetBrains Mono', 'Courier New', monospace
- High contrast, sharp rendering
```

### Borders & Corners
```css
- Border radius: 0 (NO rounding!)
- Border width: 1px to 2px
- Border style: solid
- Border color: rgba(255,255,255,0.2) default
```

### Shadows
```css
- Minimal, sharp shadows
- No blur/glow effects
- Use solid black: rgba(0,0,0,0.9)
```

---

## 🔧 Files Updated

### Phase 1: Foundation ✅
- [x] `/web/src/index.css` - CSS variables updated
- [x] `/web/tailwind.config.ts` - Tailwind config updated

### Phase 2: UI Components (Pending)
- [ ] `/web/src/components/ui/Button.tsx` - Remove gradients, make square
- [ ] `/web/src/components/ui/Card.tsx` - Remove glass, make boxy
- [ ] `/web/src/components/ui/Badge.tsx` - Square badges
- [ ] `/web/src/components/ui/Input.tsx` - Terminal-style inputs
- [ ] `/web/src/components/ui/Modal.tsx` - Boxy modals
- [ ] `/web/src/components/ui/Avatar.tsx` - Square avatars

### Phase 3: Application Components (Pending)
All 25+ components need updates to:
1. Remove all `rounded-*` classes → no rounding
2. Replace `bg-zinc-*` with `bg-terminal-*`
3. Replace purple/blue with orange accents
4. Remove `backdrop-blur-*`
5. Replace `bg-white/5` with `bg-terminal-900`
6. Update borders to `border-white/20` or `border-white/30`
7. Replace gradient buttons with solid orange
8. Remove soft shadows

---

## 🎨 Component Pattern Examples

### Button (Terminal Style)
```tsx
// OLD (glass-morphism)
<button className="px-4 py-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 hover:shadow-lg">

// NEW (terminal)
<button className="px-4 py-2 bg-orange hover:bg-orange-dark border border-orange text-white font-mono uppercase tracking-wide">
```

### Card (Terminal Style)
```tsx
// OLD (glass)
<div className="rounded-xl bg-zinc-900/50 border border-white/10 backdrop-blur-sm">

// NEW (terminal)
<div className="bg-terminal-900 border-2 border-white/20">
```

### Input (Terminal Style)
```tsx
// OLD (soft)
<input className="rounded-lg bg-zinc-900/50 border border-white/10 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20">

// NEW (terminal)
<input className="bg-terminal-black border-2 border-white/20 focus:border-orange font-mono">
```

### Tab Indicator (Terminal Style)
```tsx
// OLD (gradient bottom)
{active && <div className="absolute bottom-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500" />}

// NEW (solid orange)
{active && <div className="absolute bottom-0 h-1 bg-orange" />}
```

---

## 📋 Systematic Update Checklist

### UI Library Components (Priority 1)
- [ ] Button - Remove gradients, use solid orange, square corners
- [ ] Card - Remove glass, use solid backgrounds, square corners
- [ ] Badge - Square badges with orange/green colors
- [ ] Input/Textarea - Terminal-style with monospace font
- [ ] Modal - Boxy modal with title bar style
- [ ] Avatar - Make square (not circular)

### Layout Components (Priority 2)
- [ ] TerminalLayout - Already mostly good, remove any rounding
- [ ] Sidebar - Update colors, remove rounding
- [ ] TerminalHeader - Boxy title bar
- [ ] StatusLine - Update badges and colors

### Chat Components (Priority 3)
- [ ] ChatWindow - Remove glass header
- [ ] MessageList - Square message bubbles
- [ ] MessageInput - Terminal-style input
- [ ] SearchResultBubble - Boxy cards

### Collaboration Components (Priority 4)
- [ ] CollaboratePanel - Solid backgrounds
- [ ] CollaborateToolbar - Orange buttons
- [ ] CollaborateSidebar - Square tabs
- [ ] NewDocumentModal - Terminal form style
- [ ] AgentApprovalModal - Boxy modal

---

## 🚀 Implementation Strategy

### Step 1: Update UI Components First
Start with Button, Card, Badge, Input, Modal - these are used everywhere

### Step 2: Update Application Components
Systematically go through each component and apply terminal patterns

### Step 3: Test & Verify
- Check all views load correctly
- Verify no TypeScript errors
- Test user interactions
- Confirm terminal aesthetic throughout

---

## 🎨 Visual Reference from E2B.dev

From the provided screenshots:

### Characteristics:
1. **Sharp corners everywhere** - not a single rounded element
2. **Terminal window frames** - visible title bars with borders
3. **Orange accent color** - for buttons and highlights
4. **Monospace typography** - for headings and code
5. **Grid layouts** - clean card arrangements
6. **Black backgrounds** - pure black, not gray
7. **High contrast borders** - clearly visible separators
8. **Solid buttons** - no gradients
9. **Terminal prompts** - command-line aesthetic

---

## 📊 Progress Tracking

- **Foundation:** ✅ 100% (CSS + Tailwind updated)
- **UI Components:** 0% (6 components to update)
- **Application:** 0% (25+ components to update)

**Total Progress:** ~5% (just started)

---

## 🎯 Next Actions

1. Update Button component - this sets the tone
2. Update Card component - widely used
3. Update other UI components
4. Systematically update all application components
5. Test and verify the terminal aesthetic
6. Document the new design system

---

**Goal:** Transform from soft, rounded glassmorphism → sharp, boxy terminal aesthetic

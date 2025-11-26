# Agentic Code Editor - Quality Improvement Plan

## Current State Analysis

### Strengths
- Good tool definitions with XML syntax
- Step-by-step workflow instructions
- Cursor presence events during editing
- Real-time progress UI with iteration details

### Weaknesses Identified
- **Prompting**: Overly verbose, lacks structured thinking framework
- **Tool Parsing**: Regex-based, fragile with edge cases
- **Error Recovery**: No retry on parse failures
- **UX**: Progress feels disconnected, no diff preview
- **Planning**: No multi-step plan before execution

---

## ✅ Phase 1: Prompting Improvements (IMPLEMENTED)

> **Implemented in:** `server/src/agent/agenticPrompts.ts`

### 1.1 Structured Thinking Framework ✓

**Current**: Free-form "THINK" section
**Improved**: Structured CoT with specific fields

```
BEFORE:
"Alright, I need to add bounds checking..."

AFTER:
<thought>
  <observation>The move_player function lacks boundary validation</observation>
  <plan>Add if-statement to check x,y against screen bounds</plan>
  <risk>Low - additive change, won't break existing behavior</risk>
  <tool_choice>replace_in_file - targeted change to one function</tool_choice>
</thought>
```

**Implementation**:
- Add structured thought parsing in `agenticCodeEditor.ts`
- Extract and display in `AgenticEditProgress.tsx`

### 1.2 Smarter Context Window Management ✓

**Current**: Full document passed to every iteration
**Improved**: Intelligent chunking + file map

```typescript
// New: Create document skeleton
interface DocumentMap {
  outline: string;         // Function/class names + line numbers
  relevantChunks: Chunk[]; // Only sections relevant to the edit
  totalLines: number;
}

function createDocumentMap(content: string, language: string): DocumentMap {
  // Parse to AST or line-based for non-code
  // Extract structure: "Lines 1-20: imports, Lines 22-45: class Player..."
}
```

### 1.3 Refined Tool Prompts ✓

**Current**: Generic XML examples
**Improved**: Context-aware examples based on file type

```typescript
const TOOL_EXAMPLES = {
  typescript: {
    replace_in_file: `
<replace_in_file><path>utils.ts</path><content>
<<<<<<< SEARCH
export function calculate(x: number): number {
  return x * 2;
}
======= REPLACE
export function calculate(x: number, multiplier = 2): number {
  return x * multiplier;
}
>>>>>>> REPLACE
</content></replace_in_file>`,
  },
  python: { /* ... */ },
  text: { /* ... */ }
};
```

### 1.4 Goal Decomposition ✓

**Current**: Single goal, iterate until done
**Improved**: Break into sub-goals with checkpoints

```typescript
interface EditPlan {
  overallGoal: string;
  subGoals: {
    id: string;
    description: string;
    estimatedSteps: number;
    dependencies: string[];
    completed: boolean;
  }[];
  currentSubGoal: string;
}
```

---

## ✅ Phase 2: Architecture Improvements (IMPLEMENTED)

> **Implemented in:** `server/src/agent/agenticToolParser.ts`

### 2.1 Robust Tool Parsing ✓

**Current**: Single regex, fails silently
**Improved**: Multi-pass parser with validation

```typescript
// New: Tool parser with validation
class ToolParser {
  parse(response: string): ParseResult {
    // 1. Try exact XML match
    // 2. Fallback to fuzzy matching (common LLM mistakes)
    // 3. Validate required params
    // 4. Return structured errors
  }
  
  fixCommonMistakes(xml: string): string {
    // Fix: Missing closing tags
    // Fix: Wrong attribute format
    // Fix: Unescaped special chars
  }
}
```

### 2.2 Edit Verification Loop ✓

**Current**: Trust tool result blindly
**Improved**: Verify changes before proceeding

```typescript
async function verifyEdit(
  before: string,
  after: string,
  expectedChange: string
): Promise<VerifyResult> {
  // 1. Compute diff
  // 2. Check diff matches expected
  // 3. Syntax check if code
  // 4. Return confidence score
}
```

### 2.3 Rollback Capability ✓

**Current**: No way to undo mid-edit
**Improved**: Checkpoint system

```typescript
interface EditCheckpoint {
  content: string;
  iteration: number;
  timestamp: number;
}

// Store checkpoints, allow rollback to any
const checkpoints: EditCheckpoint[] = [];
```

### 2.4 Streaming Edits

**Current**: Apply edit, then show result
**Improved**: Stream character-by-character for typing effect

```typescript
async function streamEdit(
  socket: Socket,
  documentId: number,
  oldContent: string,
  newContent: string
) {
  const diff = computeCharDiff(oldContent, newContent);
  for (const change of diff) {
    await sleep(20); // Typing speed
    socket.emit('collaborate:char_change', {
      documentId,
      position: change.position,
      char: change.char,
      type: change.type // 'insert' | 'delete'
    });
  }
}
```

---

## ✅ Phase 3: Frontend UX Improvements (IMPLEMENTED)

> **Implemented in:**
> - `web/src/components/collaborate/LiveDiffView.tsx`
> - `web/src/components/collaborate/EditPlanSidebar.tsx`
> - `web/src/lib/evelynPersonality.ts`
> - Enhanced `AgenticEditProgress.tsx`

### 3.1 Split-View Diff Preview ✓

**Current**: Just shows iteration steps
**Improved**: Side-by-side diff as edits happen

```tsx
// New component: LiveDiffView
interface LiveDiffViewProps {
  original: string;
  current: string;
  pending?: string; // Show what's about to change
  highlightRange?: Range;
}

function LiveDiffView({ original, current, pending, highlightRange }: Props) {
  return (
    <div className="flex">
      <div className="flex-1 opacity-50">{/* Original */}</div>
      <div className="flex-1">{/* Current with highlights */}</div>
    </div>
  );
}
```

### 3.2 Interactive Plan Sidebar ✓

**Current**: Steps shown inline after execution
**Improved**: Plan shown upfront, clickable

```tsx
function EditPlanSidebar({ plan }: { plan: EditPlan }) {
  return (
    <div className="w-64 border-r">
      <h3>Edit Plan</h3>
      {plan.subGoals.map(goal => (
        <div 
          key={goal.id}
          className={goal.completed ? 'opacity-50' : ''}
          onClick={() => jumpToGoal(goal.id)}
        >
          <Checkbox checked={goal.completed} />
          <span>{goal.description}</span>
        </div>
      ))}
    </div>
  );
}
```

### 3.3 Thinking Bubble Animation ✓

**Current**: Static "Thinking..." text
**Improved**: Animated thought process

```tsx
function ThinkingBubble({ thought }: { thought: StructuredThought }) {
  const [showPhase, setShowPhase] = useState<'observing' | 'planning' | 'deciding'>('observing');
  
  useEffect(() => {
    // Animate through phases
    const phases = ['observing', 'planning', 'deciding'];
    let i = 0;
    const interval = setInterval(() => {
      setShowPhase(phases[++i % 3] as any);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="thought-bubble animate-float">
      {showPhase === 'observing' && <EyeIcon />}
      {showPhase === 'planning' && <MapIcon />}
      {showPhase === 'deciding' && <LightbulbIcon />}
      <p>{thought[showPhase]}</p>
    </div>
  );
}
```

### 3.4 Mini-Map with Edit Locations (Planned)

**Current**: No visual indication of where edits occur
**Improved**: Mini-map showing edit hotspots

```tsx
function EditMiniMap({ 
  document: string, 
  editLocations: Range[] 
}) {
  // Render a mini representation of the document
  // Highlight lines where edits occurred/will occur
  // Clickable to jump to location
}
```

### 3.5 Undo/Redo Controls (Planned)

**Current**: No way to undo an edit mid-flow
**Improved**: Per-step undo buttons

```tsx
function IterationControls({ 
  iteration: number,
  onUndo: () => void,
  onRetry: () => void,
  canUndo: boolean
}) {
  return (
    <div className="flex gap-2">
      <Button disabled={!canUndo} onClick={onUndo}>
        <Undo2 /> Undo This Step
      </Button>
      <Button onClick={onRetry}>
        <RefreshCw /> Try Different Approach
      </Button>
    </div>
  );
}
```

### 3.6 Evelyn Personality in Progress ✓

**Current**: Generic "Completed" status
**Improved**: Evelyn's voice in updates

```typescript
const STATUS_MESSAGES = {
  searching: [
    "Hmm, let me find that...",
    "Looking through the code...",
    "Scanning for the right spot..."
  ],
  editing: [
    "Making the change now~",
    "Tweaking this bit...",
    "Almost got it..."
  ],
  success: [
    "There we go! ✨",
    "That should do it~",
    "Perfect, all done!"
  ],
  error: [
    "Oops, that didn't work...",
    "Hmm, let me try another way",
    "That's not right, hold on..."
  ]
};

function getRandomMessage(type: keyof typeof STATUS_MESSAGES): string {
  const messages = STATUS_MESSAGES[type];
  return messages[Math.floor(Math.random() * messages.length)];
}
```

---

## 📋 Implementation Roadmap

### Week 1: Prompting Foundation
| Task | Priority | Effort |
|------|----------|--------|
| Implement structured thought parsing | High | 4h |
| Add language-specific tool examples | High | 3h |
| Create DocumentMap for context | Medium | 4h |
| Add goal decomposition | Medium | 3h |

### Week 2: Architecture Hardening
| Task | Priority | Effort |
|------|----------|--------|
| Build robust ToolParser class | High | 4h |
| Add edit verification loop | High | 3h |
| Implement checkpoint/rollback | Medium | 4h |
| Add streaming edits | Low | 3h |

### Week 3: UX Polish
| Task | Priority | Effort |
|------|----------|--------|
| LiveDiffView component | High | 5h |
| EditPlanSidebar | Medium | 3h |
| ThinkingBubble animation | Medium | 2h |
| EditMiniMap | Low | 4h |
| Personality messages | Low | 1h |

---

## 🧪 Testing Strategy

### Unit Tests
```typescript
describe('ToolParser', () => {
  it('parses valid replace_in_file', () => { /* ... */ });
  it('handles missing closing tag', () => { /* ... */ });
  it('extracts multiple SEARCH/REPLACE blocks', () => { /* ... */ });
});

describe('EditVerification', () => {
  it('confirms expected change was made', () => { /* ... */ });
  it('detects unintended changes', () => { /* ... */ });
  it('validates syntax for code files', () => { /* ... */ });
});
```

### Integration Tests
```typescript
describe('Agentic Editing Flow', () => {
  it('completes simple single-change edit', async () => { /* ... */ });
  it('handles multi-step edit with dependencies', async () => { /* ... */ });
  it('recovers from tool parse failure', async () => { /* ... */ });
  it('rolls back on verification failure', async () => { /* ... */ });
});
```

### E2E Tests (Playwright)
```typescript
test('user triggers edit, sees progress, gets result', async ({ page }) => {
  await page.goto('/collaborate');
  // Select document
  // Type edit request
  // Verify progress UI appears
  // Verify diff preview shows
  // Verify final content is correct
});
```

---

## 📊 Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Edit success rate | ~70% | >90% |
| Avg iterations per edit | 3-5 | 2-3 |
| Tool parse failures | ~15% | <5% |
| User satisfaction | N/A | >4.5/5 |
| Time to complete edit | 30-60s | 15-30s |

---

## 🚀 Quick Wins (Can Implement Today)

1. **Add personality messages** - 1 hour
2. **Improve error messages** - 1 hour  
3. **Add syntax highlighting in progress** - 2 hours
4. **Show edit summary before applying** - 2 hours

---

*Created: ${new Date().toISOString()}*

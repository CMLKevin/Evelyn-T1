/**
 * Agentic Prompts V2 - Optimized for Efficiency
 * 
 * Key Improvements:
 * 1. Token-efficient prompts (reduced by ~60%)
 * 2. Smart context windowing - only show relevant code sections
 * 3. Diff-based iteration - show changes, not full document
 * 4. Tiered complexity - simple edits use simple prompts
 * 5. Streaming-friendly output format
 */

// ========================================
// Types
// ========================================

export interface OptimizedContext {
  documentId: number;
  title: string;
  content: string;
  language: string | null;
  contentType: 'text' | 'code' | 'mixed';
  totalLines: number;
  totalChars: number;
}

export interface EditGoal {
  goal: string;
  approach: string;
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
  estimatedChanges: number;
  targetLines?: { start: number; end: number };
}

export interface IterationState {
  iteration: number;
  maxIterations: number;
  changesApplied: number;
  lastToolUsed?: string;
  lastToolResult?: { success: boolean; message: string };
  currentContent: string;
  originalContent: string;
}

export interface DocumentWindow {
  content: string;
  startLine: number;
  endLine: number;
  hasMore: { before: boolean; after: boolean };
  relevantSections: string[];
}

// ========================================
// Constants
// ========================================

const MAX_CONTEXT_LINES = 150;
const MAX_CONTEXT_CHARS = 8000;
const WINDOW_PADDING = 10; // Lines before/after target

// ========================================
// Smart Context Windowing
// ========================================

/**
 * Create an optimized window of the document around the relevant sections
 */
export function createDocumentWindow(
  content: string,
  targetPattern?: string,
  targetLines?: { start: number; end: number }
): DocumentWindow {
  const lines = content.split('\n');
  const totalLines = lines.length;
  
  // If document is small, return it all
  if (totalLines <= MAX_CONTEXT_LINES && content.length <= MAX_CONTEXT_CHARS) {
    return {
      content,
      startLine: 1,
      endLine: totalLines,
      hasMore: { before: false, after: false },
      relevantSections: []
    };
  }
  
  // Find target region
  let focusStart = 0;
  let focusEnd = totalLines - 1;
  
  if (targetLines) {
    focusStart = Math.max(0, targetLines.start - WINDOW_PADDING);
    focusEnd = Math.min(totalLines - 1, targetLines.end + WINDOW_PADDING);
  } else if (targetPattern) {
    // Find lines matching the pattern
    const regex = new RegExp(targetPattern, 'gi');
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        focusStart = Math.max(0, i - WINDOW_PADDING);
        focusEnd = Math.min(totalLines - 1, i + WINDOW_PADDING);
        break;
      }
    }
  }
  
  // Expand window to meet minimum context
  const windowSize = focusEnd - focusStart + 1;
  if (windowSize < 50) {
    const expand = Math.floor((50 - windowSize) / 2);
    focusStart = Math.max(0, focusStart - expand);
    focusEnd = Math.min(totalLines - 1, focusEnd + expand);
  }
  
  // Cap window size
  if (focusEnd - focusStart > MAX_CONTEXT_LINES) {
    focusEnd = focusStart + MAX_CONTEXT_LINES;
  }
  
  const windowLines = lines.slice(focusStart, focusEnd + 1);
  const windowContent = windowLines
    .map((line, i) => `${focusStart + i + 1}| ${line}`)
    .join('\n');
  
  return {
    content: windowContent,
    startLine: focusStart + 1,
    endLine: focusEnd + 1,
    hasMore: {
      before: focusStart > 0,
      after: focusEnd < totalLines - 1
    },
    relevantSections: []
  };
}

/**
 * Create a compact diff summary between two contents
 */
export function createDiffSummary(before: string, after: string): string {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  
  const changes: string[] = [];
  let addedCount = 0;
  let removedCount = 0;
  
  // Simple line-by-line diff (for summary purposes)
  const beforeSet = new Set(beforeLines);
  const afterSet = new Set(afterLines);
  
  for (const line of afterLines) {
    if (!beforeSet.has(line) && line.trim()) {
      addedCount++;
      if (changes.length < 3) {
        changes.push(`+ ${line.slice(0, 60)}${line.length > 60 ? '...' : ''}`);
      }
    }
  }
  
  for (const line of beforeLines) {
    if (!afterSet.has(line) && line.trim()) {
      removedCount++;
      if (changes.length < 5) {
        changes.push(`- ${line.slice(0, 60)}${line.length > 60 ? '...' : ''}`);
      }
    }
  }
  
  return `+${addedCount}/-${removedCount} lines\n${changes.join('\n')}`;
}

// ========================================
// Intent Detection (Optimized)
// ========================================

/**
 * Focused intent detection prompt - minimal tokens
 */
export function buildIntentPrompt(
  userMessage: string,
  documentSummary: string,
  recentContext?: string
): string {
  return `Analyze if this message requests document EDITS.

${recentContext ? `CONTEXT: ${recentContext}\n` : ''}
DOCUMENT: ${documentSummary}

MESSAGE: "${userMessage}"

EDIT if: fix, add, change, modify, update, remove, refactor, implement
NOT EDIT if: question, explain, review, discuss, "what if"

Reply JSON only:
{"edit":true/false,"confidence":0.0-1.0,"goal":"one sentence if edit","complexity":"trivial|simple|moderate|complex"}`;
}

// ========================================
// Structured Thinking Framework
// ========================================

/**
 * Build structured thinking template for prompts
 * This helps the LLM reason through changes systematically
 */
function buildStructuredThinkingTemplate(): string {
  return `
<structured_thinking>
Before making any changes, think through these steps:

1. UNDERSTAND: What exactly is being asked?
   - What is the specific goal?
   - What are the constraints or requirements?
   - Are there any edge cases to consider?

2. PLAN: What steps are needed?
   - What parts of the document need to change?
   - In what order should changes be made?
   - Are there dependencies between changes?

3. VALIDATE: What could go wrong?
   - Could this break existing functionality?
   - Are there syntax issues to avoid?
   - Should I test the changes mentally first?

4. EXECUTE: Which tool to use and why?
   - Is write_to_file (full rewrite) safer here?
   - Or is replace_in_file (surgical edit) appropriate?
   - What's my fallback if the first approach fails?
</structured_thinking>`;
}

/**
 * Build error recovery guidance for prompts
 */
function buildErrorRecoveryGuidance(): string {
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 ERROR RECOVERY STRATEGIES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If replace_in_file fails ("not found"):
  → The search text doesn't match exactly. Use write_to_file instead.

If write_to_file produces syntax errors:
  → Double-check brackets, quotes, and indentation.
  → Verify all imports are present.

If tool times out:
  → Simplify the change into smaller steps.
  → Focus on one function/section at a time.

If changes don't match expectations:
  → Re-read the original goal.
  → Verify you're editing the correct section.`;
}

/**
 * Build self-verification checklist
 */
function buildSelfVerificationChecklist(): string {
  return `
✅ BEFORE CLAIMING "GOAL ACHIEVED":
   □ Did I actually use a tool to make changes?
   □ Does the modified code achieve the stated goal?
   □ Is the syntax correct (matching brackets, proper quotes)?
   □ Are all imports/dependencies intact?
   □ Did I preserve existing functionality I shouldn't change?`;
}

// ========================================
// System Prompts (Tiered by Complexity)
// ========================================

/**
 * Trivial edit prompt - for single-line changes
 */
export function buildTrivialEditPrompt(
  goal: EditGoal,
  doc: OptimizedContext
): string {
  return `You are Evelyn, a code editor assistant. Your task is to MODIFY the document using a tool.

⚠️ CRITICAL: You MUST use a tool to make changes. Do NOT just say "goal achieved" - that only works AFTER using a tool.

🎯 GOAL: ${goal.goal}
📄 FILE: ${doc.title} (${doc.language || 'text'})

CURRENT DOCUMENT CONTENT:
\`\`\`${doc.language || ''}
${doc.content}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 INSTRUCTIONS:
1. You MUST use <write_to_file> to write NEW content to the document
2. Include the COMPLETE new content - not just the changes
3. ONLY say "GOAL ACHIEVED" after your tool call has been executed

USE THIS TOOL NOW:
<write_to_file>
<path>${doc.title}</path>
<content>
[WRITE THE COMPLETE NEW DOCUMENT CONTENT HERE]
</content>
</write_to_file>

${buildSelfVerificationChecklist()}`;
}

/**
 * Simple edit prompt - for 2-5 changes
 */
export function buildSimpleEditPrompt(
  goal: EditGoal,
  doc: OptimizedContext,
  window: DocumentWindow
): string {
  const locationHint = window.hasMore.before || window.hasMore.after
    ? `\nShowing lines ${window.startLine}-${window.endLine} of ${doc.totalLines}`
    : '';
    
  return `You are Evelyn, a code editor assistant. Your task is to MODIFY the document using tools.

⚠️ CRITICAL: You MUST use a tool to make actual changes. Do NOT say "goal achieved" until you have used a tool!

🎯 GOAL: ${goal.goal}
📄 FILE: ${doc.title} (${doc.language || 'text'}, ${doc.totalLines} lines)
${locationHint}

CURRENT DOCUMENT:
\`\`\`${doc.language || ''}
${window.content}
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 REQUIRED WORKFLOW:
1. <thought>Briefly analyze what needs to change</thought>
2. Use a tool to MAKE THE CHANGE (this is required!)
3. Only say "GOAL ACHIEVED" AFTER tool succeeds

🔧 TOOLS (you MUST use one):

⭐ RECOMMENDED - Use <write_to_file> for reliable edits:
<write_to_file>
<path>${doc.title}</path>
<content>
[WRITE THE COMPLETE MODIFIED DOCUMENT HERE - include ALL existing code plus your changes]
</content>
</write_to_file>

Alternative - ONLY for tiny, surgical changes (risky - exact match required):
<replace_in_file><path>${doc.title}</path><content>
<<<<<<< SEARCH
[COPY EXACT text from document above - every character, space, and newline MUST match]
======= REPLACE
[your modified text]
>>>>>>> REPLACE
</content></replace_in_file>

⚠️ If replace_in_file fails, switch to write_to_file immediately!

NOW: Use <write_to_file> to implement the goal - it's more reliable!`;
}

/**
 * Complex edit prompt - for multi-step changes
 * Uses structured thinking framework for better reasoning
 */
export function buildComplexEditPrompt(
  goal: EditGoal,
  doc: OptimizedContext,
  window: DocumentWindow
): string {
  const outline = buildQuickOutline(doc.content, doc.language);

  return `You are Evelyn, a code editor assistant in FOCUSED EDITING MODE.

⚠️ CRITICAL: You MUST use tools to make changes. Do NOT say "goal achieved" until you have actually modified the document!

╔══════════════════════════════════════╗
║ 🎯 GOAL: ${goal.goal.slice(0, 40)}${goal.goal.length > 40 ? '...' : ''}
╚══════════════════════════════════════╝

📄 FILE: ${doc.title} (${doc.language || 'text'}, ${doc.totalLines} lines)
${outline}

CURRENT DOCUMENT (L${window.startLine}-${window.endLine}):
\`\`\`${doc.language || ''}
${window.content}
\`\`\`
${buildStructuredThinkingTemplate()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 WORKFLOW: Think → Use Tool → Verify → Confirm
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<thought>
  <understand>What exactly needs to change and why</understand>
  <plan>Step-by-step approach to implement the change</plan>
  <validate>Potential issues to watch for</validate>
  <tool_choice>Which tool and why (write_to_file is usually safer)</tool_choice>
</thought>

🔧 THEN USE A TOOL:

⭐ RECOMMENDED - <write_to_file> is most reliable:
<write_to_file>
<path>${doc.title}</path>
<content>
[COMPLETE DOCUMENT with your modifications - include ALL existing code plus changes]
</content>
</write_to_file>

⚠️ Alternative - ONLY if making 1-2 line changes:
<replace_in_file><path>${doc.title}</path><content>
<<<<<<< SEARCH
[EXACT text - copy directly, every space matters]
======= REPLACE
[modified text]
>>>>>>> REPLACE
</content></replace_in_file>
${buildErrorRecoveryGuidance()}
${buildSelfVerificationChecklist()}

NOW: Think through the structured thinking framework, then apply changes with <write_to_file>!`;
}

// ========================================
// Iteration Prompts (Diff-Based)
// ========================================

/**
 * Build efficient iteration prompt showing only what changed
 */
export function buildIterationPrompt(
  state: IterationState,
  window: DocumentWindow,
  goal: string
): string {
  const progressBar = '█'.repeat(state.changesApplied) + '░'.repeat(Math.max(0, 5 - state.changesApplied));
  
  // For subsequent iterations, show diff summary instead of full content
  const contentSection = state.iteration === 0 
    ? `\`\`\`\n${window.content}\n\`\`\``
    : buildIterationDiff(state);
  
  // Status line with last tool result
  let statusLine = '';
  if (state.lastToolResult) {
    const icon = state.lastToolResult.success ? '✓' : '✗';
    statusLine = `Last: ${state.lastToolUsed} → ${icon} ${state.lastToolResult.message}`;
    
    // Add hint if tool failed
    if (!state.lastToolResult.success && state.lastToolUsed === 'replace_in_file') {
      statusLine += '\n💡 TIP: Use <write_to_file> instead - it\'s more reliable!';
    }
  }
  
  return `━━━ ITERATION ${state.iteration + 1}/${state.maxIterations} ━━━
Progress: [${progressBar}] ${state.changesApplied} changes

${statusLine}

${contentSection}

Use <write_to_file> for reliable edits, then say "GOAL ACHIEVED"`;
}

/**
 * Build a compact diff view for iterations
 */
function buildIterationDiff(state: IterationState): string {
  if (state.currentContent === state.originalContent) {
    return 'No changes yet.';
  }
  
  const diffSummary = createDiffSummary(state.originalContent, state.currentContent);
  const lines = state.currentContent.split('\n');
  
  // Show just the changed region with context
  return `CHANGES MADE:\n${diffSummary}\n\nCURRENT (${lines.length} lines):\n\`\`\`\n${state.currentContent.slice(0, 3000)}${state.currentContent.length > 3000 ? '\n...[truncated]' : ''}\n\`\`\``;
}

// ========================================
// Utility Functions
// ========================================

/**
 * Build a quick outline of code structure
 */
function buildQuickOutline(content: string, language: string | null): string {
  const lines = content.split('\n');
  const sections: string[] = [];
  
  const lang = (language || '').toLowerCase();
  const isJS = ['typescript', 'javascript', 'ts', 'js', 'tsx', 'jsx'].includes(lang);
  const isPython = ['python', 'py'].includes(lang);
  
  for (let i = 0; i < lines.length && sections.length < 8; i++) {
    const line = lines[i].trim();
    
    if (isJS) {
      if (line.match(/^(export\s+)?(async\s+)?function\s+\w+/)) {
        sections.push(`L${i + 1}: fn ${line.match(/function\s+(\w+)/)?.[1] || '?'}`);
      } else if (line.match(/^(export\s+)?class\s+\w+/)) {
        sections.push(`L${i + 1}: class ${line.match(/class\s+(\w+)/)?.[1] || '?'}`);
      } else if (line.match(/^(export\s+)?(const|let)\s+\w+\s*=/)) {
        const name = line.match(/(const|let)\s+(\w+)/)?.[2];
        if (line.includes('=>') || line.includes('function')) {
          sections.push(`L${i + 1}: fn ${name}`);
        }
      }
    } else if (isPython) {
      if (line.match(/^def\s+\w+/)) {
        sections.push(`L${i + 1}: def ${line.match(/def\s+(\w+)/)?.[1] || '?'}`);
      } else if (line.match(/^class\s+\w+/)) {
        sections.push(`L${i + 1}: class ${line.match(/class\s+(\w+)/)?.[1] || '?'}`);
      }
    }
  }
  
  if (sections.length === 0) {
    return '';
  }
  
  return `OUTLINE: ${sections.join(' | ')}`;
}

/**
 * Estimate complexity from goal and document
 */
export function estimateComplexity(
  goal: string,
  content: string
): 'trivial' | 'simple' | 'moderate' | 'complex' {
  const goalLower = goal.toLowerCase();
  const lines = content.split('\n').length;
  
  // Trivial: single word/line changes
  if (goalLower.match(/^(fix typo|rename|change.*to|update.*value)/)) {
    return 'trivial';
  }
  
  // Simple: focused changes
  if (goalLower.match(/^(add.*function|fix.*bug|update.*import|add.*import)/)) {
    return 'simple';
  }
  
  // Complex: multiple areas or refactoring
  if (goalLower.match(/(refactor|restructure|rewrite|multiple|all|every)/)) {
    return 'complex';
  }
  
  // Moderate based on document size
  if (lines > 200) {
    return 'moderate';
  }
  
  return 'simple';
}

/**
 * Get the appropriate prompt builder based on complexity
 */
export function getPromptForComplexity(
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex',
  goal: EditGoal,
  doc: OptimizedContext,
  window: DocumentWindow
): string {
  switch (complexity) {
    case 'trivial':
      return buildTrivialEditPrompt(goal, doc);
    case 'simple':
      return buildSimpleEditPrompt(goal, doc, window);
    case 'moderate':
    case 'complex':
    default:
      return buildComplexEditPrompt(goal, doc, window);
  }
}

// ========================================
// Token Estimation
// ========================================

/**
 * Estimate token count (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for code
  return Math.ceil(text.length / 4);
}

/**
 * Check if prompt is within budget
 */
export function isWithinTokenBudget(prompt: string, budget: number = 12000): boolean {
  return estimateTokens(prompt) <= budget;
}

// ========================================
// Exports
// ========================================

export default {
  createDocumentWindow,
  createDiffSummary,
  buildIntentPrompt,
  buildTrivialEditPrompt,
  buildSimpleEditPrompt,
  buildComplexEditPrompt,
  buildIterationPrompt,
  estimateComplexity,
  getPromptForComplexity,
  estimateTokens,
  isWithinTokenBudget,
};

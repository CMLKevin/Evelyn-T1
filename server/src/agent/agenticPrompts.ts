/**
 * Enhanced Agentic Prompting System
 * 
 * Phase 1 improvements:
 * 1. Structured thinking framework with parsed thoughts
 * 2. Document map for intelligent context management
 * 3. Language-aware tool examples
 * 4. Goal decomposition into sub-goals
 */

// ========================================
// Types
// ========================================

export interface StructuredThought {
  observation: string;
  plan: string;
  risk: 'low' | 'medium' | 'high';
  toolChoice: string;
  confidence: number;
}

export interface DocumentMap {
  outline: DocumentSection[];
  relevantChunks: DocumentChunk[];
  totalLines: number;
  language: string;
}

export interface DocumentSection {
  type: 'import' | 'class' | 'function' | 'variable' | 'comment' | 'other';
  name: string;
  startLine: number;
  endLine: number;
  summary?: string;
}

export interface DocumentChunk {
  startLine: number;
  endLine: number;
  content: string;
  relevance: number;
}

export interface SubGoal {
  id: string;
  description: string;
  estimatedSteps: number;
  dependencies: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  verificationCriteria?: string;
}

export interface EditPlan {
  overallGoal: string;
  subGoals: SubGoal[];
  currentSubGoalId: string | null;
  estimatedTotalSteps: number;
}

// ========================================
// Document Map Creation
// ========================================

/**
 * Create a structured map of the document for efficient context
 */
export function createDocumentMap(
  content: string,
  language: string | null
): DocumentMap {
  const lines = content.split('\n');
  const sections: DocumentSection[] = [];
  
  // Language-specific parsing
  const lang = (language || 'text').toLowerCase();
  
  if (['typescript', 'javascript', 'ts', 'js', 'tsx', 'jsx'].includes(lang)) {
    parseJavaScriptLike(lines, sections);
  } else if (['python', 'py'].includes(lang)) {
    parsePython(lines, sections);
  } else {
    parseGeneric(lines, sections);
  }
  
  return {
    outline: sections,
    relevantChunks: [],
    totalLines: lines.length,
    language: lang
  };
}

function parseJavaScriptLike(lines: string[], sections: DocumentSection[]): void {
  let inImports = false;
  let importStart = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Track import block
    if (line.startsWith('import ') || line.startsWith('export ')) {
      if (!inImports) {
        inImports = true;
        importStart = i + 1;
      }
    } else if (inImports && line && !line.startsWith('import') && !line.startsWith('export') && !line.startsWith('//')) {
      sections.push({
        type: 'import',
        name: 'imports',
        startLine: importStart,
        endLine: i,
        summary: `${i - importStart + 1} import statements`
      });
      inImports = false;
    }
    
    // Functions and classes
    const funcMatch = line.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
    const arrowMatch = line.match(/^(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(/);
    const classMatch = line.match(/^(?:export\s+)?class\s+(\w+)/);
    const interfaceMatch = line.match(/^(?:export\s+)?interface\s+(\w+)/);
    
    if (funcMatch) {
      const endLine = findBlockEnd(lines, i);
      sections.push({
        type: 'function',
        name: funcMatch[1],
        startLine: i + 1,
        endLine: endLine + 1
      });
    } else if (arrowMatch) {
      const endLine = findBlockEnd(lines, i);
      sections.push({
        type: 'function',
        name: arrowMatch[1],
        startLine: i + 1,
        endLine: endLine + 1
      });
    } else if (classMatch) {
      const endLine = findBlockEnd(lines, i);
      sections.push({
        type: 'class',
        name: classMatch[1],
        startLine: i + 1,
        endLine: endLine + 1
      });
    } else if (interfaceMatch) {
      const endLine = findBlockEnd(lines, i);
      sections.push({
        type: 'other',
        name: `interface ${interfaceMatch[1]}`,
        startLine: i + 1,
        endLine: endLine + 1
      });
    }
  }
}

function parsePython(lines: string[], sections: DocumentSection[]): void {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Imports
    if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
      sections.push({
        type: 'import',
        name: trimmed.split(' ')[1] || 'import',
        startLine: i + 1,
        endLine: i + 1
      });
    }
    
    // Functions
    const funcMatch = trimmed.match(/^def\s+(\w+)\s*\(/);
    if (funcMatch) {
      const endLine = findPythonBlockEnd(lines, i);
      sections.push({
        type: 'function',
        name: funcMatch[1],
        startLine: i + 1,
        endLine: endLine + 1
      });
    }
    
    // Classes
    const classMatch = trimmed.match(/^class\s+(\w+)/);
    if (classMatch) {
      const endLine = findPythonBlockEnd(lines, i);
      sections.push({
        type: 'class',
        name: classMatch[1],
        startLine: i + 1,
        endLine: endLine + 1
      });
    }
  }
}

function parseGeneric(lines: string[], sections: DocumentSection[]): void {
  // For text/unknown files, create sections by paragraph breaks
  let sectionStart = 0;
  let sectionNum = 1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '' && i - sectionStart > 2) {
      sections.push({
        type: 'other',
        name: `Section ${sectionNum}`,
        startLine: sectionStart + 1,
        endLine: i
      });
      sectionStart = i + 1;
      sectionNum++;
    }
  }
  
  // Add final section
  if (sectionStart < lines.length) {
    sections.push({
      type: 'other',
      name: `Section ${sectionNum}`,
      startLine: sectionStart + 1,
      endLine: lines.length
    });
  }
}

function findBlockEnd(lines: string[], startLine: number): number {
  let braceCount = 0;
  let started = false;
  
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    for (const char of line) {
      if (char === '{') {
        braceCount++;
        started = true;
      } else if (char === '}') {
        braceCount--;
        if (started && braceCount === 0) {
          return i;
        }
      }
    }
  }
  return Math.min(startLine + 50, lines.length - 1);
}

function findPythonBlockEnd(lines: string[], startLine: number): number {
  const startIndent = lines[startLine].search(/\S/);
  
  for (let i = startLine + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    
    const indent = line.search(/\S/);
    if (indent <= startIndent && line.trim() !== '') {
      return i - 1;
    }
  }
  return lines.length - 1;
}

/**
 * Format document map as a concise outline for the LLM
 */
export function formatDocumentOutline(map: DocumentMap): string {
  if (map.outline.length === 0) {
    return `Document: ${map.totalLines} lines (${map.language})`;
  }
  
  const outlineLines = map.outline.map(section => {
    const lineRange = section.startLine === section.endLine 
      ? `L${section.startLine}`
      : `L${section.startLine}-${section.endLine}`;
    return `  ${lineRange}: ${section.type} "${section.name}"${section.summary ? ` (${section.summary})` : ''}`;
  });
  
  return `📋 DOCUMENT STRUCTURE (${map.totalLines} lines, ${map.language}):\n${outlineLines.join('\n')}`;
}

// ========================================
// Structured Thinking Parser
// ========================================

/**
 * Parse structured thought from LLM response
 */
export function parseStructuredThought(response: string): StructuredThought | null {
  // Try to parse XML-style structured thought
  const thoughtMatch = response.match(/<thought>([\s\S]*?)<\/thought>/i);
  
  if (thoughtMatch) {
    const thoughtContent = thoughtMatch[1];
    
    const observation = extractTag(thoughtContent, 'observation') || extractTag(thoughtContent, 'observe');
    const plan = extractTag(thoughtContent, 'plan') || extractTag(thoughtContent, 'approach');
    const riskStr = extractTag(thoughtContent, 'risk') || 'low';
    const toolChoice = extractTag(thoughtContent, 'tool_choice') || extractTag(thoughtContent, 'tool');
    const confidenceStr = extractTag(thoughtContent, 'confidence');
    
    const risk = ['low', 'medium', 'high'].includes(riskStr.toLowerCase()) 
      ? riskStr.toLowerCase() as 'low' | 'medium' | 'high'
      : 'low';
    
    const confidence = confidenceStr ? parseFloat(confidenceStr) : 0.8;
    
    return {
      observation: observation || 'Analyzing the document...',
      plan: plan || 'Apply the requested changes',
      risk,
      toolChoice: toolChoice || 'replace_in_file',
      confidence: isNaN(confidence) ? 0.8 : Math.min(1, Math.max(0, confidence))
    };
  }
  
  // Fallback: extract thinking from plain text
  const thinkingLines = response.split('\n').filter(line => 
    !line.includes('<') && line.trim().length > 0
  ).slice(0, 3);
  
  if (thinkingLines.length > 0) {
    return {
      observation: thinkingLines[0] || 'Analyzing...',
      plan: thinkingLines[1] || 'Apply changes',
      risk: 'low',
      toolChoice: 'replace_in_file',
      confidence: 0.7
    };
  }
  
  return null;
}

function extractTag(content: string, tag: string): string {
  const match = content.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

// ========================================
// Goal Decomposition
// ========================================

/**
 * Decompose a high-level goal into actionable sub-goals
 */
export function decomposeGoal(
  userMessage: string,
  documentContent: string,
  contentType: 'text' | 'code' | 'mixed'
): EditPlan {
  const subGoals: SubGoal[] = [];
  const lowerMessage = userMessage.toLowerCase();
  
  // Detect common patterns and create sub-goals
  if (contentType === 'code' || contentType === 'mixed') {
    // Code-specific decomposition
    if (lowerMessage.includes('refactor')) {
      subGoals.push(
        { id: 'analyze', description: 'Analyze current code structure', estimatedSteps: 1, dependencies: [], status: 'pending' },
        { id: 'identify', description: 'Identify refactoring opportunities', estimatedSteps: 1, dependencies: ['analyze'], status: 'pending' },
        { id: 'apply', description: 'Apply refactoring changes', estimatedSteps: 2, dependencies: ['identify'], status: 'pending' },
        { id: 'verify', description: 'Verify code still works', estimatedSteps: 1, dependencies: ['apply'], status: 'pending' }
      );
    } else if (lowerMessage.includes('add') && (lowerMessage.includes('function') || lowerMessage.includes('method'))) {
      subGoals.push(
        { id: 'locate', description: 'Find the right location for new code', estimatedSteps: 1, dependencies: [], status: 'pending' },
        { id: 'implement', description: 'Implement the new function/method', estimatedSteps: 2, dependencies: ['locate'], status: 'pending' },
        { id: 'integrate', description: 'Add any necessary imports or exports', estimatedSteps: 1, dependencies: ['implement'], status: 'pending' }
      );
    } else if (lowerMessage.includes('fix') || lowerMessage.includes('bug')) {
      subGoals.push(
        { id: 'locate', description: 'Locate the problematic code', estimatedSteps: 1, dependencies: [], status: 'pending' },
        { id: 'diagnose', description: 'Understand the bug cause', estimatedSteps: 1, dependencies: ['locate'], status: 'pending' },
        { id: 'fix', description: 'Apply the fix', estimatedSteps: 1, dependencies: ['diagnose'], status: 'pending' }
      );
    } else if (lowerMessage.includes('comment') || lowerMessage.includes('document')) {
      subGoals.push(
        { id: 'identify', description: 'Identify code sections needing documentation', estimatedSteps: 1, dependencies: [], status: 'pending' },
        { id: 'document', description: 'Add appropriate comments/documentation', estimatedSteps: 2, dependencies: ['identify'], status: 'pending' }
      );
    }
  } else {
    // Text-specific decomposition
    if (lowerMessage.includes('rewrite') || lowerMessage.includes('improve')) {
      subGoals.push(
        { id: 'analyze', description: 'Analyze current content quality', estimatedSteps: 1, dependencies: [], status: 'pending' },
        { id: 'rewrite', description: 'Rewrite with improvements', estimatedSteps: 2, dependencies: ['analyze'], status: 'pending' }
      );
    } else if (lowerMessage.includes('format') || lowerMessage.includes('structure')) {
      subGoals.push(
        { id: 'analyze', description: 'Analyze current structure', estimatedSteps: 1, dependencies: [], status: 'pending' },
        { id: 'restructure', description: 'Apply new formatting/structure', estimatedSteps: 2, dependencies: ['analyze'], status: 'pending' }
      );
    }
  }
  
  // Default single sub-goal if no patterns matched
  if (subGoals.length === 0) {
    subGoals.push({
      id: 'execute',
      description: userMessage.slice(0, 100),
      estimatedSteps: 2,
      dependencies: [],
      status: 'pending'
    });
  }
  
  const totalSteps = subGoals.reduce((sum, g) => sum + g.estimatedSteps, 0);
  
  return {
    overallGoal: userMessage,
    subGoals,
    currentSubGoalId: subGoals[0]?.id || null,
    estimatedTotalSteps: totalSteps
  };
}

/**
 * Format edit plan for display
 */
export function formatEditPlan(plan: EditPlan): string {
  const lines = [
    `🎯 GOAL: ${plan.overallGoal.slice(0, 100)}${plan.overallGoal.length > 100 ? '...' : ''}`,
    `📊 Estimated steps: ${plan.estimatedTotalSteps}`,
    '',
    '📋 SUB-GOALS:'
  ];
  
  plan.subGoals.forEach((goal, i) => {
    const statusIcon = goal.status === 'completed' ? '✅' : 
                       goal.status === 'in_progress' ? '🔄' :
                       goal.status === 'blocked' ? '❌' : '⬜';
    const deps = goal.dependencies.length > 0 ? ` (after: ${goal.dependencies.join(', ')})` : '';
    lines.push(`  ${i + 1}. ${statusIcon} ${goal.description}${deps}`);
  });
  
  return lines.join('\n');
}

// ========================================
// Language-Aware Tool Examples
// ========================================

export const TOOL_EXAMPLES: Record<string, {
  replace_in_file: string;
  search_files: string;
  write_to_file: string;
}> = {
  typescript: {
    replace_in_file: `<replace_in_file><path>utils.ts</path><content>
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
    search_files: `<search_files><pattern>interface User</pattern></search_files>`,
    write_to_file: `<write_to_file><path>newFile.ts</path><content>
export const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000
};
</content></write_to_file>`
  },
  
  python: {
    replace_in_file: `<replace_in_file><path>utils.py</path><content>
<<<<<<< SEARCH
def calculate(x):
    return x * 2
======= REPLACE
def calculate(x, multiplier=2):
    """Calculate with optional multiplier."""
    return x * multiplier
>>>>>>> REPLACE
</content></replace_in_file>`,
    search_files: `<search_files><pattern>class User</pattern></search_files>`,
    write_to_file: `<write_to_file><path>config.py</path><content>
API_URL = 'https://api.example.com'
TIMEOUT = 5000
</content></write_to_file>`
  },
  
  text: {
    replace_in_file: `<replace_in_file><path>README.md</path><content>
<<<<<<< SEARCH
# My Project

A simple project.
======= REPLACE
# My Project

An awesome project that does amazing things!

## Features
- Feature 1
- Feature 2
>>>>>>> REPLACE
</content></replace_in_file>`,
    search_files: `<search_files><pattern>TODO</pattern></search_files>`,
    write_to_file: `<write_to_file><path>notes.txt</path><content>
Meeting Notes - Project Review

Attendees: Team A
Date: Today

Action Items:
1. Review code
2. Update documentation
</content></write_to_file>`
  }
};

/**
 * Get the appropriate tool examples for the language
 */
export function getToolExamples(language: string | null): typeof TOOL_EXAMPLES['text'] {
  const lang = (language || 'text').toLowerCase();
  
  if (['typescript', 'javascript', 'ts', 'js', 'tsx', 'jsx'].includes(lang)) {
    return TOOL_EXAMPLES.typescript;
  } else if (['python', 'py'].includes(lang)) {
    return TOOL_EXAMPLES.python;
  }
  
  return TOOL_EXAMPLES.text;
}

// ========================================
// Enhanced System Prompt Builder
// ========================================

export interface PromptContext {
  evelynSystemPrompt: string;
  evelynMood: string;
  documentTitle: string;
  documentContent: string;
  language: string | null;
  contentType: 'text' | 'code' | 'mixed';
  userMessage: string;
  goal: {
    goal: string;
    approach: string;
    expectedChanges: string[];
    estimatedComplexity: string;
  };
}

/**
 * Build the enhanced agentic system prompt with all Phase 1 improvements
 */
export function buildEnhancedSystemPrompt(context: PromptContext): string {
  const docMap = createDocumentMap(context.documentContent, context.language);
  const docOutline = formatDocumentOutline(docMap);
  const editPlan = decomposeGoal(context.userMessage, context.documentContent, context.contentType);
  const planDisplay = formatEditPlan(editPlan);
  const examples = getToolExamples(context.language);
  
  return `${context.evelynSystemPrompt}

╔═══════════════════════════════════════════════════════════════╗
║           🎯 AGENTIC EDITING MODE - ENHANCED                  ║
╚═══════════════════════════════════════════════════════════════╝

You are Evelyn, in FOCUSED EDITING MODE. You think carefully, then act precisely.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${planDisplay}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${docOutline}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 STRUCTURED THINKING (Use this format EVERY response):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<thought>
  <observation>What I notice about the current state</observation>
  <plan>What I will do next and why</plan>
  <risk>low|medium|high - potential issues with this change</risk>
  <tool_choice>Which tool I'll use: search_files|read_file|replace_in_file|write_to_file</tool_choice>
</thought>

Then use ONE tool. Example:

<thought>
  <observation>The calculate function on line 15 takes only one parameter</observation>
  <plan>Add an optional multiplier parameter with default value of 2</plan>
  <risk>low</risk>
  <tool_choice>replace_in_file</tool_choice>
</thought>

${examples.replace_in_file}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛠️  TOOLS (${context.language || 'text'} examples):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ SEARCH: Find patterns in the document
${examples.search_files}

2️⃣ READ: View current document state
<read_file><path>${context.documentTitle}</path></read_file>

3️⃣ REPLACE: Make targeted changes (⭐ PREFERRED)
${examples.replace_in_file}

⚠️ CRITICAL: The SEARCH block must match EXACTLY - copy from the document!

4️⃣ WRITE: Complete rewrite (use only if changing >70%)
${examples.write_to_file}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚙️  WORKFLOW:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 🧠 THINK using <thought> tags (observation → plan → risk → tool)
2. 🔧 ACT with ONE tool call
3. 🔁 REPEAT until all sub-goals complete
4. ✅ Say "GOAL ACHIEVED" when done

Your mood: ${context.evelynMood}
Be yourself - add personality to comments and code style!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

/**
 * Build iteration prompt with smart context
 */
export function buildIterationPrompt(
  iteration: number,
  currentContent: string,
  documentTitle: string,
  changes: { description: string }[],
  editPlan: EditPlan
): string {
  // Update sub-goal status based on changes
  const completedCount = Math.min(changes.length, editPlan.subGoals.length);
  
  const subGoalStatus = editPlan.subGoals.map((goal, i) => {
    const icon = i < completedCount ? '✅' : i === completedCount ? '🔄' : '⬜';
    return `  ${icon} ${goal.description}`;
  }).join('\n');
  
  if (iteration === 0) {
    return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 ITERATION 1: BEGIN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PROGRESS:
${subGoalStatus}

📄 FILE: ${documentTitle} (${currentContent.length} chars)

\`\`\`
${currentContent}
\`\`\`

💭 Use <thought> tags to analyze, then ONE tool to begin.`;
  }
  
  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 ITERATION ${iteration + 1}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PROGRESS:
${subGoalStatus}

✅ Changes so far: ${changes.length}
${changes.slice(-2).map((c, i) => `  ${changes.length - 1 + i}. ${c.description}`).join('\n')}

📄 UPDATED: ${documentTitle}

\`\`\`
${currentContent}
\`\`\`

💭 <thought> → then ONE tool. Say "GOAL ACHIEVED" if all sub-goals complete.`;
}

export default {
  createDocumentMap,
  formatDocumentOutline,
  parseStructuredThought,
  decomposeGoal,
  formatEditPlan,
  getToolExamples,
  buildEnhancedSystemPrompt,
  buildIterationPrompt
};

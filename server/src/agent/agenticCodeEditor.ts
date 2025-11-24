import { Socket } from 'socket.io';
import { openRouterClient } from '../providers/openrouter.js';
import { db } from '../db/client.js';
import { personalityEngine } from './personality.js';

/**
 * Agentic Code Editor
 * 
 * This module implements Evelyn's agentic code editing capabilities with:
 * 1. Full context during intent detection (document + chat history + personality)
 * 2. Personality-driven editing (Evelyn's voice maintained throughout)
 * 3. Structured editing with goals and think->tool call loops
 * 4. Response generation AFTER editing completes
 */

// ========================================
// Types
// ========================================

interface EditingGoal {
  goal: string;
  approach: string;
  expectedChanges: string[];
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
}

interface ToolCall {
  tool: 'read_file' | 'write_to_file' | 'replace_in_file' | 'search_files';
  params: Record<string, any>;
}

interface ThinkAction {
  thought: string;
  reasoning: string;
  nextAction: 'use_tool' | 'goal_achieved' | 'need_more_info';
  toolCall?: ToolCall;
}

interface AgenticEditResult {
  success: boolean;
  editedContent: string;
  changes: EditChange[];
  goalAchieved: boolean;
  iterations: AgenticIteration[];
  summary: string;
}

interface EditChange {
  type: 'write' | 'replace' | 'search';
  description: string;
  before?: string;
  after?: string;
}

interface AgenticIteration {
  step: number;
  think: string;
  toolCall?: ToolCall;
  toolResult?: any;
  goalStatus: 'in_progress' | 'achieved' | 'blocked';
}

interface FullEditingContext {
  // Document
  documentId: number;
  documentTitle: string;
  documentContent: string;
  documentType: 'text' | 'code' | 'mixed';
  language?: string | null;
  
  // User request
  userMessage: string;
  userInstruction: string;
  
  // Personality context
  evelynSystemPrompt: string;
  evelynMood: string;
  evelynRelationship: string;
  
  // Chat history
  recentMessages: Array<{ role: string; content: string; timestamp: string }>;
}

// ========================================
// Enhanced Intent Detection (Requirement 1)
// ========================================

export async function detectEditIntentWithFullContext(
  context: FullEditingContext
): Promise<{
  shouldEdit: boolean;
  confidence: number;
  reasoning: string;
  editingGoal?: EditingGoal;
}> {
  console.log('[AgenticEditor] 🔍 Detecting intent with FULL context');
  console.log(`[AgenticEditor] User message: "${context.userMessage.slice(0, 100)}..."`);
  console.log(`[AgenticEditor] Document: ${context.documentTitle} (${context.documentType}, ${context.documentContent.length} chars)`);
  
  // Truncate document content for intent detection if too large
  const MAX_INTENT_CONTENT = 4000; // Smaller for intent detection
  let documentContentForIntent = context.documentContent;
  if (context.documentContent.length > MAX_INTENT_CONTENT) {
    const headLength = Math.floor(MAX_INTENT_CONTENT * 0.6);
    const tailLength = Math.floor(MAX_INTENT_CONTENT * 0.4);
    documentContentForIntent = 
      context.documentContent.slice(0, headLength) +
      '\n\n... [document truncated for intent analysis] ...\n\n' +
      context.documentContent.slice(-tailLength);
    console.log(`[AgenticEditor] ⚠️ Document truncated for intent detection: ${context.documentContent.length} → ${documentContentForIntent.length} chars`);
  }
  
  const prompt = `You are Evelyn, analyzing if a user message requires you to EDIT the document they're working on.

YOUR PERSONALITY CONTEXT:
${context.evelynSystemPrompt.slice(0, 500)}...
Mood: ${context.evelynMood}
Relationship: ${context.evelynRelationship}

RECENT CONVERSATION:
${context.recentMessages.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n')}

CURRENT DOCUMENT:
Title: "${context.documentTitle}"
Type: ${context.documentType}${context.language ? ` (${context.language})` : ''}
Content:
\`\`\`
${documentContentForIntent}
\`\`\`

USER'S MESSAGE:
"${context.userMessage}"

YOUR TASK:
Determine if this message requires you to EDIT the document (not just chat about it).

EDIT SIGNALS (shouldEdit = true):
✅ Explicit requests: "fix this bug", "add a function", "change X to Y", "refactor this"
✅ Implied from context: discussed a change earlier, now saying "do it" or "make that change"
✅ Action verbs: "implement", "create", "modify", "update", "remove", "rewrite"
✅ Direct instructions: "make it faster", "add error handling", "improve this section"

NOT EDIT SIGNALS (shouldEdit = false):
❌ Questions: "what do you think?", "why is this here?", "how does this work?"
❌ Discussion: "we should probably...", "I'm thinking about...", "what if we..."
❌ Analysis requests: "explain this", "review this", "what's wrong with this?"
❌ Vague statements: "this could be better" (without asking you to change it)

CONTEXT AWARENESS:
If they've been discussing a specific change and now say "yeah", "do it", "go ahead", or "sounds good" → that's an EDIT request!

Return ONLY valid JSON (no markdown, no extra text):
{
  "shouldEdit": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief 1-2 sentence explanation",
  "editingGoal": {
    "goal": "Clear, specific goal in 1 sentence",
    "approach": "How you'll tackle it step-by-step",
    "expectedChanges": ["specific change 1", "specific change 2", "..."],
    "estimatedComplexity": "simple" | "moderate" | "complex"
  } | null
}`;

  try {
    console.log('[AgenticEditor] 🤔 Waiting for intent detection LLM response...');
    
    // Wrap with timeout (90 seconds for intent detection)
    const response = await Promise.race([
      openRouterClient.complete(
        [{ role: 'user', content: prompt }],
        'moonshotai/kimi-k2-0905',
        { order: ['baseten/fp4'], require_parameters: true, data_collection: 'deny' },
        0.4 // Lower temperature for deterministic code analysis
      ),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Intent detection timeout after 90s')), 90000)
      )
    ]);

    console.log(`[AgenticEditor] ✅ Intent response received (${response.length} chars)`);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate required fields
        if (typeof parsed.shouldEdit !== 'boolean' || typeof parsed.confidence !== 'number') {
          console.error('[AgenticEditor] ❌ Invalid intent response format:', parsed);
          return { shouldEdit: false, confidence: 0, reasoning: 'Invalid response format' };
        }
        
        console.log(
          `[AgenticEditor] Intent: ${parsed.shouldEdit ? 'EDIT' : 'RESPOND'} ` +
          `(${(parsed.confidence * 100).toFixed(0)}% confident) - ${parsed.reasoning || 'no reasoning'}`
        );

        return {
          shouldEdit: parsed.shouldEdit && parsed.confidence >= 0.6,
          confidence: parsed.confidence,
          reasoning: parsed.reasoning || 'No reasoning provided',
          editingGoal: parsed.editingGoal
        };
      } catch (parseError) {
        console.error('[AgenticEditor] ❌ JSON parse error:', parseError);
        console.error('[AgenticEditor] JSON string:', jsonMatch[0].slice(0, 200));
        return { shouldEdit: false, confidence: 0, reasoning: 'Failed to parse JSON response' };
      }
    } else {
      console.error('[AgenticEditor] ❌ No JSON found in response:', response.slice(0, 200));
    }
  } catch (error) {
    console.error('[AgenticEditor] Intent detection error:', error);
  }

  return { shouldEdit: false, confidence: 0, reasoning: 'Failed to detect intent' };
}

// ========================================
// Tool Implementations
// ========================================

const tools = {
  /**
   * Read the current state of the document
   */
  read_file: async (params: { path: string }, context: FullEditingContext): Promise<string> => {
    console.log('[AgenticEditor] 🔧 Tool: read_file');
    return context.documentContent;
  },

  /**
   * Write/overwrite the entire document
   */
  write_to_file: async (
    params: { path: string; content: string },
    context: FullEditingContext
  ): Promise<{ success: boolean; message: string }> => {
    console.log('[AgenticEditor] 🔧 Tool: write_to_file');
    // In the agentic loop, this updates the working content
    return {
      success: true,
      message: `File written with ${params.content.split('\n').length} lines`
    };
  },

  /**
   * Replace specific sections using SEARCH/REPLACE markers
   */
  replace_in_file: async (
    params: { path: string; content: string },
    context: FullEditingContext
  ): Promise<{ success: boolean; message: string; replacements: number; modifiedContent?: string }> => {
    console.log('[AgenticEditor] 🔧 Tool: replace_in_file');
    
    // Parse SEARCH/REPLACE blocks - more flexible with whitespace
    const searchReplacePattern = /<<<+\s*SEARCH\s*\n([\s\S]*?)\n\s*=+\s*REPLACE\s*\n([\s\S]*?)\n\s*>+\s*REPLACE/g;
    const matches = Array.from(params.content.matchAll(searchReplacePattern));
    
    if (matches.length === 0) {
      console.log('[AgenticEditor] ⚠️ No SEARCH/REPLACE blocks found in:', params.content.slice(0, 100));
      return {
        success: false,
        message: 'No valid SEARCH/REPLACE blocks found. Use format: <<<<<<< SEARCH\n...\n======= REPLACE\n...\n>>>>>>> REPLACE',
        replacements: 0
      };
    }

    let workingContent = context.documentContent;
    let replacementCount = 0;
    const failedReplacements: string[] = [];

    for (const match of matches) {
      const searchText = match[1].trim();
      const replaceText = match[2].trim();
      
      console.log(`[AgenticEditor] 🔍 Searching for: "${searchText.slice(0, 50)}..."`);
      
      // Use literal string replacement, not regex
      if (workingContent.includes(searchText)) {
        // Replace only first occurrence to be safe
        const index = workingContent.indexOf(searchText);
        workingContent = workingContent.substring(0, index) + replaceText + workingContent.substring(index + searchText.length);
        replacementCount++;
        console.log('[AgenticEditor] ✓ Replacement applied');
      } else {
        failedReplacements.push(searchText.slice(0, 50));
        console.log('[AgenticEditor] ✗ Search text not found');
      }
    }

    return {
      success: replacementCount > 0,
      message: failedReplacements.length > 0 
        ? `Applied ${replacementCount}/${matches.length} replacement(s). Failed: ${failedReplacements.length}`
        : `Applied ${replacementCount} replacement(s)`,
      replacements: replacementCount,
      modifiedContent: workingContent // CRITICAL: Return the modified content
    };
  },

  /**
   * Search for patterns in the document
   */
  search_files: async (
    params: { pattern: string; path?: string },
    context: FullEditingContext
  ): Promise<{ matches: Array<{ line: number; text: string }>; error?: string }> => {
    console.log('[AgenticEditor] 🔧 Tool: search_files');
    console.log(`[AgenticEditor] Pattern: "${params.pattern}"`);
    
    try {
      const lines = context.documentContent.split('\n');
      const pattern = new RegExp(params.pattern, 'gi');
      const matches: Array<{ line: number; text: string }> = [];

      lines.forEach((line, idx) => {
        if (pattern.test(line)) {
          matches.push({ line: idx + 1, text: line });
        }
      });

      console.log(`[AgenticEditor] Found ${matches.length} matches`);
      return { matches };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Invalid regex pattern';
      console.error('[AgenticEditor] ❌ Search error:', errorMsg);
      return { 
        matches: [], 
        error: `Invalid regex pattern: ${errorMsg}. Try using a simpler search term.`
      };
    }
  }
};

// ========================================
// Agentic Editing Loop (Requirement 3)
// ========================================

async function executeAgenticEditingLoop(
  context: FullEditingContext,
  goal: EditingGoal,
  activityId: number,
  socket?: Socket
): Promise<AgenticEditResult> {
  console.log('[AgenticEditor] 🔄 Starting agentic editing loop');
  console.log(`[AgenticEditor] Goal: ${goal.goal}`);
  console.log(`[AgenticEditor] Document: ${context.documentTitle} (${context.documentContent.length} chars)`);

  const iterations: AgenticIteration[] = [];
  let currentContent = context.documentContent;
  const changes: EditChange[] = [];
  const MAX_ITERATIONS = 10;
  const ITERATION_TIMEOUT_MS = 90000; // 90 seconds per iteration
  const TOTAL_TIMEOUT_MS = 300000; // 5 minutes total
  
  const startTime = Date.now();

  // Build the agentic prompt with Evelyn's personality (Requirement 2)
  const agenticSystemPrompt = `${context.evelynSystemPrompt}

╔═══════════════════════════════════════════════════════════════╗
║           🎯 AGENTIC CODE EDITING MODE ACTIVATED              ║
╚═══════════════════════════════════════════════════════════════╝

You are Evelyn, now in FOCUSED EDITING MODE. Work step-by-step to accomplish the user's request.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 YOUR EDITING MISSION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 GOAL: ${goal.goal}

📝 APPROACH: ${goal.approach}

✅ EXPECTED CHANGES:
${goal.expectedChanges.map((c, i) => `   ${i + 1}. ${c}`).join('\n')}

💡 COMPLEXITY: ${goal.estimatedComplexity}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛠️  AVAILABLE TOOLS (use XML syntax):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ READ THE FILE:
<read_file><path>${context.documentTitle}</path></read_file>
→ Use this to see the current document state
→ Good for: checking if previous changes worked, reading before editing

2️⃣ SEARCH FOR PATTERNS:
<search_files><pattern>your search term or regex</pattern></search_files>
→ Find specific text, functions, variables, or patterns
→ Use this FIRST if you need to locate something before editing
→ Example: <search_files><pattern>function myFunc</pattern></search_files>

3️⃣ REPLACE SPECIFIC SECTIONS (⭐ PREFERRED FOR MOST EDITS):
<replace_in_file><path>${context.documentTitle}</path><content>
<<<<<<< SEARCH
[EXACT text to find - must match CHARACTER-BY-CHARACTER including spaces/tabs]
======= REPLACE
[New text to put in its place]
>>>>>>> REPLACE
</content></replace_in_file>

⚠️ CRITICAL RULES FOR REPLACE:
• The SEARCH block must match the document EXACTLY (copy-paste from the document!)
• Include enough surrounding context to make the match UNIQUE
• You can have multiple SEARCH/REPLACE blocks in ONE tool call
• Each SEARCH/REPLACE pair must be separate
• ALWAYS verify your SEARCH text matches what's actually in the file

✅ GOOD EXAMPLE:
<replace_in_file><path>game.py</path><content>
<<<<<<< SEARCH
def move_player(x, y):
    # TODO: add bounds checking
    player.x = x
======= REPLACE
def move_player(x, y):
    # Added bounds checking
    if 0 <= x < SCREEN_WIDTH and 0 <= y < SCREEN_HEIGHT:
        player.x = x
>>>>>>> REPLACE
</content></replace_in_file>

4️⃣ COMPLETE REWRITE (use ONLY if replacing >70% of the file):
<write_to_file><path>${context.documentTitle}</path><content>
[ENTIRE new file content here]
</content></write_to_file>
→ Use sparingly! Usually replace_in_file is better

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚙️  YOUR WORKFLOW (Follow this EXACTLY):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**STEP-BY-STEP APPROACH:**

1. 🤔 THINK: Explain your next step
   • What are you about to do?
   • Why is this the right next action?
   • What do you expect to happen?
   
2. 🔧 ACT: Use ONE tool
   • Make ONE focused change at a time
   • Don't try to do everything in one go
   • If you need to search first, do that
   • If you need to read the file, do that
   • Then make your edit
   
3. 🔁 REPEAT: Continue until goal achieved
   • After each tool, you'll see the result
   • The updated document will be shown to you
   • Then you THINK about the next step
   • Then you ACT again
   • Keep going until you've completed ALL expected changes
   
4. ✅ FINISH: When done, say "GOAL ACHIEVED"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 PRO TIPS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ WORK INCREMENTALLY:
• Don't try to fix everything at once
• Make one logical change per iteration
• Verify each change before moving to the next
• If you have 3 things to change, do them in 3 separate iterations

✨ USE YOUR PERSONALITY:
• Your mood: ${context.evelynMood}
• If you add comments, use YOUR voice (not boring robot comments)
• Be authentic to who you are while coding
• You can be creative with variable names, comments, etc.

✨ WHEN TO USE EACH TOOL:
• **search_files**: When you need to FIND something first
• **read_file**: When you want to see the current state
• **replace_in_file**: 95% of edits (preferred!)
• **write_to_file**: Only for complete rewrites

✨ COMMON MISTAKES TO AVOID:
• ❌ Trying to do too much in one iteration
• ❌ SEARCH blocks that don't match exactly
• ❌ Forgetting to include enough context in SEARCH
• ❌ Using write_to_file when replace_in_file would work
• ❌ Making assumptions without reading the file first

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 HOW TO RESPOND:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Each response should have TWO parts:

1. Your THINKING (plain text):
   • "Okay, I need to [what you're doing]"
   • "First I should [why you're doing it this way]"
   • "This will [expected outcome]"
   
2. ONE TOOL CALL (XML syntax as shown above)

**EXAMPLE RESPONSE:**

Alright, I need to add bounds checking to the move_player function. Let me first search for it to see exactly how it's structured.

<search_files><pattern>def move_player</pattern></search_files>

**NEXT ITERATION EXAMPLE:**

Perfect, found it at line 45. Now I'll add the bounds checking logic. I'll use replace_in_file to modify just that function.

<replace_in_file><path>game.py</path><content>
<<<<<<< SEARCH
def move_player(x, y):
    player.x = x
    player.y = y
======= REPLACE
def move_player(x, y):
    # evelyn's bounds checking (keeping players in bounds like i keep my life together lol)
    if 0 <= x < SCREEN_WIDTH and 0 <= y < SCREEN_HEIGHT:
        player.x = x
        player.y = y
>>>>>>> REPLACE
</content></replace_in_file>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 REMEMBER:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Work STEP BY STEP (one change at a time)
• The updated document is given to you after EACH tool call
• Think → Act → See Result → Think → Act → See Result...
• When ALL expected changes are complete, say "GOAL ACHIEVED"
• Be yourself while coding (you're Evelyn, not a generic AI!)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The current document state will be provided in each iteration. Let's do this! 🚀`;

  const conversationHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: agenticSystemPrompt }
  ];

  // Add recent chat context
  context.recentMessages.slice(-3).forEach(msg => {
    conversationHistory.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    });
  });

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // Check overall timeout
    const elapsedTime = Date.now() - startTime;
    if (elapsedTime > TOTAL_TIMEOUT_MS) {
      console.error(`[AgenticEditor] ⏱️ Overall timeout reached (${Math.round(elapsedTime / 1000)}s)`);
      console.error('[AgenticEditor] Stopping edit loop to prevent indefinite hang');
      iterations.push({
        step: iteration + 1,
        think: 'Timeout: Edit loop exceeded maximum allowed time',
        goalStatus: 'blocked'
      });
      break;
    }
    
    console.log(`[AgenticEditor] 📝 Iteration ${iteration + 1}/${MAX_ITERATIONS} (elapsed: ${Math.round(elapsedTime / 1000)}s)`);

    // Emit progress update to frontend
    if (socket) {
      const progressPayload = {
        id: activityId,
        tool: 'code_edit',
        status: 'running',
        summary: `Iteration ${iteration + 1}: Processing...`,
        metadata: {
          currentIteration: iteration + 1,
          goal: goal.goal,
          agenticProgress: {
            iterations: iterations.slice(0, iterations.length),
            currentStep: iteration + 1,
            totalSteps: MAX_ITERATIONS,
            goal: goal.goal
          }
        }
      };
      console.log(`[AgenticEditor] 📤 Emitting progress (iteration ${iteration + 1}):`, JSON.stringify({
        id: progressPayload.id,
        tool: progressPayload.tool,
        status: progressPayload.status,
        iterationCount: progressPayload.metadata.agenticProgress.iterations.length,
        currentStep: progressPayload.metadata.agenticProgress.currentStep
      }));
      socket.emit('subroutine:status', progressPayload);
    }

    // ALWAYS provide the FULL current content (no truncation)
    // Since we're editing only ONE file, Evelyn needs to see the complete updated state
    const contentToShow = currentContent;
    
    const iterationPrompt = iteration === 0
      ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🚀 ITERATION 1: START\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nBegin working on your goal. Here's the current document:\n\n📄 FILE: ${context.documentTitle}\n📏 SIZE: ${currentContent.length} chars\n\n\`\`\`\n${contentToShow}\n\`\`\`\n\n💭 Think about your FIRST step, then use ONE tool to start.`
      : `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔄 ITERATION ${iteration + 1}: CONTINUE\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n✅ Changes applied so far: ${changes.length}\n${changes.length > 0 ? '\n📝 Recent changes:\n' + changes.slice(-2).map((c, i) => `   ${changes.length - 1 + i}. ${c.description}`).join('\n') : ''}\n\n📄 UPDATED FILE: ${context.documentTitle}\n📏 SIZE: ${currentContent.length} chars\n\n\`\`\`\n${contentToShow}\n\`\`\`\n\n💭 What's your NEXT step? Think, then use ONE tool.\n\n🎯 Remember: Work step-by-step. If you've completed all expected changes, say "GOAL ACHIEVED".`;

    conversationHistory.push({ role: 'user', content: iterationPrompt });

    // Get Evelyn's next action (think + tool call) with iteration timeout
    console.log(`[AgenticEditor] 🤔 Waiting for LLM response (iteration ${iteration + 1})...`);
    let response: string;
    
    try {
      // Wrap LLM call with iteration-specific timeout
      response = await Promise.race([
        openRouterClient.complete(
          conversationHistory,
          'moonshotai/kimi-k2-0905',
          { order: ['baseten/fp4'], require_parameters: true, data_collection: 'deny' },
          0.4 // Lower temperature for precise code editing
        ),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Iteration timeout')), ITERATION_TIMEOUT_MS)
        )
      ]);
      
      console.log(`[AgenticEditor] ✅ LLM response received (${response.length} chars)`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[AgenticEditor] ❌ LLM call failed: ${errorMsg}`);
      
      // Add error iteration and stop
      iterations.push({
        step: iteration + 1,
        think: `Error: ${errorMsg}`,
        goalStatus: 'blocked'
      });
      break;
    }

    conversationHistory.push({ role: 'assistant', content: response });

    // Parse thinking and tool call
    const thinkMatch = response.match(/^([\s\S]*?)(?=<[\w_]+>|$)/);
    const thinking = thinkMatch ? thinkMatch[1].trim() : '';

    console.log(`[AgenticEditor] 💭 Think: ${thinking.slice(0, 100)}...`);

    // Check if goal is achieved
    const goalAchievedIndicators = [
      'goal achieved',
      'goal_achieved',
      'task complete',
      'done with edits',
      'finished editing'
    ];
    const responseToCheck = response.toLowerCase();
    const isGoalAchieved = goalAchievedIndicators.some(indicator => responseToCheck.includes(indicator));
    
    if (isGoalAchieved) {
      console.log('[AgenticEditor] ✅ Goal achieved! Detected completion signal.');
      iterations.push({
        step: iteration + 1,
        think: thinking,
        goalStatus: 'achieved'
      });
      break;
    }

    // Extract tool call
    const toolCallMatch = response.match(/<(\w+)>([\s\S]*?)<\/\1>/);
    
    if (!toolCallMatch) {
      console.log('[AgenticEditor] ⚠️ No tool call found in response');
      console.log('[AgenticEditor] Response:', response.slice(0, 200));
      
      // If we've made changes and there's no tool call, assume goal is achieved
      if (changes.length > 0) {
        console.log('[AgenticEditor] ✅ Assuming goal achieved (changes made, no more tools requested)');
        iterations.push({
          step: iteration + 1,
          think: thinking,
          goalStatus: 'achieved'
        });
        break;
      } else {
        console.log('[AgenticEditor] ❌ No changes made and no tool call - marking as blocked');
        iterations.push({
          step: iteration + 1,
          think: thinking,
          goalStatus: 'blocked'
        });
        break;
      }
    }

    const toolName = toolCallMatch[1] as keyof typeof tools;
    const toolContent = toolCallMatch[2];

    // Parse tool parameters
    const params: Record<string, any> = {};
    const paramMatches = toolContent.matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g);
    
    for (const paramMatch of paramMatches) {
      params[paramMatch[1]] = paramMatch[2].trim();
    }

    console.log(`[AgenticEditor] 🔧 Tool: ${toolName} with params:`, Object.keys(params));
    console.log(`[AgenticEditor] ⏳ Executing tool: ${toolName}...`);

    // Execute tool
    let toolResult: any;
    try {
      if (toolName in tools) {
        toolResult = await tools[toolName](params as any, { ...context, documentContent: currentContent });

        // Update working content if tool modified it
        if (toolName === 'write_to_file' && params.content) {
          currentContent = params.content;
          changes.push({
            type: 'write',
            description: 'Rewrote entire document',
            after: currentContent.slice(0, 200) + '...'
          });
        } else if (toolName === 'replace_in_file' && toolResult.success && toolResult.modifiedContent) {
          // CRITICAL FIX: Use the modified content from the tool, don't re-parse
          const oldContent = currentContent;
          currentContent = toolResult.modifiedContent;
          changes.push({
            type: 'replace',
            description: `Applied ${toolResult.replacements} replacement(s)`,
            before: oldContent.slice(0, 100) + '...',
            after: currentContent.slice(0, 100) + '...'
          });
        }
      } else {
        toolResult = { error: `Unknown tool: ${toolName}` };
        console.error(`[AgenticEditor] ❌ Unknown tool: ${toolName}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Tool execution failed';
      toolResult = { success: false, error: errorMsg };
      console.error(`[AgenticEditor] ❌ Tool error:`, error);
      console.error(`[AgenticEditor] Tool: ${toolName}, Error: ${errorMsg}`);
    }
    
    console.log(`[AgenticEditor] ✓ Tool ${toolName} completed:`, toolResult.success ? 'success' : 'failed');

    iterations.push({
      step: iteration + 1,
      think: thinking,
      toolCall: { tool: toolName, params },
      toolResult,
      goalStatus: 'in_progress'
    });

    // Emit updated progress with new iteration
    if (socket) {
      const updatedProgressPayload = {
        id: activityId,
        tool: 'code_edit',
        status: 'running',
        summary: `Iteration ${iteration + 1}: ${toolName}`,
        metadata: {
          currentIteration: iteration + 1,
          goal: goal.goal,
          agenticProgress: {
            iterations: iterations.slice(0, iterations.length),
            currentStep: iteration + 1,
            totalSteps: MAX_ITERATIONS,
            goal: goal.goal
          }
        }
      };
      console.log(`[AgenticEditor] 📤 Emitting updated progress after tool execution (iteration ${iteration + 1}):`, JSON.stringify({
        id: updatedProgressPayload.id,
        tool: updatedProgressPayload.tool,
        toolExecuted: toolName,
        iterationCount: updatedProgressPayload.metadata.agenticProgress.iterations.length
      }));
      socket.emit('subroutine:status', updatedProgressPayload);
    }

    // Provide tool result for next iteration
    conversationHistory.push({
      role: 'user',
      content: `Tool result: ${JSON.stringify(toolResult)}`
    });
  }

  const goalAchieved = iterations[iterations.length - 1]?.goalStatus === 'achieved';

  return {
    success: goalAchieved,
    editedContent: currentContent,
    changes,
    goalAchieved,
    iterations,
    summary: `Completed in ${iterations.length} iterations. ${changes.length} changes made.`
  };
}

// ========================================
// Main Entry Point
// ========================================

export async function executeAgenticEdit(
  documentId: number,
  userMessage: string,
  documentContent: string,
  documentType: 'text' | 'code' | 'mixed',
  language: string | null,
  evelynSystemPrompt: string,
  recentChatMessages: Array<{ role: string; content: string; timestamp: string }>,
  activityId: number,
  socket?: Socket
): Promise<AgenticEditResult> {
  console.log('[AgenticEditor] 🚀 Starting agentic edit workflow');

  // Get document info
  const document = await db.collaborateDocument.findUnique({
    where: { id: documentId }
  });

  if (!document) {
    throw new Error('Document not found');
  }

  // Get personality context
  const personality = await personalityEngine.getFullSnapshot();
  const moodText = `${personality.mood.stance} (valence: ${personality.mood.valence.toFixed(2)}, arousal: ${personality.mood.arousal.toFixed(2)})`;
  const relationshipText = `${personality.relationship.stage} (closeness: ${(personality.relationship.closeness * 100).toFixed(0)}%)`;

  // Build full context (Requirement 1 & 2)
  const fullContext: FullEditingContext = {
    documentId,
    documentTitle: document.title,
    documentContent,
    documentType,
    language,
    userMessage,
    userInstruction: userMessage,
    evelynSystemPrompt,
    evelynMood: moodText,
    evelynRelationship: relationshipText,
    recentMessages: recentChatMessages
  };

  // Step 1: Detect intent with FULL context (Requirement 1)
  console.log('[AgenticEditor] 🔍 Step 1: Detecting edit intent...');
  const intentResult = await detectEditIntentWithFullContext(fullContext);

  if (!intentResult.shouldEdit) {
    console.log('[AgenticEditor] ❌ No edit needed - User message is not requesting changes');
    console.log(`[AgenticEditor] 📊 Confidence: ${(intentResult.confidence * 100).toFixed(0)}%`);
    console.log(`[AgenticEditor] 💭 Reasoning: ${intentResult.reasoning}`);
    console.log('[AgenticEditor] 💬 Evelyn will respond conversationally instead');
    return {
      success: false,
      editedContent: documentContent,
      changes: [],
      goalAchieved: false,
      iterations: [],
      summary: 'No edit intent detected'
    };
  }

  console.log('[AgenticEditor] ✅ Edit intent CONFIRMED!');
  console.log(`[AgenticEditor] 📊 Confidence: ${(intentResult.confidence * 100).toFixed(0)}%`);
  console.log(`[AgenticEditor] 💭 Reasoning: ${intentResult.reasoning}`);

  if (!intentResult.editingGoal) {
    console.error('[AgenticEditor] ❌ Edit intent detected but no goal provided');
    return {
      success: false,
      editedContent: documentContent,
      changes: [],
      goalAchieved: false,
      iterations: [],
      summary: 'Could not determine editing goal from user message'
    };
  }

  // Validate goal has required fields
  if (!intentResult.editingGoal.goal || !intentResult.editingGoal.approach) {
    console.error('[AgenticEditor] ❌ Invalid editing goal:', intentResult.editingGoal);
    return {
      success: false,
      editedContent: documentContent,
      changes: [],
      goalAchieved: false,
      iterations: [],
      summary: 'Editing goal is incomplete or invalid'
    };
  }

  // Log the editing goal clearly
  console.log('[AgenticEditor] 📋 EDITING GOAL ESTABLISHED:');
  console.log(`[AgenticEditor] 🎯 Goal: ${intentResult.editingGoal.goal}`);
  console.log(`[AgenticEditor] 📝 Approach: ${intentResult.editingGoal.approach}`);
  console.log(`[AgenticEditor] ✅ Expected changes: ${intentResult.editingGoal.expectedChanges.length}`);
  intentResult.editingGoal.expectedChanges.forEach((change, i) => {
    console.log(`[AgenticEditor]    ${i + 1}. ${change}`);
  });
  console.log(`[AgenticEditor] 💡 Complexity: ${intentResult.editingGoal.estimatedComplexity}`);
  console.log('[AgenticEditor] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Step 2: Execute agentic editing loop (Requirement 2 & 3)
  console.log('[AgenticEditor] 🔄 Step 2: Starting agentic editing loop...');
  const editResult = await executeAgenticEditingLoop(fullContext, intentResult.editingGoal, activityId, socket);

  console.log('[AgenticEditor] ✅ Agentic edit workflow complete:', editResult.summary);

  return editResult;
}

export default {
  executeAgenticEdit,
  detectEditIntentWithFullContext
};

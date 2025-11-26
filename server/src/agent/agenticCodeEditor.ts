import { Socket } from 'socket.io';
import { openRouterClient } from '../providers/openrouter.js';
import { db } from '../db/client.js';
import { personalityEngine } from './personality.js';
import { createCursorPresence, findTextRange, CursorPresenceEmitter } from './cursorPresence.js';
import { MODELS, COLLABORATE_CONFIG } from '../constants/index.js';
import {
  buildEnhancedSystemPrompt,
  buildIterationPrompt,
  parseStructuredThought,
  decomposeGoal,
  StructuredThought,
  EditPlan
} from './agenticPrompts.js';
import {
  ToolParser,
  EditVerifier,
  CheckpointManager,
  createToolParser,
  createEditVerifier,
  createCheckpointManager,
  ParseResult,
  VerifyResult
} from './agenticToolParser.js';

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
  structuredThought?: StructuredThought;
  toolCall?: ToolCall;
  toolResult?: any;
  goalStatus: 'in_progress' | 'achieved' | 'blocked';
  subGoalId?: string;
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
  const MAX_INTENT_CONTENT = COLLABORATE_CONFIG.AGENTIC_EDIT.INTENT_TRUNCATION_LIMIT;
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
        MODELS.AGENT,
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
  const MAX_ITERATIONS = COLLABORATE_CONFIG.AGENTIC_EDIT.MAX_ITERATIONS;
  const ITERATION_TIMEOUT_MS = COLLABORATE_CONFIG.AGENTIC_EDIT.ITERATION_TIMEOUT_MS;
  const TOTAL_TIMEOUT_MS = COLLABORATE_CONFIG.AGENTIC_EDIT.TOTAL_TIMEOUT_MS;
  
  const startTime = Date.now();

  // Build edit plan with goal decomposition (Phase 1 improvement)
  const editPlan = decomposeGoal(
    context.userMessage,
    context.documentContent,
    context.documentType
  );
  console.log(`[AgenticEditor] 📋 Edit plan: ${editPlan.subGoals.length} sub-goals`);

  // Initialize Phase 2 components
  const toolParser = createToolParser();
  const editVerifier = createEditVerifier();
  const checkpointManager = createCheckpointManager(10);
  
  // Create initial checkpoint
  checkpointManager.create(currentContent, 0, 'Initial document state');
  console.log(`[AgenticEditor] 🔒 Checkpoint system initialized`);

  // Build the enhanced agentic prompt (Phase 1 improvement)
  const agenticSystemPrompt = buildEnhancedSystemPrompt({
    evelynSystemPrompt: context.evelynSystemPrompt,
    evelynMood: context.evelynMood,
    documentTitle: context.documentTitle,
    documentContent: context.documentContent,
    language: context.language || null,
    contentType: context.documentType,
    userMessage: context.userMessage,
    goal
  });
  
  console.log(`[AgenticEditor] 📝 Using enhanced system prompt (${agenticSystemPrompt.length} chars)`);

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

    // Build iteration prompt with enhanced format (Phase 1 improvement)
    const iterationPrompt = buildIterationPrompt(
      iteration,
      currentContent,
      context.documentTitle,
      changes,
      editPlan
    );

    conversationHistory.push({ role: 'user', content: iterationPrompt });

    // Emit thinking state before LLM call
    if (socket) {
      const cursorPresence = createCursorPresence(socket, context.documentId);
      cursorPresence.emitThinking(`Iteration ${iteration + 1}: Planning next step...`);
    }

    // Get Evelyn's next action (think + tool call) with iteration timeout
    console.log(`[AgenticEditor] 🤔 Waiting for LLM response (iteration ${iteration + 1})...`);
    let response: string;
    
    try {
      // Wrap LLM call with iteration-specific timeout
      response = await Promise.race([
        openRouterClient.complete(
          conversationHistory,
          MODELS.AGENT,
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
    
    // Parse structured thought (Phase 1 improvement)
    const structuredThought = parseStructuredThought(response);
    if (structuredThought) {
      console.log(`[AgenticEditor] 🧠 Structured thought:`);
      console.log(`  - Observation: ${structuredThought.observation.slice(0, 60)}...`);
      console.log(`  - Plan: ${structuredThought.plan.slice(0, 60)}...`);
      console.log(`  - Risk: ${structuredThought.risk}, Confidence: ${structuredThought.confidence}`);
    }

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
        structuredThought: structuredThought || undefined,
        goalStatus: 'achieved'
      });
      break;
    }

    // Parse tool call using robust parser (Phase 2 improvement)
    const parseResult = toolParser.parse(response);
    
    if (!parseResult.success || !parseResult.toolCall) {
      console.log('[AgenticEditor] ⚠️ Tool parsing failed');
      console.log('[AgenticEditor] Error:', parseResult.error);
      if (parseResult.suggestions) {
        console.log('[AgenticEditor] Suggestions:', parseResult.suggestions);
      }
      console.log('[AgenticEditor] Response:', response.slice(0, 200));
      
      // If we've made changes and there's no tool call, assume goal is achieved
      if (changes.length > 0) {
        console.log('[AgenticEditor] ✅ Assuming goal achieved (changes made, no more tools requested)');
        iterations.push({
          step: iteration + 1,
          think: thinking,
          structuredThought: structuredThought || undefined,
          goalStatus: 'achieved'
        });
        break;
      } else {
        console.log('[AgenticEditor] ❌ No changes made and no tool call - marking as blocked');
        iterations.push({
          step: iteration + 1,
          think: thinking,
          structuredThought: structuredThought || undefined,
          goalStatus: 'blocked'
        });
        break;
      }
    }

    const { tool: toolName, params, corrections, confidence } = parseResult.toolCall;
    
    // Log parse results
    if (corrections.length > 0) {
      console.log(`[AgenticEditor] 🔧 Tool parsed with corrections:`, corrections);
    }
    console.log(`[AgenticEditor] 🔧 Tool: ${toolName} (confidence: ${confidence.toFixed(2)}) with params:`, Object.keys(params));
    console.log(`[AgenticEditor] ⏳ Executing tool: ${toolName}...`);

    // Create cursor presence emitter if socket is available
    let cursorPresence: CursorPresenceEmitter | null = null;
    if (socket) {
      cursorPresence = createCursorPresence(socket, context.documentId);
    }

    // Execute tool with cursor presence events
    let toolResult: any;
    try {
      // Emit tool-specific cursor events
      if (cursorPresence) {
        if (toolName === 'read_file') {
          cursorPresence.emitReading(1, 1);
        } else if (toolName === 'search_files' && params.pattern) {
          cursorPresence.emitSearching(params.pattern);
        } else if (toolName === 'replace_in_file' && params.content) {
          // Find the text being searched for and highlight it
          const searchMatch = params.content.match(/<<<+\s*SEARCH\s*\n([\s\S]*?)\n\s*=+/);
          if (searchMatch) {
            const searchText = searchMatch[1].trim();
            const range = findTextRange(currentContent, searchText);
            if (range) {
              cursorPresence.emitSelecting(range);
            }
          }
        } else if (toolName === 'write_to_file') {
          cursorPresence.emitTyping(1, 1);
        }
      }

      if (toolName in tools) {
        toolResult = await tools[toolName](params as any, { ...context, documentContent: currentContent });

        // Update working content if tool modified it
        if (toolName === 'write_to_file' && params.content) {
          const oldContent = currentContent;
          currentContent = params.content;
          
          // Verify edit (Phase 2 improvement)
          const verifyResult = editVerifier.verify(
            oldContent,
            currentContent,
            'Complete rewrite',
            context.language || undefined
          );
          console.log(`[AgenticEditor] 🔍 Verification: ${verifyResult.diffSummary}, confidence: ${verifyResult.confidence.toFixed(2)}`);
          if (verifyResult.warnings.length > 0) {
            console.log(`[AgenticEditor] ⚠️ Warnings:`, verifyResult.warnings);
          }
          
          // Create checkpoint (Phase 2 improvement)
          checkpointManager.create(currentContent, iteration + 1, 'After write_to_file');
          
          changes.push({
            type: 'write',
            description: 'Rewrote entire document',
            after: currentContent.slice(0, 200) + '...'
          });
        } else if (toolName === 'replace_in_file' && toolResult.success && toolResult.modifiedContent) {
          // CRITICAL FIX: Use the modified content from the tool, don't re-parse
          const oldContent = currentContent;
          currentContent = toolResult.modifiedContent;
          
          // Verify edit (Phase 2 improvement)
          const verifyResult = editVerifier.verify(
            oldContent,
            currentContent,
            `Replace: ${toolResult.replacements} replacement(s)`,
            context.language || undefined
          );
          console.log(`[AgenticEditor] 🔍 Verification: ${verifyResult.diffSummary}, confidence: ${verifyResult.confidence.toFixed(2)}`);
          if (verifyResult.warnings.length > 0) {
            console.log(`[AgenticEditor] ⚠️ Warnings:`, verifyResult.warnings);
          }
          if (!verifyResult.syntaxValid) {
            console.log(`[AgenticEditor] ⚠️ Syntax validation failed - edit may have issues`);
          }
          
          // Create checkpoint (Phase 2 improvement)
          checkpointManager.create(currentContent, iteration + 1, `After replace_in_file (${toolResult.replacements} changes)`);
          
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
      structuredThought: structuredThought || undefined,
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
  
  // Log checkpoint summary (Phase 2)
  const checkpoints = checkpointManager.list();
  console.log(`[AgenticEditor] 🔒 Created ${checkpoints.length} checkpoints during edit`);

  return {
    success: goalAchieved,
    editedContent: currentContent,
    changes,
    goalAchieved,
    iterations,
    summary: `Completed in ${iterations.length} iterations. ${changes.length} changes made. ${checkpoints.length} checkpoints created.`
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

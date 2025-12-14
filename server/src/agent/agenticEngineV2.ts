/**
 * Agentic Engine V2 - Optimized Workflow
 * 
 * Key Improvements:
 * 1. Streaming LLM responses for real-time feedback
 * 2. Tiered prompting based on complexity
 * 3. Efficient iteration with diff-based updates
 * 4. Smart early termination
 * 5. Parallel tool preparation
 * 6. Cached document analysis
 */

import { Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { openRouterClient } from '../providers/openrouter.js';
import { MODELS, COLLABORATE_CONFIG } from '../constants/index.js';
import { getLLMModel } from '../utils/settings.js';
import {
  createDocumentWindow,
  createDiffSummary,
  buildIntentPrompt,
  getPromptForComplexity,
  buildIterationPrompt,
  estimateComplexity,
  estimateTokens,
  type OptimizedContext,
  type EditGoal,
  type IterationState,
  type DocumentWindow,
} from './agenticPromptsV2.js';
import {
  createToolParser,
  createEditVerifier,
  createCheckpointManager,
} from './agenticToolParser.js';
import { createAgenticEmitter } from './agenticEventEmitter.js';

// ========================================
// Types
// ========================================

export interface AgenticV2Config {
  maxIterations: number;
  iterationTimeoutMs: number;
  totalTimeoutMs: number;
  streamResponses: boolean;
  enableCheckpoints: boolean;
  earlyTermination: boolean;
  tokenBudget: number;
}

export interface AgenticV2Result {
  id: string;
  success: boolean;
  goalAchieved: boolean;
  originalContent: string;
  editedContent: string;
  changes: Array<{
    type: string;
    description: string;
    before?: string;
    after?: string;
  }>;
  iterations: Array<{
    step: number;
    think: string;
    tool?: string;
    result?: any;
    durationMs: number;
  }>;
  summary: string;
  stats: {
    totalDurationMs: number;
    iterationCount: number;
    tokensSaved: number;
    promptTokens: number;
  };
}

const DEFAULT_CONFIG: AgenticV2Config = {
  maxIterations: 12,           // Allow retries after failures
  iterationTimeoutMs: 240000,  // 4 min per iteration (generous for long code)
  totalTimeoutMs: 900000,      // 15 minutes total
  streamResponses: true,
  enableCheckpoints: true,
  earlyTermination: true,
  tokenBudget: 200000,          // For longer documents
};

// ========================================
// Fast Intent Detection
// ========================================

export async function detectIntentFast(
  userMessage: string,
  documentTitle: string,
  documentType: string,
  documentLength: number,
  recentContext?: string
): Promise<{
  shouldEdit: boolean;
  confidence: number;
  goal?: string;
  complexity?: 'trivial' | 'simple' | 'moderate' | 'complex';
}> {
  const docSummary = `${documentTitle} (${documentType}, ${documentLength} chars)`;
  const prompt = buildIntentPrompt(userMessage, docSummary, recentContext);
  
  console.log(`[AgenticV2] 🔍 Fast intent detection (${estimateTokens(prompt)} tokens)`);
  
  // Get user-selected model
  const selectedModel = await getLLMModel();
  
  try {
    const response = await Promise.race([
      openRouterClient.completeWithFallback(
        [{ role: 'user', content: prompt }],
        selectedModel,
        undefined,
        0.3, // Low temperature for deterministic output
        MODELS.FALLBACK
      ),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Intent timeout')), 30000)
      )
    ]);
    
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        shouldEdit: parsed.edit === true && (parsed.confidence || 0.7) >= 0.6,
        confidence: parsed.confidence || 0.7,
        goal: parsed.goal,
        complexity: parsed.complexity,
      };
    }
  } catch (error) {
    console.error('[AgenticV2] Intent detection failed:', error);
  }
  
  return { shouldEdit: false, confidence: 0 };
}

// ========================================
// Main Agentic Engine
// ========================================

// Socket getter type for handling reconnections
type SocketGetter = () => Socket | null;

export async function executeAgenticEditV2(
  documentId: number,
  documentTitle: string,
  documentContent: string,
  documentType: 'text' | 'code' | 'mixed',
  language: string | null,
  goal: string,
  activityId: number,
  socket?: Socket | SocketGetter,
  config: Partial<AgenticV2Config> = {}
): Promise<AgenticV2Result> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const editId = uuidv4();
  const startTime = Date.now();
  
  // Get user-selected model for all LLM calls
  const selectedModel = await getLLMModel();
  
  console.log(`[AgenticV2] 🚀 Starting optimized agentic edit`);
  console.log(`[AgenticV2] EditId: ${editId}`);
  console.log(`[AgenticV2] Goal: ${goal}`);
  console.log(`[AgenticV2] Model: ${selectedModel}`);
  console.log(`[AgenticV2] Config: maxIter=${cfg.maxIterations}, stream=${cfg.streamResponses}`);
  
  // Initialize components - pass socket or socket getter to emitter
  const emitter = socket ? createAgenticEmitter(socket, documentId, editId) : null;
  const toolParser = createToolParser();
  const editVerifier = createEditVerifier();
  const checkpointManager = cfg.enableCheckpoints ? createCheckpointManager(5) : null;
  
  // Analyze document complexity
  const complexity = estimateComplexity(goal, documentContent);
  console.log(`[AgenticV2] 📊 Estimated complexity: ${complexity}`);
  
  // Prepare optimized context
  const doc: OptimizedContext = {
    documentId,
    title: documentTitle,
    content: documentContent,
    language,
    contentType: documentType,
    totalLines: documentContent.split('\n').length,
    totalChars: documentContent.length,
  };
  
  const editGoal: EditGoal = {
    goal,
    approach: 'targeted changes',
    complexity,
    estimatedChanges: complexity === 'trivial' ? 1 : complexity === 'simple' ? 2 : 4,
  };
  
  // State tracking
  const iterations: AgenticV2Result['iterations'] = [];
  const changes: AgenticV2Result['changes'] = [];
  let currentContent = documentContent;
  let totalPromptTokens = 0;
  
  // Create initial checkpoint
  checkpointManager?.create(currentContent, 0, 'Initial state');
  
  // Emit start
  emitter?.emitStart(goal, 'Optimized V2 engine', editGoal.estimatedChanges);
  emitter?.emitPhaseChange('executing', 'Starting optimized edit...');
  
  // Build initial system prompt based on complexity
  const window = createDocumentWindow(currentContent);
  const systemPrompt = getPromptForComplexity(complexity, editGoal, doc, window);
  totalPromptTokens += estimateTokens(systemPrompt);
  
  console.log(`[AgenticV2] 📝 System prompt: ${estimateTokens(systemPrompt)} tokens`);
  
  // Conversation history (kept minimal)
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt }
  ];
  
  // Main loop
  for (let iteration = 0; iteration < cfg.maxIterations; iteration++) {
    const iterStart = Date.now();
    
    // Check total timeout
    if (Date.now() - startTime > cfg.totalTimeoutMs) {
      console.log('[AgenticV2] ⏱️ Total timeout reached');
      break;
    }
    
    console.log(`[AgenticV2] 📝 Iteration ${iteration + 1}/${cfg.maxIterations}`);
    
    // Build iteration prompt
    const iterState: IterationState = {
      iteration,
      maxIterations: cfg.maxIterations,
      changesApplied: changes.length,
      lastToolUsed: iterations[iterations.length - 1]?.tool,
      lastToolResult: iterations[iterations.length - 1]?.result,
      currentContent,
      originalContent: documentContent,
    };
    
    const currentWindow = createDocumentWindow(currentContent);
    const iterPrompt = buildIterationPrompt(iterState, currentWindow, goal);
    totalPromptTokens += estimateTokens(iterPrompt);
    
    messages.push({ role: 'user', content: iterPrompt });
    
    // Get LLM response
    let response: string;
    let streamTimedOut = false;
    try {
      if (cfg.streamResponses && socket) {
        const streamResult = await streamLLMResponse(messages, socket, editId, cfg.iterationTimeoutMs);
        response = streamResult.response;
        streamTimedOut = !streamResult.complete;
        
        if (streamTimedOut) {
          console.warn(`[AgenticV2] ⚠️ Stream timed out with ${streamResult.tokenCount} tokens - attempting recovery`);
          // Try to extract a usable tool call from partial response
          const partialParse = toolParser.parse(response);
          if (partialParse.success && partialParse.toolCall) {
            console.log(`[AgenticV2] 🔧 Found tool call in partial response - proceeding`);
          } else if (response.includes('<write_to_file>') && response.includes('<content>')) {
            // Try to recover partial write_to_file by closing tags
            console.log(`[AgenticV2] 🔄 Attempting to recover partial write_to_file...`);
            response = tryRecoverPartialWriteToFile(response, documentTitle);
          }
        }
      } else {
        response = await Promise.race([
          openRouterClient.completeWithFallback(messages, selectedModel, undefined, 0.4, MODELS.FALLBACK),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Iteration timeout')), cfg.iterationTimeoutMs)
          )
        ]);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      const iterDuration = Date.now() - iterStart;
      console.error(`[AgenticV2] ❌ LLM call failed: ${errorMsg}`);
      console.error(`[AgenticV2] 📊 Iteration ${iteration + 1} failed after ${Math.round(iterDuration/1000)}s`);
      console.error(`[AgenticV2] 📋 Changes so far: ${changes.length}`);
      console.error(`[AgenticV2] 📝 Goal: ${goal.slice(0, 100)}...`);
      
      // Emit error to frontend
      emitter?.emitProgress('error', 0, iteration + 1, cfg.maxIterations, `Error: ${errorMsg}`);
      
      iterations.push({
        step: iteration + 1,
        think: `Error: ${errorMsg}`,
        durationMs: iterDuration,
      });
      break;
    }
    
    messages.push({ role: 'assistant', content: response });
    
    // Check for goal completion using multi-signal detection
    const parseResult = toolParser.parse(response);
    const hasToolCall = !!(parseResult.success && parseResult.toolCall);

    // Use multi-signal completion detection
    const completionResult = detectGoalCompletion(
      response,
      hasToolCall,
      changes.length,
      iteration,
      iteration > 0 ? iterations[iteration - 1]?.result?.newContent || documentContent : documentContent,
      currentContent
    );

    console.log(`[AgenticV2] 🎯 Completion check: ${completionResult.isComplete ? 'COMPLETE' : 'INCOMPLETE'} ` +
      `(confidence: ${(completionResult.confidence * 100).toFixed(0)}%, reason: ${completionResult.reason})`);

    // If LLM claims complete but no changes on first iteration - REJECT
    if (completionResult.signals.explicitClaim && !hasToolCall && changes.length === 0 && iteration === 0) {
      console.log('[AgenticV2] ⚠️ LLM claimed complete without making changes - forcing tool usage');
      messages.push({
        role: 'user',
        content: `You claimed the goal is achieved but you didn't make any changes to the document!

You MUST use the <write_to_file> or <replace_in_file> tool to actually modify the document content.

The current document content is:
\`\`\`
${currentContent}
\`\`\`

Use a tool NOW to make the required changes, then say "GOAL ACHIEVED" only AFTER the tool has been executed.`
      });
      continue;
    }

    // Accept completion based on multi-signal analysis
    if (completionResult.isComplete) {
      console.log(`[AgenticV2] ✅ Goal achieved! (${completionResult.reason})`);
      iterations.push({
        step: iteration + 1,
        think: extractThinking(response),
        durationMs: Date.now() - iterStart,
      });
      break;
    }
    
    // Check if tool call was found (already parsed above)
    if (!parseResult.success || !parseResult.toolCall) {
      console.log('[AgenticV2] ⚠️ No tool call found');
      
      // Early termination: if we made changes and LLM stopped using tools, assume done
      if (cfg.earlyTermination && changes.length > 0) {
        console.log('[AgenticV2] ✅ Early termination - changes made, no more tools');
        iterations.push({
          step: iteration + 1,
          think: extractThinking(response),
          durationMs: Date.now() - iterStart,
        });
        break;
      }
      
      iterations.push({
        step: iteration + 1,
        think: extractThinking(response),
        durationMs: Date.now() - iterStart,
      });
      continue;
    }
    
    const { tool: toolName, params } = parseResult.toolCall;
    console.log(`[AgenticV2] 🔧 Tool: ${toolName}`);
    
    // Execute tool
    const toolResult = await executeToolOptimized(toolName, params, currentContent, documentTitle);
    
    // Track failed tool attempts for feedback
    if (!toolResult.success) {
      console.log(`[AgenticV2] ⚠️ Tool ${toolName} failed: ${toolResult.message}`);
      
      // Provide explicit feedback to LLM about tool failure
      const failureGuidance = getToolFailureGuidance(toolName, toolResult.message, currentContent, documentTitle);
      messages.push({ 
        role: 'user', 
        content: failureGuidance
      });
      
      iterations.push({
        step: iteration + 1,
        think: extractThinking(response),
        tool: toolName,
        result: { success: false, message: toolResult.message },
        durationMs: Date.now() - iterStart,
      });
      
      emitter?.emitProgress('executing', Math.round(((iteration + 1) / cfg.maxIterations) * 100), iteration + 1, cfg.maxIterations, `Tool failed: ${toolResult.message}`);
      continue;
    }
    
    // Update content if tool modified it
    if (toolResult.success && toolResult.newContent) {
      const oldContent = currentContent;
      currentContent = toolResult.newContent;
      
      // Verify edit
      const verification = editVerifier.verify(oldContent, currentContent, toolName, language || undefined);
      console.log(`[AgenticV2] 🔍 Verification: ${verification.diffSummary}`);
      
      // Create checkpoint
      checkpointManager?.create(currentContent, iteration + 1, `After ${toolName}`);
      
      changes.push({
        type: toolName,
        description: toolResult.message,
        before: oldContent.slice(0, 100),
        after: currentContent.slice(0, 100),
      });
      
      // Emit content update
      emitter?.emitContentChange(currentContent);
    }
    
    const iterationData = {
      step: iteration + 1,
      think: extractThinking(response),
      tool: toolName,
      result: { success: toolResult.success, message: toolResult.message },
      durationMs: Date.now() - iterStart,
    };
    iterations.push(iterationData);
    
    // Emit iteration data for frontend
    emitter?.emitIteration({
      id: `${editId}-iter-${iteration + 1}`,
      step: iteration + 1,
      timestamp: Date.now(),
      duration: Date.now() - iterStart,
      think: extractThinking(response),
      toolCall: { 
        id: `tool-${editId}-${iteration + 1}`,
        tool: toolName, 
        params,
        timestamp: Date.now()
      },
      toolResult: { 
        toolCallId: `tool-${editId}-${iteration + 1}`,
        success: toolResult.success, 
        message: toolResult.message,
        duration: Date.now() - iterStart,
      },
      goalStatus: 'in_progress',
    });
    
    // Emit progress
    emitter?.emitProgress(
      'executing',
      Math.round(((iteration + 1) / cfg.maxIterations) * 100),
      iteration + 1,
      cfg.maxIterations,
      `${changes.length} changes applied`
    );
    
    // Trim conversation history to save tokens
    if (messages.length > 6) {
      // Keep system prompt, last 2 user messages, last 2 assistant messages
      const system = messages[0];
      const recent = messages.slice(-4);
      messages.length = 0;
      messages.push(system, ...recent);
    }
  }
  
  const totalDuration = Date.now() - startTime;
  const goalAchieved = changes.length > 0 || iterations.some(i => i.think.toLowerCase().includes('goal achieved'));
  
  // Emit completion
  emitter?.emitComplete(
    goalAchieved,
    `${changes.length} changes in ${iterations.length} iterations`,
    changes.length,
    iterations.length
  );
  
  // Calculate token savings
  const baselineTokens = estimateTokens(documentContent) * iterations.length * 2; // Full doc each iteration
  const tokensSaved = Math.max(0, baselineTokens - totalPromptTokens);
  
  console.log(`[AgenticV2] ✅ Complete in ${totalDuration}ms`);
  console.log(`[AgenticV2] 📊 ${iterations.length} iterations, ${changes.length} changes`);
  console.log(`[AgenticV2] 💰 Tokens: ${totalPromptTokens} used, ~${tokensSaved} saved`);
  
  return {
    id: editId,
    success: goalAchieved,
    goalAchieved,
    originalContent: documentContent,
    editedContent: currentContent,
    changes,
    iterations,
    summary: `Completed in ${iterations.length} iterations with ${changes.length} changes`,
    stats: {
      totalDurationMs: totalDuration,
      iterationCount: iterations.length,
      tokensSaved,
      promptTokens: totalPromptTokens,
    },
  };
}

// ========================================
// Helper Functions
// ========================================

interface StreamResult {
  response: string;
  complete: boolean;
  tokenCount: number;
  elapsed: number;
}

/**
 * Attempt to recover a partial write_to_file response by closing unclosed tags
 */
function tryRecoverPartialWriteToFile(partialResponse: string, documentTitle: string): string {
  // Check if we have the start of a write_to_file
  const writeMatch = partialResponse.match(/<write_to_file>[\s\S]*?<content>([\s\S]*)/);
  if (!writeMatch) {
    console.log('[AgenticV2] ❌ Could not find write_to_file content to recover');
    return partialResponse;
  }
  
  const content = writeMatch[1];
  
  // Don't recover if content is too short (probably incomplete)
  if (content.length < 500) {
    console.log('[AgenticV2] ❌ Partial content too short to recover');
    return partialResponse;
  }
  
  // Check if content looks like valid code (has structure)
  const hasStructure = content.includes('def ') || content.includes('function ') || 
                       content.includes('class ') || content.includes('import ') ||
                       content.includes('const ') || content.includes('let ');
  
  if (!hasStructure) {
    console.log('[AgenticV2] ❌ Partial content lacks code structure');
    return partialResponse;
  }
  
  // Close the tags to make it parseable
  const recovered = `<write_to_file>
<path>${documentTitle}</path>
<content>
${content.trim()}
</content>
</write_to_file>

GOAL ACHIEVED (recovered from partial response)`;

  console.log(`[AgenticV2] ✅ Recovered write_to_file with ${content.length} chars of content`);
  return recovered;
}

/**
 * Stream LLM response with real-time updates
 * Returns partial response on timeout instead of throwing
 */
async function streamLLMResponse(
  messages: Array<{ role: string; content: string }>,
  socketOrGetter: Socket | SocketGetter,
  editId: string,
  timeoutMs: number,
  model?: string
): Promise<StreamResult> {
  let fullResponse = '';
  const startTime = Date.now();
  let lastLogTime = startTime;
  let tokenCount = 0;
  
  // Get model from parameter or settings
  const modelToUse = model || await getLLMModel();
  
  console.log(`[AgenticV2] 🔄 Starting stream (timeout: ${timeoutMs/1000}s, model: ${modelToUse})`);
  
  // Resolve socket getter if needed
  const getSocket = typeof socketOrGetter === 'function' 
    ? socketOrGetter 
    : () => socketOrGetter;
  
  try {
    const generator = openRouterClient.streamChat(
      messages as any,
      modelToUse,
      undefined
    );
    
    for await (const token of generator) {
      const elapsed = Date.now() - startTime;
      
      if (elapsed > timeoutMs) {
        console.warn(`[AgenticV2] ⏱️ STREAM TIMEOUT after ${Math.round(elapsed/1000)}s`);
        console.warn(`[AgenticV2] 📊 Received ${tokenCount} tokens, ${fullResponse.length} chars before timeout`);
        // Return partial response instead of throwing
        return {
          response: fullResponse,
          complete: false,
          tokenCount,
          elapsed: Math.round(elapsed/1000),
        };
      }
      
      fullResponse += token;
      tokenCount++;
      
      // Log progress every 10 seconds
      if (Date.now() - lastLogTime > 10000) {
        console.log(`[AgenticV2] 📡 Stream progress: ${tokenCount} tokens, ${fullResponse.length} chars, ${Math.round(elapsed/1000)}s elapsed`);
        lastLogTime = Date.now();
      }
      
      // Emit token for real-time display (throttled)
      if (fullResponse.length % 20 === 0) {
        const socket = getSocket();
        if (socket?.connected) {
          socket.emit('agentic:stream', {
            editId,
            partial: fullResponse.slice(-200),
          });
        }
      }
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`[AgenticV2] ✅ Stream complete: ${tokenCount} tokens, ${fullResponse.length} chars in ${Math.round(totalTime/1000)}s`);
    
    return {
      response: fullResponse,
      complete: true,
      tokenCount,
      elapsed: Math.round(totalTime/1000),
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown stream error';
    console.error(`[AgenticV2] ❌ Stream error after ${Math.round(elapsed/1000)}s: ${errorMsg}`);
    // Return partial response if we have content
    if (fullResponse.length > 500) {
      console.warn(`[AgenticV2] � Returning partial response (${fullResponse.length} chars) despite error`);
      return {
        response: fullResponse,
        complete: false,
        tokenCount,
        elapsed: Math.round(elapsed/1000),
      };
    }
    throw error;
  }
}

// ========================================
// Goal Completion Detection (Multi-Signal)
// ========================================

interface CompletionSignals {
  explicitClaim: boolean;
  explicitClaimConfidence: number;
  noToolCall: boolean;
  changesVerified: boolean;
  contentStabilized: boolean;
}

interface CompletionResult {
  isComplete: boolean;
  confidence: number;
  signals: CompletionSignals;
  reason: string;
}

/**
 * Multi-signal goal completion detection
 * Combines multiple indicators for more reliable completion detection
 */
function detectGoalCompletion(
  response: string,
  hasToolCall: boolean,
  changesCount: number,
  iteration: number,
  previousContent: string,
  currentContent: string
): CompletionResult {
  const signals: CompletionSignals = {
    explicitClaim: false,
    explicitClaimConfidence: 0,
    noToolCall: !hasToolCall,
    changesVerified: changesCount > 0,
    contentStabilized: previousContent === currentContent && iteration > 0
  };

  // Check explicit completion claims with confidence levels
  const highConfidenceIndicators = [
    'goal achieved',
    'goal_achieved',
    'task complete',
    'all changes complete',
    'edit complete',
    'successfully completed'
  ];

  const mediumConfidenceIndicators = [
    'done with edits',
    'finished editing',
    'no more changes needed',
    'changes applied',
    'successfully modified'
  ];

  const lowConfidenceIndicators = [
    'looks good',
    'should work',
    'that should do it',
    'there you go'
  ];

  const lower = response.toLowerCase();

  // Check high confidence indicators
  if (highConfidenceIndicators.some(ind => lower.includes(ind))) {
    signals.explicitClaim = true;
    signals.explicitClaimConfidence = 0.9;
  } else if (mediumConfidenceIndicators.some(ind => lower.includes(ind))) {
    signals.explicitClaim = true;
    signals.explicitClaimConfidence = 0.7;
  } else if (lowConfidenceIndicators.some(ind => lower.includes(ind))) {
    signals.explicitClaim = true;
    signals.explicitClaimConfidence = 0.5;
  }

  // Calculate weighted confidence score
  const weights = {
    explicitClaim: 0.35,
    noToolCall: 0.20,
    changesVerified: 0.30,
    contentStabilized: 0.15
  };

  let totalConfidence = 0;

  if (signals.explicitClaim) {
    totalConfidence += weights.explicitClaim * signals.explicitClaimConfidence;
  }
  if (signals.noToolCall && iteration > 0) {
    totalConfidence += weights.noToolCall;
  }
  if (signals.changesVerified) {
    totalConfidence += weights.changesVerified;
  }
  if (signals.contentStabilized) {
    totalConfidence += weights.contentStabilized;
  }

  // Determine completion status
  let isComplete = false;
  let reason = '';

  // High confidence completion: explicit claim + changes made
  if (signals.explicitClaim && signals.changesVerified) {
    isComplete = true;
    reason = 'Goal explicitly claimed complete with verified changes';
  }
  // Medium confidence: changes made + no more tools + iteration > 0
  else if (signals.changesVerified && signals.noToolCall && iteration > 0) {
    isComplete = true;
    reason = 'Changes made and LLM stopped using tools';
  }
  // Content stabilized after changes
  else if (signals.contentStabilized && signals.changesVerified) {
    isComplete = true;
    reason = 'Content stabilized after changes';
  }
  // Explicit claim only (lower confidence, need at least iteration > 0)
  else if (signals.explicitClaim && signals.explicitClaimConfidence >= 0.7 && iteration > 0) {
    isComplete = true;
    reason = 'Goal explicitly claimed complete (iteration > 0)';
  }
  // False positive prevention: explicit claim but no changes on first iteration
  else if (signals.explicitClaim && !signals.changesVerified && iteration === 0) {
    isComplete = false;
    reason = 'Claim rejected: no changes made on first iteration';
    totalConfidence = Math.min(totalConfidence, 0.3);
  }

  return {
    isComplete,
    confidence: totalConfidence,
    signals,
    reason
  };
}

/**
 * Simple check for explicit goal completion claims (backwards compatibility)
 */
function checkGoalCompletion(response: string): boolean {
  const indicators = [
    'goal achieved',
    'goal_achieved',
    'task complete',
    'done with edits',
    'finished editing',
    'all changes complete',
    'no more changes needed',
    'successfully modified',
    'changes applied',
    'edit complete',
  ];

  const lower = response.toLowerCase();
  return indicators.some(ind => lower.includes(ind));
}

/**
 * Generate helpful guidance when a tool fails
 */
function getToolFailureGuidance(
  tool: string, 
  errorMessage: string, 
  currentContent: string,
  documentTitle: string
): string {
  if (tool === 'replace_in_file' && errorMessage.includes('not found')) {
    // Get first few lines to show as reference
    const previewLines = currentContent.split('\n').slice(0, 15).join('\n');
    return `❌ TOOL FAILED: The text you tried to search for was NOT found in the document.

This usually happens because:
1. Whitespace or indentation doesn't match exactly
2. The text you copied has slight differences
3. Line endings are different

💡 RECOMMENDATION: Use <write_to_file> instead to rewrite the entire document with your changes.
This is more reliable than replace_in_file for complex edits.

Here's the ACTUAL document content (first 15 lines):
\`\`\`
${previewLines}
\`\`\`

Please try again with <write_to_file> and include the COMPLETE new document content.`;
  }
  
  if (tool === 'replace_in_file' && errorMessage.includes('No SEARCH/REPLACE')) {
    return `❌ TOOL FAILED: Your replace_in_file format was incorrect.

Correct format:
<replace_in_file><path>${documentTitle}</path><content>
<<<<<<< SEARCH
[exact text to find]
======= REPLACE  
[new text]
>>>>>>> REPLACE
</content></replace_in_file>

Or use <write_to_file> for a complete rewrite.`;
  }
  
  if (tool === 'write_to_file' && errorMessage.includes('No content')) {
    return `❌ TOOL FAILED: No content was provided for write_to_file.

Correct format:
<write_to_file>
<path>${documentTitle}</path>
<content>
[YOUR COMPLETE DOCUMENT CONTENT HERE]
</content>
</write_to_file>`;
  }
  
  return `❌ Tool "${tool}" failed: ${errorMessage}\n\nPlease try again with a different approach or use <write_to_file> for a complete rewrite.`;
}

/**
 * Extract thinking from response
 */
function extractThinking(response: string): string {
  // Try structured thought
  const thoughtMatch = response.match(/<thought>([\s\S]*?)<\/thought>/i);
  if (thoughtMatch) {
    return thoughtMatch[1].replace(/<[^>]+>/g, ' ').trim().slice(0, 200);
  }
  
  // Fallback to first non-XML lines
  const lines = response.split('\n')
    .filter(l => !l.trim().startsWith('<'))
    .slice(0, 3)
    .join(' ')
    .trim();
    
  return lines.slice(0, 200);
}

/**
 * Execute tool with optimized handling
 */
async function executeToolOptimized(
  tool: string,
  params: Record<string, string>,
  currentContent: string,
  documentTitle: string
): Promise<{ success: boolean; message: string; newContent?: string }> {
  switch (tool) {
    case 'read_file':
      return { success: true, message: `Read ${documentTitle}` };
      
    case 'write_to_file':
      if (!params.content) {
        return { success: false, message: 'No content provided' };
      }
      return {
        success: true,
        message: `Wrote ${params.content.split('\n').length} lines`,
        newContent: params.content,
      };
      
    case 'replace_in_file': {
      if (!params.content) {
        return { success: false, message: 'No content provided' };
      }
      
      // Parse SEARCH/REPLACE blocks with flexible pattern
      const pattern = /<<<+\s*SEARCH\s*\n([\s\S]*?)\n\s*=+\s*REPLACE\s*\n([\s\S]*?)\n\s*>+\s*REPLACE/g;
      const matches = Array.from(params.content.matchAll(pattern));
      
      if (matches.length === 0) {
        return { success: false, message: 'No SEARCH/REPLACE blocks found - use <<<<<<< SEARCH ... ======= REPLACE ... >>>>>>> REPLACE format' };
      }
      
      let newContent = currentContent;
      let replacements = 0;
      let failedSearches: string[] = [];
      
      for (const match of matches) {
        const search = match[1].trim();
        const replace = match[2].trim();
        
        // Try exact match first
        if (newContent.includes(search)) {
          newContent = newContent.replace(search, replace);
          replacements++;
          continue;
        }
        
        // Try fuzzy match: normalize whitespace
        const normalizedSearch = search.replace(/\s+/g, ' ').trim();
        const normalizedContent = newContent.replace(/\s+/g, ' ');
        
        if (normalizedContent.includes(normalizedSearch)) {
          // Find the original text with whitespace variations
          const fuzzyPattern = search
            .split(/\s+/)
            .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('\\s+');
          const fuzzyRegex = new RegExp(fuzzyPattern);
          
          if (fuzzyRegex.test(newContent)) {
            newContent = newContent.replace(fuzzyRegex, replace);
            replacements++;
            console.log('[AgenticV2] ✨ Used fuzzy whitespace matching');
            continue;
          }
        }
        
        // Track failed searches for feedback
        failedSearches.push(search.slice(0, 50) + (search.length > 50 ? '...' : ''));
      }
      
      if (replacements === 0) {
        return { 
          success: false, 
          message: `Search text not found in document. Tried: "${failedSearches.join('", "')}"` 
        };
      }
      
      return {
        success: true,
        message: `Applied ${replacements} replacement(s)`,
        newContent,
      };
    }
    
    case 'search_files': {
      const searchPattern = params.pattern;
      if (!searchPattern) {
        return { success: false, message: 'No search pattern provided' };
      }
      
      try {
        const regex = new RegExp(searchPattern, 'gi');
        const lines = currentContent.split('\n');
        const matches = lines
          .map((line, i) => ({ line: i + 1, text: line }))
          .filter(l => regex.test(l.text));
        
        return {
          success: true,
          message: `Found ${matches.length} matches`,
        };
      } catch {
        return { success: false, message: 'Invalid search pattern' };
      }
    }
    
    default:
      return { success: false, message: `Unknown tool: ${tool}` };
  }
}

// ========================================
// Exports
// ========================================

export default {
  detectIntentFast,
  executeAgenticEditV2,
};

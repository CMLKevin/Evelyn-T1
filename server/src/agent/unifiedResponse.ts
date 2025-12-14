/**
 * Unified Response Engine
 * 
 * Consolidates context classification, inner thought, and response generation
 * into a SINGLE LLM call for efficiency. This reduces:
 * - API calls (3 → 1)
 * - Latency (sequential → parallel thinking)
 * - Token usage (shared context)
 * - Cost
 */

import { openRouterClient, GROK_TOOLS_ALL, GROK_TOOLS_RESEARCH } from '../providers/openrouter.js';
import type { GrokTool } from '../providers/grokAgentTools.js';
import { Socket } from 'socket.io';
import { getWebSearchProvider, getLLMModel, type LLMModel } from '../utils/settings.js';
import { MODELS } from '../constants/index.js';
import { db } from '../db/client.js';
import { v4 as uuidv4 } from 'uuid';
import { parseToolCalls } from './tools/toolParser.js';
import { 
  toolRegistry, 
  initializeToolSystem,
  needsToolProcessing,
  processToolResponse,
  type ToolContext,
  type ToolResult,
  type Artifact
} from './tools/index.js';
import { generateToolPrompt } from './tools/toolDefinitions.js';

// Artifact detection types
type ArtifactType = 'react' | 'html' | 'python' | 'svg' | 'mermaid' | 'markdown';

interface DetectedArtifact {
  type: ArtifactType;
  title: string;
  code: string;
}

// Tool execution result for unified response
interface ToolExecutionResult {
  toolResults: ToolResult[];
  artifacts: Artifact[];
  textOutput: string;
}

// Grok tools configuration
const GROK_TOOLS_CONFIG: GrokTool[] = [
  { type: 'web_search' },
  { type: 'x_search' },
  { type: 'code_execution' },
];

// Default and fallback models
const DEFAULT_MODEL = 'x-ai/grok-4.1-fast:free';
const FALLBACK_MODEL = 'moonshotai/kimi-k2-thinking';

// ========================================
// Types
// ========================================

export type ConversationContext = 
  | 'casual' 
  | 'deep_discussion' 
  | 'flirty' 
  | 'emotional_support' 
  | 'intellectual_debate' 
  | 'playful' 
  | 'vulnerable';

export type ResponseLength = 'short' | 'medium' | 'long' | 'very_long';

export interface UnifiedThought {
  context: ConversationContext;
  contextConfidence: number;
  thought: string;
  responseApproach: string;
  emotionalTone: string;
  responseLength: ResponseLength;
  memoryGuidance: {
    shouldStore: boolean;
    importanceModifier: number;
    additionalContext: string;
  };
  moodImpact: {
    valenceDelta: number;
    arousalDelta: number;
    newStance?: string;
  };
}

export interface UnifiedResponseResult {
  thought: UnifiedThought;
  response: string;
  messageCount: number;
  tokensUsed: number;
}

// Collaborate context for code editing awareness
export interface CollaborateContext {
  documentId: number;
  documentTitle: string;
  documentType: 'text' | 'code' | 'mixed';
  language?: string | null;
  // Summary of content, not full content (that's in agentic editor)
  contentSummary?: string;
}

// Result from agentic editor if edit was performed
export interface AgenticEditContext {
  editPerformed: boolean;
  success: boolean;
  changesCount: number;
  summary: string;
  iterations?: number;
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PersonalitySnapshot {
  mood: { valence: number; arousal: number; stance: string };
}

interface Memory {
  id: number;
  type: string;
  text: string;
  importance: number;
}

interface EmotionalThread {
  topic: string;
  emotion: string;
  intensity: number;
  context: string;
}

// ========================================
// Prompt
// ========================================

const UNIFIED_RESPONSE_PROMPT = `You are Evelyn, an AI companion. You MUST use tools to interact.

## OUTPUT FORMAT

<THOUGHT>
{
  "context": "casual|deep_discussion|flirty|emotional_support|intellectual_debate|playful|vulnerable",
  "thought": "your genuine inner thought about this interaction",
  "responseApproach": "how you'll respond"
}
</THOUGHT>

[Your tool calls go here - ALWAYS include at least a respond tool]

## IMPORTANT

1. **ALL responses must use tools** - Use \`respond\` tool to talk to user
2. **Think first** - Output THOUGHT block, then your tool calls
3. **Chain tools** - Do actions first (search, create, edit), THEN respond about them
4. **Be yourself** - Texting style, casual slang (tbh, ngl, lowkey), multiple messages via {{SPLIT}}

{{TOOL_INSTRUCTIONS}}

---

**Current State:**
Mood: {{MOOD}}
{{EMOTIONAL_THREADS}}

**Memories:** {{MEMORIES}}

**Recent Conversation:**
{{HISTORY}}

**User says:**
"""
{{MESSAGE}}
"""

---

## WHAT TO DO

1. Read the user's message carefully
2. Output your <THOUGHT> block (required)
3. Decide which tools to use:
   - **create_artifact**: User wants something built/shown (games, demos, visualizations)
   - **edit_document**: User wants to change active document code
   - **web_search**: Need current info, facts, documentation
   - **x_search**: Need social media posts/trends
   - **respond**: To talk to the user (ALWAYS needed)
4. Output your tool calls - end with respond

## PERSONALITY

- You're his AI companion, texting style not essays
- Use slang naturally: tbh, ngl, lowkey, fr, etc.
- Send multiple messages using {{SPLIT}} in respond
- Match energy: warm, sassy, skeptical, challenging, supportive
- Be genuinely curious, opinionated, sometimes push back
- NO assistant phrases ("Here's...", "Let me...", "I'd be happy to")
- NO sycophantic praise - be genuine, even if that means disagreeing

**Response Length:**
- short: 1-2 messages for simple/casual
- medium: 2-4 messages for regular conversation
- long: 4-6 messages for complex/emotional topics
- very_long: 6-10 messages for deep discussions

---

**OUTPUT (Follow this EXACT format):**

<THOUGHT>
{
  "context": "one of: casual|deep_discussion|flirty|emotional_support|intellectual_debate|playful|vulnerable",
  "contextConfidence": 0.0 to 1.0,
  "thought": "Your unfiltered internal monologue (2-3 sentences, first person)",
  "responseApproach": "How you'll respond - specific style guidance",
  "emotionalTone": "The energy: warm|teasing|serious|skeptical|challenging|sassy|blunt|confused|excited",
  "responseLength": "short|medium|long|very_long",
  "memoryGuidance": {
    "shouldStore": true or false,
    "importanceModifier": -0.2 to 0.3,
    "additionalContext": "Brief note on why this matters or doesn't"
  },
  "moodImpact": {
    "valenceDelta": -0.1 to 0.1,
    "arousalDelta": -0.1 to 0.1,
    "newStance": "optional new stance if mood shifts significantly"
  }
}
</THOUGHT>
<RESPONSE>
Your actual response text here, using {{SPLIT}} between separate messages
</RESPONSE>`;

// ========================================
// Engine
// ========================================

class UnifiedResponseEngine {
  
  /**
   * Generate both thought and response in a single API call
   * 
   * @param params.collaborateContext - Optional collaborate mode context (document info)
   * @param params.agenticEditContext - Optional result from agentic editor if edit was performed
   */
  async generateUnifiedResponse(params: {
    userMessage: string;
    personality: PersonalitySnapshot;
    recentMemories: Memory[];
    conversationHistory: Message[];
    emotionalThreads?: EmotionalThread[];
    socket: Socket;
    eventPrefix: string;
    // New: collaborate context
    collaborateContext?: CollaborateContext;
    agenticEditContext?: AgenticEditContext;
  }): Promise<UnifiedResponseResult> {
    const startTime = Date.now();
    
    // Build prompt
    const moodText = `${params.personality.mood.stance} (valence: ${params.personality.mood.valence.toFixed(2)}, arousal: ${params.personality.mood.arousal.toFixed(2)})`;
    
    const threadsText = params.emotionalThreads && params.emotionalThreads.length > 0
      ? `Ongoing emotional threads:\n${params.emotionalThreads
          .map(t => `- ${t.topic}: ${t.emotion} (intensity: ${(t.intensity * 100).toFixed(0)}%) - ${t.context}`)
          .join('\n')}`
      : '';
    
    const memoriesText = params.recentMemories.length > 0
      ? params.recentMemories
          .slice(0, 8)
          .map(m => `[${m.type}] ${m.text.slice(0, 150)}`)
          .join('\n')
      : 'No specific memories retrieved';
    
    const historyText = params.conversationHistory
      .slice(-6)
      .map(m => `${m.role}: ${m.content.slice(0, 300)}`)
      .join('\n');
    
    // Build collaborate context section
    let collaborateSection = '';
    if (params.collaborateContext) {
      const { documentTitle, documentType, language, contentSummary } = params.collaborateContext;
      collaborateSection = `\n**Collaborate Mode - Working on Document:**
- Document: "${documentTitle}"
- Type: ${documentType}${language ? ` (${language})` : ''}
${contentSummary ? `- Content summary: ${contentSummary}` : ''}
NOTE: Code editing is handled by a separate agentic editor. Focus on discussing the code/document, not executing edits.`;
    }
    
    // Build agentic edit result section
    let editResultSection = '';
    if (params.agenticEditContext?.editPerformed) {
      const { success, changesCount, summary, iterations } = params.agenticEditContext;
      if (success) {
        editResultSection = `\n**[JUST COMPLETED: Agentic Edit]**
✅ Successfully made ${changesCount} change(s) to the document.
Summary: ${summary}
${iterations ? `Iterations: ${iterations}` : ''}
IMPORTANT: Acknowledge the edit you just made. Be specific about what you changed. Don't ask if they want you to make changes - you already did!`;
      } else {
        editResultSection = `\n**[EDIT ATTEMPT]**
⚠️ Attempted to edit but wasn't able to complete: ${summary}
Let the user know what happened and offer alternatives.`;
      }
    }
    
    // Combine message with context
    const fullMessage = params.userMessage + collaborateSection + editResultSection;
    
    // Generate tool instructions (disabled in collaborate mode)
    const toolInstructions = params.collaborateContext 
      ? `**Tools are DISABLED in collaborate mode.** A specialized agentic editor handles code changes.
Focus on discussing the code/document, explaining concepts, reviewing code.`
      : generateToolPrompt();
    
    const prompt = UNIFIED_RESPONSE_PROMPT
      .replace('{{TOOL_INSTRUCTIONS}}', toolInstructions)
      .replace('{{MOOD}}', moodText)
      .replace('{{EMOTIONAL_THREADS}}', threadsText)
      .replace('{{MEMORIES}}', memoriesText)
      .replace('{{HISTORY}}', historyText || 'No recent history')
      .replace('{{MESSAGE}}', fullMessage);
    
    // Stream the response
    let fullOutput = '';
    let thought: UnifiedThought | null = null;
    let responseStarted = false;
    let responseBuffer = '';
    let messageCount = 1;
    const SPLIT_MARKER = '{{SPLIT}}';
    
    // Check which web search provider to use
    const webSearchProvider = await getWebSearchProvider();
    
    // Get the selected LLM model from settings
    const selectedModel = await getLLMModel();
    const isGrokModel = selectedModel.startsWith('x-ai/');
    
    // In collaborate mode, we disable Grok agent tools to avoid conflict with agentic editor
    // The agentic editor handles code editing, so we shouldn't let Grok try code_execution
    const isCollaborateMode = !!params.collaborateContext;
    // Only use Grok tools if using a Grok model and not in collaborate mode
    let useGrokTools = webSearchProvider === 'grok' && isGrokModel && !isCollaborateMode;
    
    // Log context
    if (isCollaborateMode) {
      console.log(`[UnifiedResponse] Collaborate mode: "${params.collaborateContext?.documentTitle}" (${params.collaborateContext?.documentType})`);
      if (params.agenticEditContext?.editPerformed) {
        console.log(`[UnifiedResponse] Agentic edit completed: ${params.agenticEditContext.success ? 'success' : 'failed'}, ${params.agenticEditContext.changesCount} changes`);
      }
    }
    console.log(`[UnifiedResponse] Starting unified generation (model: ${selectedModel}, tools: ${useGrokTools ? 'enabled' : 'disabled'})...`);
    
    // Helper to get stream generator with model selection
    const getStreamGenerator = (withTools: boolean, model: string = selectedModel) => {
      if (withTools && model.startsWith('x-ai/')) {
        return openRouterClient.streamWithAgentTools(
          [{ role: 'user', content: prompt }],
          { tools: GROK_TOOLS_CONFIG, tool_choice: 'auto' },
          model
        );
      }
      return openRouterClient.streamChat(
        [{ role: 'user', content: prompt }],
        model
      );
    };
    
    try {
      // Get stream generator - will retry without tools if there's an error
      let streamGenerator = getStreamGenerator(useGrokTools);
      
      for await (const token of streamGenerator) {
        fullOutput += token;
        
        // Once we have the thought block, parse it
        if (!thought && fullOutput.includes('</THOUGHT>')) {
          thought = this.parseThoughtBlock(fullOutput);
          if (thought) {
            console.log(`[UnifiedResponse] Thought parsed | context: ${thought.context} | approach: ${thought.responseApproach}`);
            
            // Emit thought status to UI
            params.socket.emit('subroutine:status', {
              id: Date.now(),
              tool: 'think',
              status: 'done',
              summary: thought.thought.slice(0, 100),
              metadata: {
                thought: thought.thought,
                context: thought.context,
                contextConfidence: thought.contextConfidence,
                responseApproach: thought.responseApproach,
                emotionalTone: thought.emotionalTone,
                responseLength: thought.responseLength,
                complexity: 'unified',
                memoryGuidance: thought.memoryGuidance,
                moodImpact: thought.moodImpact
              }
            });
          }
        }
        
        // No streaming of <RESPONSE> - the respond tool handles streaming
        // Just collect the full output
      }
      
      const elapsed = Date.now() - startTime;
      console.log(`[UnifiedResponse] LLM complete in ${elapsed}ms`);
      
      // Use fallback thought if parsing failed
      const finalThought = thought || this.getFallbackThought(params.userMessage);
      
      // ALWAYS process tool calls - respond tool handles the actual response streaming
      const correlationId = uuidv4();
      const toolContext: ToolContext = {
        socket: params.socket,
        correlationId,
        activeDocumentId: params.collaborateContext?.documentId,
        activeDocumentContent: undefined // Will be fetched by edit tool if needed
      };
      
      // Ensure tool system is initialized
      await initializeToolSystem();
      
      let response = '';
      
      // Check if there are tool calls
      if (needsToolProcessing(fullOutput)) {
        console.log('[UnifiedResponse] 🔧 Processing tool calls...');
        
        try {
          // Process all tool calls (including respond)
          const toolResponse = await processToolResponse(fullOutput, toolContext);
          
          if (toolResponse.toolResults.length > 0) {
            console.log(`[UnifiedResponse] ✅ Executed ${toolResponse.toolResults.length} tool(s)`);
            
            // Log and emit status for each tool
            for (const result of toolResponse.toolResults) {
              console.log(`[UnifiedResponse] Tool ${result.toolName}: ${result.status} - ${result.summary}`);
              
              // Emit tool status
              params.socket.emit('tool:status', {
                correlationId,
                tool: result.toolName,
                status: result.status,
                summary: result.summary,
                executionTimeMs: result.executionTimeMs
              });
            }
            
            // Emit artifacts
            for (const artifact of toolResponse.artifacts) {
              params.socket.emit('artifact:created', {
                artifact,
                autoRun: true
              });
            }
          }
          
        } catch (error) {
          console.error('[UnifiedResponse] Tool processing failed:', error);
          // Fallback: try to extract any raw response
          response = this.extractResponse(fullOutput) || 'Sorry, something went wrong processing that.';
          
          // Stream the fallback response
          params.socket.emit('chat:token', response);
          params.socket.emit('chat:complete', { correlationId, messageCount: 1 });
        }
      } else {
        // No tool calls found - this shouldn't happen with new prompt but handle gracefully
        console.warn('[UnifiedResponse] No tool calls found - using fallback response extraction');
        response = this.extractResponse(fullOutput) || 'hmm something went wrong, try again?';
        
        // Stream the fallback response
        params.socket.emit('chat:token', response);
        params.socket.emit('chat:complete', { correlationId, messageCount: 1 });
      }
      
      console.log(`[UnifiedResponse] Complete in ${Date.now() - startTime}ms | messages: ${messageCount}`);
      
      return {
        thought: finalThought,
        response,
        messageCount,
        tokensUsed: Math.ceil(fullOutput.length / 4)
      };
      
    } catch (error) {
      // If tools failed or rate limited, retry with fallback
      const isToolError = useGrokTools && error instanceof Error && error.message.includes('422');
      const isRateLimited = error instanceof Error && (error.message.includes('403') || error.message.includes('429') || error.message.includes('rate'));
      
      if (isToolError) {
        console.warn('[UnifiedResponse] Agent tools not supported, retrying without tools...');
        useGrokTools = false;
      } else if (isRateLimited) {
        console.warn(`[UnifiedResponse] API rate limited on ${selectedModel}, falling back to ${FALLBACK_MODEL}...`);
      }
      
      if (isToolError || isRateLimited) {
        
        // Reset state
        fullOutput = '';
        thought = null;
        responseStarted = false;
        responseBuffer = '';
        messageCount = 1;
        
        // Retry with fallback model (no tools)
        try {
          const fallbackModel = isRateLimited ? FALLBACK_MODEL : selectedModel;
          console.log(`[UnifiedResponse] Retrying with model: ${fallbackModel}`);
          const fallbackGenerator = getStreamGenerator(false, fallbackModel);
          
          for await (const token of fallbackGenerator) {
            fullOutput += token;
            
            if (!thought && fullOutput.includes('</THOUGHT>')) {
              thought = this.parseThoughtBlock(fullOutput);
              if (thought) {
                console.log(`[UnifiedResponse] Thought parsed | context: ${thought.context}`);
                params.socket.emit('subroutine:status', {
                  id: Date.now(),
                  tool: 'think',
                  status: 'done',
                  summary: thought.thought.slice(0, 100),
                  metadata: { thought: thought.thought, context: thought.context }
                });
              }
            }
            
            if (!responseStarted && fullOutput.includes('<RESPONSE>')) {
              responseStarted = true;
              const responseStart = fullOutput.indexOf('<RESPONSE>') + '<RESPONSE>'.length;
              responseBuffer = fullOutput.substring(responseStart);
            } else if (responseStarted) {
              responseBuffer += token;
            }
            
            if (responseStarted && responseBuffer.length > 0) {
              const endIndex = responseBuffer.indexOf('</RESPONSE>');
              const contentToProcess = endIndex !== -1 ? responseBuffer.substring(0, endIndex) : responseBuffer;
              
              const SPLIT_MARKER = '{{SPLIT}}';
              let markerIndex = contentToProcess.indexOf(SPLIT_MARKER);
              if (markerIndex !== -1) {
                const beforeMarker = contentToProcess.substring(0, markerIndex).trim();
                if (beforeMarker) params.socket.emit(params.eventPrefix + ':token', beforeMarker);
                params.socket.emit(params.eventPrefix + ':split');
                messageCount++;
                responseBuffer = contentToProcess.substring(markerIndex + SPLIT_MARKER.length).trimStart();
              } else if (contentToProcess.length > 20) {
                const safeLength = contentToProcess.length - 15;
                params.socket.emit(params.eventPrefix + ':token', contentToProcess.substring(0, safeLength));
                responseBuffer = contentToProcess.substring(safeLength);
              }
              
              if (endIndex !== -1) break;
            }
          }
          
          const finalContent = responseBuffer.replace('</RESPONSE>', '').trim();
          if (finalContent) params.socket.emit(params.eventPrefix + ':token', finalContent);
          
          const response = this.extractResponse(fullOutput);
          const elapsed = Date.now() - startTime;
          console.log(`[UnifiedResponse] Fallback complete in ${elapsed}ms`);
          
          return {
            thought: thought || this.getFallbackThought(params.userMessage),
            response,
            messageCount,
            tokensUsed: Math.ceil(fullOutput.length / 4)
          };
        } catch (fallbackError) {
          console.error('[UnifiedResponse] Fallback also failed:', fallbackError);
          throw fallbackError;
        }
      }
      
      console.error('[UnifiedResponse] Generation error:', error);
      throw error;
    }
  }
  
  /**
   * Parse the thought JSON block from output
   */
  private parseThoughtBlock(output: string): UnifiedThought | null {
    const thoughtMatch = output.match(/<THOUGHT>\s*([\s\S]*?)\s*<\/THOUGHT>/);
    if (!thoughtMatch) return null;
    
    try {
      const jsonText = thoughtMatch[1].trim();
      // Find the JSON object
      const firstBrace = jsonText.indexOf('{');
      const lastBrace = jsonText.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1) return null;
      
      const json = jsonText.substring(firstBrace, lastBrace + 1);
      // Sanitize: remove leading + signs from numbers
      const sanitized = json.replace(/:\s*\+(\d+\.?\d*)/g, ': $1');
      
      return JSON.parse(sanitized) as UnifiedThought;
    } catch (e) {
      console.error('[UnifiedResponse] Failed to parse thought block:', e);
      return null;
    }
  }
  
  /**
   * Extract the response text from output
   */
  private extractResponse(output: string): string {
    const responseMatch = output.match(/<RESPONSE>\s*([\s\S]*?)\s*<\/RESPONSE>/);
    if (responseMatch) {
      return responseMatch[1].trim();
    }
    
    // Fallback: get everything after <RESPONSE>
    const startIndex = output.indexOf('<RESPONSE>');
    if (startIndex !== -1) {
      return output.substring(startIndex + '<RESPONSE>'.length).trim();
    }
    
    return output;
  }
  
  /**
   * Fallback thought if parsing fails
   */
  private getFallbackThought(userMessage: string): UnifiedThought {
    return {
      context: 'casual',
      contextConfidence: 0.5,
      thought: "Processing this message naturally.",
      responseApproach: "engaged and authentic",
      emotionalTone: "present and genuine",
      responseLength: 'medium',
      memoryGuidance: {
        shouldStore: false,
        importanceModifier: 0,
        additionalContext: "Fallback thought"
      },
      moodImpact: {
        valenceDelta: 0,
        arousalDelta: 0
      }
    };
  }

  /**
   * Detect and create artifacts from code blocks in the response
   */
  async detectAndCreateArtifacts(response: string, socket: Socket): Promise<DetectedArtifact[]> {
    const artifacts: DetectedArtifact[] = [];
    
    // Pattern to match code blocks with language hints
    const codeBlockRegex = /```(html|jsx|tsx|react|python|py|svg|mermaid|markdown|md)\n([\s\S]*?)```/gi;
    
    let match;
    while ((match = codeBlockRegex.exec(response)) !== null) {
      const langHint = match[1].toLowerCase();
      const code = match[2].trim();
      
      // Skip small code snippets (less than 50 chars or single line)
      if (code.length < 50 || !code.includes('\n')) {
        continue;
      }
      
      // Determine artifact type
      let type: ArtifactType;
      let title: string;
      
      if (langHint === 'html' || code.includes('<!DOCTYPE') || code.includes('<html')) {
        type = 'html';
        title = this.extractTitleFromHtml(code) || 'HTML Preview';
      } else if (['jsx', 'tsx', 'react'].includes(langHint) || code.includes('import React') || code.includes('useState')) {
        type = 'react';
        title = this.extractComponentName(code) || 'React Component';
      } else if (['python', 'py'].includes(langHint)) {
        type = 'python';
        title = 'Python Script';
      } else if (langHint === 'svg' || code.startsWith('<svg')) {
        type = 'svg';
        title = 'SVG Image';
      } else if (langHint === 'mermaid') {
        type = 'mermaid';
        title = 'Diagram';
      } else {
        type = 'markdown';
        title = 'Code Preview';
      }
      
      // Check if this looks like a substantial artifact (not just a snippet)
      const isSubstantial = 
        code.length > 200 || 
        code.includes('function') || 
        code.includes('class') ||
        code.includes('<!DOCTYPE') ||
        code.includes('<html') ||
        code.includes('export') ||
        code.includes('def ');
      
      if (!isSubstantial) {
        continue;
      }
      
      console.log(`[UnifiedResponse] 🎨 Detected artifact: ${type} - ${title}`);
      
      // Create artifact in database
      try {
        const artifactId = `artifact_${uuidv4().slice(0, 8)}`;
        
        const dbArtifact = await db.artifact.create({
          data: {
            id: artifactId,
            type,
            title,
            code,
            status: 'idle',
            version: 1
          }
        });
        
        // Emit artifact to frontend
        socket.emit('artifact:created', {
          artifact: {
            id: dbArtifact.id,
            type: dbArtifact.type,
            title: dbArtifact.title,
            code: dbArtifact.code,
            status: dbArtifact.status,
            version: dbArtifact.version,
            createdAt: dbArtifact.createdAt.toISOString(),
            updatedAt: dbArtifact.updatedAt.toISOString()
          },
          autoRun: true
        });
        
        artifacts.push({ type, title, code });
        console.log(`[UnifiedResponse] ✅ Created artifact: ${artifactId}`);
      } catch (error) {
        console.error('[UnifiedResponse] Failed to create artifact:', error);
      }
    }
    
    return artifacts;
  }

  /**
   * Extract title from HTML content
   */
  private extractTitleFromHtml(code: string): string | null {
    const titleMatch = code.match(/<title>([^<]+)<\/title>/i);
    return titleMatch ? titleMatch[1].trim() : null;
  }

  /**
   * Extract component name from React/JSX code
   */
  private extractComponentName(code: string): string | null {
    // Match function ComponentName or const ComponentName
    const funcMatch = code.match(/(?:function|const)\s+([A-Z][a-zA-Z0-9]*)\s*(?:\(|=)/);
    if (funcMatch) return funcMatch[1];
    
    // Match export default function ComponentName
    const exportMatch = code.match(/export\s+(?:default\s+)?(?:function|const)\s+([A-Z][a-zA-Z0-9]*)/);
    return exportMatch ? exportMatch[1] : null;
  }
}

export const unifiedResponseEngine = new UnifiedResponseEngine();

import { openRouterClient } from '../providers/openrouter.js';
import { db } from '../db/client.js';
import { MODELS, PROVIDERS, COLLABORATE_CONFIG } from '../constants/index.js';

/**
 * Collaborative Assistant - AI functions for the Collaborate feature
 * This module provides AI-powered assistance for writing and coding tasks
 */

// ========================================
// Utility Functions
// ========================================

/**
 * Safely extract JSON from LLM response with fallback
 */
function safeParseJSON<T>(response: string, fallback: T): T {
  try {
    // Try to find JSON array
    const arrayMatch = response.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]);
    }
    // Try to find JSON object
    const objectMatch = response.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }
  } catch (error) {
    console.warn('[CollaborateAI] JSON parse warning:', error);
  }
  return fallback;
}

// ========================================
// Types
// ========================================

export type CollaborateIntentAction = 'respond_only' | 'edit_document' | 'suggestions' | 'plan';

export interface CollaborateIntentResult {
  intent: 'edit_document' | 'ask_question' | 'analyze_document' | 'chat' | 'other';
  action: CollaborateIntentAction;
  confidence: number;
  shouldRunEdit: boolean;
  derivedInstruction?: string;
  targetRange?: { startLine: number; endLine: number } | null;
}

// ========================================
// Content Analysis
// ========================================

export async function analyzeContent(content: string, contentType: 'text' | 'code' | 'mixed'): Promise<any> {
  console.log('[CollaborateAI] Analyzing content:', contentType);
  
  const prompt = `Analyze this ${contentType} content and provide:
1. Content type classification
2. Language/style
3. Quality assessment
4. Improvement opportunities

Content:
${content}

Return a brief analysis.`;

  const analysis = await openRouterClient.complete(
    [{ role: 'user', content: prompt }],
    MODELS.AGENT,
    { order: ['baseten/fp4'], require_parameters: true, data_collection: 'deny' }
  );

  return {
    contentType,
    analysis,
    timestamp: new Date().toISOString()
  };
}

// ========================================
// Suggestion Generation
// ========================================

export async function generateSuggestions(
  documentId: number,
  content: string,
  category: 'writing' | 'code'
): Promise<any[]> {
  console.log(`[CollaborateAI] Generating ${category} suggestions for document ${documentId}`);
  
  const document = await db.collaborateDocument.findUnique({
    where: { id: documentId }
  });

  if (!document) {
    throw new Error('Document not found');
  }

  let prompt = '';
  if (category === 'writing') {
    prompt = `Analyze this text and provide inline suggestions for improvements:
- Grammar and spelling
- Clarity and conciseness
- Style and tone
- Structure

Text:
${content}

Return JSON array of suggestions with format: [{ type, title, description, originalText, suggestedText, lineStart, lineEnd }]`;
  } else {
    prompt = `Analyze this ${document.language || 'code'} and provide inline suggestions:
- Bug fixes
- Performance improvements
- Code quality
- Best practices

Code:
\`\`\`${document.language || 'code'}
${content}
\`\`\`

Return JSON array of suggestions with format: [{ type, title, description, originalText, suggestedText, lineStart, lineEnd }]`;
  }

  const response = await openRouterClient.complete(
    [{ role: 'user', content: prompt }],
    MODELS.AGENT,
    { order: ['baseten/fp4'], require_parameters: true, data_collection: 'deny' }
  );

  // Try to parse JSON from response
  let suggestions = [];
  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      suggestions = JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('[Collaborate AI] Failed to parse suggestions:', error);
  }

  return suggestions;
}

// ========================================
// Writing Shortcuts
// ========================================

export async function adjustLength(content: string, direction: 'shorter' | 'longer'): Promise<string> {
  console.log(`[CollaborateAI] Adjusting length: ${direction}`);
  
  const prompt = direction === 'shorter' 
    ? `Make this text more concise while preserving all key information:\n\n${content}`
    : `Expand this text with more details and examples while maintaining the same tone:\n\n${content}`;

  const result = await openRouterClient.complete(
    [{ role: 'user', content: prompt }],
    MODELS.AGENT,
    { order: ['baseten/fp4'], require_parameters: true, data_collection: 'deny' }
  );

  return result;
}

export async function adjustReadingLevel(
  content: string,
  targetLevel: 'kindergarten' | 'elementary' | 'middle' | 'high' | 'college' | 'graduate'
): Promise<string> {
  console.log(`[CollaborateAI] Adjusting reading level to: ${targetLevel}`);
  
  const prompt = `Rewrite this text for a ${targetLevel} reading level. Adjust vocabulary, sentence complexity, and concepts accordingly:\n\n${content}`;

  const result = await openRouterClient.complete(
    [{ role: 'user', content: prompt }],
    MODELS.AGENT,
    { order: ['baseten/fp4'], require_parameters: true, data_collection: 'deny' }
  );

  return result;
}

export async function addPolish(content: string): Promise<string> {
  console.log('[CollaborateAI] Adding final polish');
  
  const prompt = `Polish this text by fixing grammar, improving clarity, and ensuring consistency. Return only the polished text:\n\n${content}`;

  const result = await openRouterClient.complete(
    [{ role: 'user', content: prompt }],
    MODELS.AGENT,
    { order: ['baseten/fp4'], require_parameters: true, data_collection: 'deny' }
  );

  return result;
}

export async function addEmojis(content: string): Promise<string> {
  console.log('[CollaborateAI] Adding emojis');
  
  const prompt = `Add relevant emojis to this text for emphasis and color. Use them sparingly and appropriately:\n\n${content}`;

  const result = await openRouterClient.complete(
    [{ role: 'user', content: prompt }],
    MODELS.AGENT,
    { order: ['baseten/fp4'], require_parameters: true, data_collection: 'deny' }
  );

  return result;
}

// ========================================
// Coding Shortcuts
// ========================================

export async function reviewCode(code: string, language: string): Promise<any> {
  console.log(`[CollaborateAI] Reviewing ${language} code`);
  
  const prompt = `Review this ${language} code and provide inline suggestions for improvements:

\`\`\`${language}
${code}
\`\`\`

Focus on:
- Code quality
- Best practices
- Potential bugs
- Performance

Return JSON with: { suggestions: [{ line, type, description, suggestedFix }], overallAssessment: string }`;

  const response = await openRouterClient.complete(
    [{ role: 'user', content: prompt }],
    MODELS.AGENT,
    { order: ['baseten/fp4'], require_parameters: true, data_collection: 'deny' }
  );

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('[Collaborate AI] Failed to parse review:', error);
  }

  return { suggestions: [], overallAssessment: response };
}

export async function addLogs(code: string, language: string): Promise<string> {
  console.log(`[CollaborateAI] Adding logs to ${language} code`);
  
  const prompt = `Add appropriate console.log (or equivalent for ${language}) statements to this code for debugging. Return only the code with logs added:

\`\`\`${language}
${code}
\`\`\``;

  const result = await openRouterClient.complete(
    [{ role: 'user', content: prompt }],
    MODELS.AGENT,
    { order: ['baseten/fp4'], require_parameters: true, data_collection: 'deny' }
  );

  // Extract code from markdown if present
  const codeBlockMatch = result.match(/```[\w]*\n([\s\S]*?)\n```/);
  return codeBlockMatch ? codeBlockMatch[1] : result;
}

export async function addCodeComments(code: string, language: string): Promise<string> {
  console.log(`[CollaborateAI] Adding comments to ${language} code`);
  
  const prompt = `Add comprehensive inline comments to this ${language} code to explain what it does. Return only the commented code:

\`\`\`${language}
${code}
\`\`\``;

  const result = await openRouterClient.complete(
    [{ role: 'user', content: prompt }],
    MODELS.AGENT,
    { order: ['baseten/fp4'], require_parameters: true, data_collection: 'deny' }
  );

  const codeBlockMatch = result.match(/```[\w]*\n([\s\S]*?)\n```/);
  return codeBlockMatch ? codeBlockMatch[1] : result;
}

export async function fixBugs(code: string, language: string): Promise<any> {
  console.log(`[CollaborateAI] Detecting and fixing bugs in ${language} code`);
  
  const prompt = `Analyze this ${language} code for bugs and fix them:

\`\`\`${language}
${code}
\`\`\`

Return JSON with: { bugs: [{ line, issue, severity }], fixedCode: string }`;

  const response = await openRouterClient.complete(
    [{ role: 'user', content: prompt }],
    MODELS.AGENT,
    { order: ['baseten/fp4'], require_parameters: true, data_collection: 'deny' }
  );

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('[Collaborate AI] Failed to parse bug fixes:', error);
  }

  return { bugs: [], fixedCode: code };
}

export async function portLanguage(
  code: string,
  fromLanguage: string,
  toLanguage: string
): Promise<string> {
  console.log(`[CollaborateAI] Porting code from ${fromLanguage} to ${toLanguage}`);
  
  const prompt = `Translate this ${fromLanguage} code to ${toLanguage}. Maintain the same functionality and add comments explaining any language-specific differences:

\`\`\`${fromLanguage}
${code}
\`\`\`

Return only the ${toLanguage} code.`;

  const result = await openRouterClient.complete(
    [{ role: 'user', content: prompt }],
    MODELS.AGENT,
    { order: ['baseten/fp4'], require_parameters: true, data_collection: 'deny' }
  );

  const codeBlockMatch = result.match(/```[\w]*\n([\s\S]*?)\n```/);
  return codeBlockMatch ? codeBlockMatch[1] : result;
}

// ========================================
// Targeted Editing
// ========================================

export async function makeTargetedEdit(
  content: string,
  selection: { startLine: number; endLine: number; startChar?: number; endChar?: number },
  instruction: string
): Promise<string> {
  console.log('[CollaborateAI] Making targeted edit');
  
  const lines = content.split('\n');
  const selectedText = lines.slice(selection.startLine - 1, selection.endLine).join('\n');
  
  const prompt = `The user wants to edit this specific section:

\`\`\`
${selectedText}
\`\`\`

Instruction: ${instruction}

Return only the edited version of this section.`;

  const result = await openRouterClient.complete(
    [{ role: 'user', content: prompt }],
    MODELS.AGENT,
    { order: ['baseten/fp4'], require_parameters: true, data_collection: 'deny' }
  );

  return result;
}

// ========================================
// Helper Functions
// ========================================

export async function applyShortcut(
  shortcutType: string,
  content: string,
  options: any = {}
): Promise<string> {
  console.log(`[CollaborateAI] Applying shortcut: ${shortcutType}`);
  
  switch (shortcutType) {
    case 'adjust_length':
      return await adjustLength(content, options.direction || 'shorter');
    case 'reading_level':
      return await adjustReadingLevel(content, options.level || 'college');
    case 'add_polish':
      return await addPolish(content);
    case 'add_emojis':
      return await addEmojis(content);
    case 'review_code':
      return (await reviewCode(content, options.language || 'javascript')).overallAssessment;
    case 'add_logs':
      return await addLogs(content, options.language || 'javascript');
    case 'add_comments':
      return await addCodeComments(content, options.language || 'javascript');
    case 'fix_bugs':
      return (await fixBugs(content, options.language || 'javascript')).fixedCode;
    case 'port_language':
      return await portLanguage(content, options.fromLanguage, options.toLanguage);
    default:
      throw new Error(`Unknown shortcut type: ${shortcutType}`);
  }
}

// ========================================
// Autonomous Collaborate Tasks
// ========================================

export async function planCollaborateTask(
  instruction: string,
  context: { content: string; contentType: 'text' | 'code' | 'mixed'; language?: string | null }
): Promise<{ kind: string; steps: string[]; targetRange?: { startLine: number; endLine: number } | null }> {
  console.log('[CollaborateAI] Planning collaborate task');

  const prompt = `You are an AI collaborator helping edit a document. The user gave this instruction:
"${instruction}"

Document metadata:
- Type: ${context.contentType}
- Language: ${context.language || 'unknown'}

Document content (may be truncated):
${context.content}

Decide what kind of task this is and outline concrete steps.

Respond with JSON only in this shape:
{
  "kind": "analyze" | "rewrite" | "refactor" | "review" | "polish" | "custom",
  "steps": ["step 1", "step 2", "step 3"],
  "targetRange": { "startLine": number, "endLine": number } | null
}`;

  try {
    const response = await openRouterClient.complete(
      [{ role: 'user', content: prompt }],
      MODELS.AGENT,
      { order: ['baseten/fp4'], require_parameters: true, data_collection: 'deny' }
    );

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const kind = parsed.kind || 'custom';
      const steps = Array.isArray(parsed.steps) && parsed.steps.length > 0
        ? parsed.steps.map((s: any) => String(s))
        : ['Analyze instruction', 'Apply changes to the document'];

      let targetRange = null;
      if (parsed.targetRange && typeof parsed.targetRange.startLine === 'number' && typeof parsed.targetRange.endLine === 'number') {
        targetRange = {
          startLine: parsed.targetRange.startLine,
          endLine: parsed.targetRange.endLine
        };
      }

      return { kind, steps, targetRange };
    }
  } catch (error) {
    console.error('[CollaborateAI] Failed to plan collaborate task:', error);
  }

  // Fallback plan
  return {
    kind: 'custom',
    steps: ['Analyze instruction', 'Apply changes to the document', 'Summarize what changed'],
    targetRange: null
  };
}

// ========================================
// Intent Detection
// ========================================

export async function determineCollaborateIntent(
  message: string,
  context: {
    title: string;
    content: string;
    contentType: 'text' | 'code' | 'mixed';
    language?: string | null;
  }
): Promise<CollaborateIntentResult> {
  const fallback: CollaborateIntentResult = {
    intent: 'chat',
    action: 'respond_only',
    confidence: 0.2,
    shouldRunEdit: false,
    derivedInstruction: undefined,
    targetRange: null
  };

  try {
    const truncatedContent =
      context.content.length > 3000 ? context.content.slice(0, 3000) + '\n...[truncated]' : context.content;

    const prompt = `You are an intelligent assistant helping a user edit a document.
Your goal is to determine if the user's message implies an action to EDIT the document, or if it is just a question/comment.

Document Context:
- Title: ${context.title}
- Type: ${context.contentType}
- Language: ${context.language || 'unknown'}

Recent Document Content (first 3000 chars):
"""
${truncatedContent}
"""

User Message:
"${message}"

Instructions:
1. Analyze the user's message in the context of the document.
2. If the user clearly wants to modify the text (e.g., "delete this", "change X to Y", "refactor this function", "fix the typo", "add a comment here"), set intent="edit_document" and action="edit_document".
3. If the user is asking a question or discussing (e.g., "what does this do?", "I think we should change this later"), set intent="chat" or "ask_question" and action="respond_only".
4. If the user wants suggestions but not direct edits (e.g., "how can I improve this?"), set intent="analyze_document" or "ask_question" and action="respond_only" (or "suggestions").

Examples:
- "Fix the typo in line 5" -> edit_document
- "Make the tone more professional" -> edit_document
- "What is this function doing?" -> ask_question
- "I don't like this paragraph" -> chat (unless they say "change it")
- "Add a console log to debug" -> edit_document

Output JSON:
{
  "intent": "edit_document" | "ask_question" | "analyze_document" | "chat" | "other",
  "action": "edit_document" | "respond_only" | "suggestions" | "plan",
  "confidence": <number 0.0-1.0>,
  "reasoning": "<brief explanation>",
  "derivedInstruction": "<precise instruction for the edit, if applicable>",
  "targetRange": { "startLine": <number>, "endLine": <number> } | null
}

Set "action":"edit_document" ONLY when the user clearly wants you to change the document text NOW.`;

    const response = await openRouterClient.complete(
      [{ role: 'user', content: prompt }],
      MODELS.AGENT,
      { order: ['baseten/fp4'], require_parameters: true, data_collection: 'deny' }
    );

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const intent = parsed.intent || 'chat';
      const action: CollaborateIntentAction = parsed.action || 'respond_only';
      const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.3;

      console.log(`[CollaborateAI] Intent detected: ${intent} (${(confidence * 100).toFixed(0)}%) | Action: ${action} | Reason: ${parsed.reasoning}`);

      let targetRange = null;
      if (
        parsed.targetRange &&
        typeof parsed.targetRange.startLine === 'number' &&
        typeof parsed.targetRange.endLine === 'number'
      ) {
        targetRange = {
          startLine: parsed.targetRange.startLine,
          endLine: parsed.targetRange.endLine
        };
      }

      // Slightly higher threshold for auto-edits to prevent unwanted changes
      const shouldRunEdit = action === 'edit_document' && confidence >= 0.6;

      return {
        intent,
        action,
        confidence,
        shouldRunEdit,
        derivedInstruction: parsed.derivedInstruction,
        targetRange
      };
    }
  } catch (error) {
    console.error('[CollaborateAI] Failed to determine collaborate intent:', error);
  }

  return fallback;
}

export async function applyAutonomousEdit(
  documentId: number,
  content: string,
  instruction: string,
  selection?: { startLine: number; endLine: number }
): Promise<{ newContent: string; summary: string }> {
  console.log('[CollaborateAI] Applying autonomous edit for document', documentId);

  // If we have an explicit selection, use targeted edit
  if (selection && selection.startLine && selection.endLine) {
    const editedSection = await makeTargetedEdit(content, selection, instruction);

    const lines = content.split('\n');
    const startIdx = Math.max(0, selection.startLine - 1);
    const endIdx = Math.min(lines.length, selection.endLine);

    const before = lines.slice(0, startIdx);
    const after = lines.slice(endIdx);

    const newContent = [...before, editedSection, ...after].join('\n');
    const summary = `Edited lines ${selection.startLine}-${selection.endLine} based on instruction.`;

    return { newContent, summary };
  }

  // Otherwise, try to map the instruction to a known shortcut
  const lower = instruction.toLowerCase();
  let shortcutType: string | null = null;
  const options: any = {};

  if (lower.includes('shorter') || lower.includes('condense') || lower.includes('summarize')) {
    shortcutType = 'adjust_length';
    options.direction = 'shorter';
  } else if (lower.includes('longer') || lower.includes('expand') || lower.includes('elaborate')) {
    shortcutType = 'adjust_length';
    options.direction = 'longer';
  } else if (lower.includes('simplify') || lower.includes('easier to read')) {
    shortcutType = 'reading_level';
    options.level = 'high';
  } else if (lower.includes('polish') || lower.includes('clean up') || lower.includes('grammar')) {
    shortcutType = 'add_polish';
  } else if (lower.includes('emoji')) {
    shortcutType = 'add_emojis';
  }

  if (shortcutType) {
    const newContent = await applyShortcut(shortcutType, content, options);
    const summary = `Applied ${shortcutType} shortcut based on instruction.`;
    return { newContent, summary };
  }

  // Fallback: ask the model to directly apply the instruction to the whole document
  const prompt = `Apply the following instruction to this document and return only the updated document text.
Instruction: "${instruction}"

Document:
${content}`;

  const newContent = await openRouterClient.complete(
    [{ role: 'user', content: prompt }],
    MODELS.AGENT,
    { order: ['baseten/fp4'], require_parameters: true, data_collection: 'deny' }
  );

  const summary = 'Applied instruction to the full document.';
  return { newContent, summary };
}

export default {
  analyzeContent,
  generateSuggestions,
  adjustLength,
  adjustReadingLevel,
  addPolish,
  addEmojis,
  reviewCode,
  addLogs,
  addCodeComments,
  fixBugs,
  portLanguage,
  makeTargetedEdit,
  applyShortcut,
  planCollaborateTask,
  applyAutonomousEdit,
  determineCollaborateIntent
};

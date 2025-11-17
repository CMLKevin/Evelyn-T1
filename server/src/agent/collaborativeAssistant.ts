import { openRouterClient } from '../providers/openrouter.js';
import { db } from '../db/client.js';

/**
 * Collaborative Assistant - AI functions for the Collaborate feature
 * This module provides AI-powered assistance for writing and coding tasks
 */

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
    'moonshotai/kimi-k2-0905',
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
    'moonshotai/kimi-k2-0905',
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
    'moonshotai/kimi-k2-0905',
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
    'moonshotai/kimi-k2-0905',
    { order: ['baseten/fp4'], require_parameters: true, data_collection: 'deny' }
  );

  return result;
}

export async function addPolish(content: string): Promise<string> {
  console.log('[CollaborateAI] Adding final polish');
  
  const prompt = `Polish this text by fixing grammar, improving clarity, and ensuring consistency. Return only the polished text:\n\n${content}`;

  const result = await openRouterClient.complete(
    [{ role: 'user', content: prompt }],
    'moonshotai/kimi-k2-0905',
    { order: ['baseten/fp4'], require_parameters: true, data_collection: 'deny' }
  );

  return result;
}

export async function addEmojis(content: string): Promise<string> {
  console.log('[CollaborateAI] Adding emojis');
  
  const prompt = `Add relevant emojis to this text for emphasis and color. Use them sparingly and appropriately:\n\n${content}`;

  const result = await openRouterClient.complete(
    [{ role: 'user', content: prompt }],
    'moonshotai/kimi-k2-0905',
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
    'moonshotai/kimi-k2-0905',
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
    'moonshotai/kimi-k2-0905',
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
    'moonshotai/kimi-k2-0905',
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
    'moonshotai/kimi-k2-0905',
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
    'moonshotai/kimi-k2-0905',
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
    'moonshotai/kimi-k2-0905',
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
  applyShortcut
};

/**
 * Tool Parser - Hardened Version
 *
 * Parses tool calls from LLM output with robust error handling,
 * input validation, and protection against malformed input.
 *
 * Supported formats:
 * <tool_call>
 * <name>tool_name</name>
 * <params>
 * { "key": "value" }
 * </params>
 * </tool_call>
 */

import type { ParsedToolCall, ToolParseResult, ToolName } from './types.js';
import { getToolNames, validateToolParams } from './toolDefinitions.js';

// ========================================
// Constants & Safety Limits
// ========================================

const MAX_INPUT_LENGTH = 500000; // 500KB max input
const MAX_JSON_DEPTH = 10; // Prevent deeply nested JSON attacks
const MAX_TOOL_CALLS = 20; // Max tool calls per response
const MAX_PARAM_SIZE = 100000; // 100KB max for params

// ========================================
// Regex Patterns (Optimized for safety)
// ========================================

// Match complete tool calls - use non-greedy and bounded quantifiers
const TOOL_CALL_REGEX = /<tool_call>\s*<name>(\w{1,50})<\/name>\s*<params>\s*([\s\S]*?)\s*<\/params>\s*<\/tool_call>/gi;

// Alternative format: inline JSON style
const INLINE_TOOL_REGEX = /<tool:(\w{1,50})>\s*([\s\S]*?)\s*<\/tool:\1>/gi;

// Legacy format support (for backwards compatibility)
const LEGACY_TOOL_REGEX = /\[TOOL:(\w{1,50})\]\s*```(?:json)?\s*([\s\S]*?)\s*```\s*\[\/TOOL\]/gi;

// Partial tool call detection (for recovery)
const PARTIAL_TOOL_REGEX = /<tool_call>\s*<name>(\w{1,50})<\/name>\s*<params>\s*([\s\S]*?)$/i;

// ========================================
// Parser Functions
// ========================================

/**
 * Parse tool calls from LLM response with safety checks
 */
export function parseToolCalls(response: string): ToolParseResult {
  const toolCalls: ParsedToolCall[] = [];
  const errors: string[] = [];
  const validToolNames = new Set(getToolNames());

  // Safety check: input length
  if (response.length > MAX_INPUT_LENGTH) {
    console.warn(`[ToolParser] Input exceeds max length (${response.length} > ${MAX_INPUT_LENGTH}), truncating`);
    response = response.slice(0, MAX_INPUT_LENGTH);
    errors.push('Input truncated due to size limit');
  }

  // Track positions of all tool calls for text extraction
  const toolPositions: Array<{ start: number; end: number }> = [];

  // Parse primary format: <tool_call>...</tool_call>
  let match: RegExpExecArray | null;
  const primaryRegex = new RegExp(TOOL_CALL_REGEX.source, 'gi');
  
  while ((match = primaryRegex.exec(response)) !== null) {
    const toolName = match[1].toLowerCase() as ToolName;
    const paramsJson = match[2].trim();
    
    if (!validToolNames.has(toolName)) {
      errors.push(`Unknown tool: ${toolName}`);
      continue;
    }

    // Safety check: max tool calls
    if (toolCalls.length >= MAX_TOOL_CALLS) {
      errors.push(`Max tool calls limit reached (${MAX_TOOL_CALLS})`);
      break;
    }

    // Safety check: param size
    if (paramsJson.length > MAX_PARAM_SIZE) {
      errors.push(`Params for ${toolName} exceed max size (${paramsJson.length} > ${MAX_PARAM_SIZE})`);
      continue;
    }

    try {
      const params = parseJsonSafe(paramsJson);
      const validation = validateToolParams(toolName, params);

      if (!validation.valid) {
        errors.push(...validation.errors.map(e => `${toolName}: ${e}`));
      }

      toolCalls.push({
        name: toolName,
        params,
        rawText: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });

      toolPositions.push({
        start: match.index,
        end: match.index + match[0].length
      });
    } catch (e) {
      errors.push(`Failed to parse params for ${toolName}: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  // Parse inline format: <tool:name>...</tool:name>
  const inlineRegex = new RegExp(INLINE_TOOL_REGEX.source, 'gi');
  while ((match = inlineRegex.exec(response)) !== null) {
    const toolName = match[1].toLowerCase() as ToolName;
    const paramsJson = match[2].trim();

    if (!validToolNames.has(toolName)) {
      errors.push(`Unknown tool: ${toolName}`);
      continue;
    }

    // Skip if this position overlaps with already parsed calls
    const overlaps = toolPositions.some(
      pos => match!.index >= pos.start && match!.index < pos.end
    );
    if (overlaps) continue;

    try {
      const params = parseJsonSafe(paramsJson);
      
      toolCalls.push({
        name: toolName,
        params,
        rawText: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });

      toolPositions.push({
        start: match.index,
        end: match.index + match[0].length
      });
    } catch (e) {
      errors.push(`Failed to parse inline tool ${toolName}: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  // Parse legacy format: [TOOL:name]...[/TOOL]
  const legacyRegex = new RegExp(LEGACY_TOOL_REGEX.source, 'gi');
  while ((match = legacyRegex.exec(response)) !== null) {
    const toolName = match[1].toLowerCase() as ToolName;
    const paramsJson = match[2].trim();

    if (!validToolNames.has(toolName)) continue;

    const overlaps = toolPositions.some(
      pos => match!.index >= pos.start && match!.index < pos.end
    );
    if (overlaps) continue;

    try {
      const params = parseJsonSafe(paramsJson);
      
      toolCalls.push({
        name: toolName,
        params,
        rawText: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });

      toolPositions.push({
        start: match.index,
        end: match.index + match[0].length
      });
    } catch (e) {
      // Silently skip legacy format errors
    }
  }

  // Sort tool calls by position
  toolCalls.sort((a, b) => a.startIndex - b.startIndex);

  // Attempt partial tool call recovery if no complete calls found
  if (toolCalls.length === 0) {
    const partialRecovery = tryRecoverPartialToolCall(response, validToolNames);
    if (partialRecovery) {
      toolCalls.push(partialRecovery);
      errors.push('Recovered from partial tool call (response may have been truncated)');
    }
  }

  // Extract text response (everything not in tool calls)
  const textResponse = extractTextResponse(response, toolPositions);

  return {
    textResponse: textResponse.trim(),
    toolCalls,
    success: errors.length === 0 || toolCalls.length > 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Attempt to recover a partial tool call from truncated response
 */
function tryRecoverPartialToolCall(
  response: string,
  validToolNames: Set<ToolName>
): ParsedToolCall | null {
  const match = PARTIAL_TOOL_REGEX.exec(response);
  if (!match) return null;

  const toolName = match[1].toLowerCase() as ToolName;
  if (!validToolNames.has(toolName)) return null;

  const partialParams = match[2].trim();

  // Only attempt recovery if we have substantial content
  if (partialParams.length < 50) return null;

  try {
    // Try to complete the JSON by closing brackets
    const params = recoverPartialJson(partialParams);
    if (!params) return null;

    console.log(`[ToolParser] Recovered partial ${toolName} tool call`);

    return {
      name: toolName,
      params,
      rawText: match[0],
      startIndex: match.index,
      endIndex: response.length
    };
  } catch {
    return null;
  }
}

/**
 * Try to recover partial JSON by closing unclosed brackets
 */
function recoverPartialJson(partial: string): Record<string, any> | null {
  let json = partial.trim();

  // Count unclosed brackets
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let escapeNext = false;

  for (const char of json) {
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
    if (char === '[') bracketCount++;
    if (char === ']') bracketCount--;
  }

  // Close unclosed brackets (limit depth to prevent attacks)
  if (braceCount > MAX_JSON_DEPTH || bracketCount > MAX_JSON_DEPTH) {
    return null;
  }

  // Remove trailing comma if present
  json = json.replace(/,\s*$/, '');

  // Close brackets
  while (bracketCount > 0) {
    json += ']';
    bracketCount--;
  }
  while (braceCount > 0) {
    json += '}';
    braceCount--;
  }

  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Extract text response by removing tool call regions
 */
function extractTextResponse(response: string, toolPositions: Array<{ start: number; end: number }>): string {
  if (toolPositions.length === 0) {
    return response;
  }

  // Sort positions
  const sorted = [...toolPositions].sort((a, b) => a.start - b.start);
  
  let result = '';
  let lastEnd = 0;

  for (const pos of sorted) {
    if (pos.start > lastEnd) {
      result += response.slice(lastEnd, pos.start);
    }
    lastEnd = pos.end;
  }

  // Add remaining text after last tool call
  if (lastEnd < response.length) {
    result += response.slice(lastEnd);
  }

  return result;
}

/**
 * Parse JSON with error recovery
 * Handles common LLM JSON formatting issues
 */
function parseJsonSafe(jsonStr: string): Record<string, any> {
  let cleaned = jsonStr.trim();
  
  // Remove markdown code block markers if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }

  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Attempt fixes
  }

  // Fix: Single quotes to double quotes
  let fixed = cleaned.replace(/'/g, '"');
  try {
    return JSON.parse(fixed);
  } catch (e) {
    // Continue trying
  }

  // Fix: Trailing commas
  fixed = cleaned.replace(/,\s*([}\]])/g, '$1');
  try {
    return JSON.parse(fixed);
  } catch (e) {
    // Continue
  }

  // Fix: Unquoted keys
  fixed = cleaned.replace(/(\{|,)\s*(\w+)\s*:/g, '$1"$2":');
  try {
    return JSON.parse(fixed);
  } catch (e) {
    // Continue
  }

  // Fix: Missing quotes around string values
  fixed = cleaned.replace(/:(\s*)([^",\[\]{}]+)(\s*[,}])/g, (match, ws1, val, ws2) => {
    const trimmed = val.trim();
    // Don't quote numbers, booleans, null
    if (/^-?\d+(\.\d+)?$/.test(trimmed) || 
        trimmed === 'true' || 
        trimmed === 'false' || 
        trimmed === 'null') {
      return `:${ws1}${trimmed}${ws2}`;
    }
    return `:${ws1}"${trimmed}"${ws2}`;
  });
  
  try {
    return JSON.parse(fixed);
  } catch (e) {
    throw new Error(`Invalid JSON: ${jsonStr.slice(0, 100)}...`);
  }
}

/**
 * Check if response contains any tool calls
 */
export function hasToolCalls(response: string): boolean {
  return TOOL_CALL_REGEX.test(response) || 
         INLINE_TOOL_REGEX.test(response) ||
         LEGACY_TOOL_REGEX.test(response);
}

/**
 * Check if response contains a specific tool call
 */
export function hasToolCall(response: string, toolName: ToolName): boolean {
  const result = parseToolCalls(response);
  return result.toolCalls.some(tc => tc.name === toolName);
}

/**
 * Extract just the text portion of a response (no tool calls)
 */
export function extractTextOnly(response: string): string {
  const result = parseToolCalls(response);
  return result.textResponse;
}

/**
 * Build a tool call string for including in prompts/responses
 */
export function buildToolCall(toolName: ToolName, params: Record<string, any>): string {
  return `<tool_call>
<name>${toolName}</name>
<params>
${JSON.stringify(params, null, 2)}
</params>
</tool_call>`;
}

/**
 * Validate a raw response before full parsing
 * Returns quick feedback on obvious issues
 */
export function quickValidate(response: string): { 
  hasTools: boolean; 
  toolCount: number; 
  issues: string[] 
} {
  const issues: string[] = [];
  
  // Check for unclosed tool tags
  const openTags = (response.match(/<tool_call>/g) || []).length;
  const closeTags = (response.match(/<\/tool_call>/g) || []).length;
  
  if (openTags !== closeTags) {
    issues.push(`Mismatched tool_call tags: ${openTags} open, ${closeTags} close`);
  }

  // Check for common JSON issues in params
  const paramMatches = response.matchAll(/<params>\s*([\s\S]*?)\s*<\/params>/gi);
  for (const match of paramMatches) {
    const params = match[1];
    if (params.includes("'") && !params.includes('"')) {
      issues.push('Params appear to use single quotes instead of double quotes');
    }
    if (/,\s*[}\]]/.test(params)) {
      issues.push('Params may have trailing commas');
    }
  }

  return {
    hasTools: openTags > 0,
    toolCount: Math.min(openTags, closeTags),
    issues
  };
}

/**
 * Robust Tool Parser & Edit Verification
 * 
 * Phase 2 Architecture Improvements:
 * 1. Multi-pass tool parsing with validation
 * 2. Common mistake auto-correction
 * 3. Edit verification before proceeding
 * 4. Checkpoint/rollback system
 */

// ========================================
// Types
// ========================================

export interface ParsedToolCall {
  tool: 'read_file' | 'write_to_file' | 'replace_in_file' | 'search_files';
  params: Record<string, string>;
  rawXml: string;
  confidence: number;
  corrections: string[];
}

export interface ParseResult {
  success: boolean;
  toolCall?: ParsedToolCall;
  error?: string;
  suggestions?: string[];
}

export interface VerifyResult {
  valid: boolean;
  diffSummary: string;
  changesCount: number;
  unexpectedChanges: boolean;
  syntaxValid: boolean;
  confidence: number;
  warnings: string[];
}

export interface EditCheckpoint {
  id: string;
  content: string;
  iteration: number;
  timestamp: number;
  description: string;
}

// ========================================
// Tool Parser Class
// ========================================

export class ToolParser {
  private static readonly TOOL_NAMES = ['read_file', 'write_to_file', 'replace_in_file', 'search_files'];
  
  /**
   * Parse tool call from LLM response with multi-pass approach
   */
  parse(response: string): ParseResult {
    const corrections: string[] = [];
    
    // Pass 1: Try exact XML match
    let result = this.tryExactMatch(response);
    if (result.success) {
      return result;
    }
    
    // Pass 2: Try with common mistake fixes
    const correctedResponse = this.fixCommonMistakes(response, corrections);
    if (correctedResponse !== response) {
      result = this.tryExactMatch(correctedResponse);
      if (result.success && result.toolCall) {
        result.toolCall.corrections = corrections;
        result.toolCall.confidence *= 0.9; // Slightly lower confidence for corrected
        return result;
      }
    }
    
    // Pass 3: Try fuzzy matching for malformed XML
    result = this.tryFuzzyMatch(response);
    if (result.success && result.toolCall) {
      result.toolCall.corrections.push('Fuzzy matched malformed XML');
      result.toolCall.confidence *= 0.8;
      return result;
    }
    
    // Pass 4: Extract any tool-like patterns
    result = this.tryPatternExtraction(response);
    if (result.success && result.toolCall) {
      result.toolCall.corrections.push('Extracted from pattern matching');
      result.toolCall.confidence *= 0.7;
      return result;
    }
    
    // All passes failed
    return {
      success: false,
      error: 'No valid tool call found in response',
      suggestions: this.generateSuggestions(response)
    };
  }
  
  /**
   * Pass 1: Try exact XML match
   */
  private tryExactMatch(response: string): ParseResult {
    const toolMatch = response.match(/<(\w+)>([\s\S]*?)<\/\1>/);
    
    if (!toolMatch) {
      return { success: false };
    }
    
    const toolName = toolMatch[1];
    const toolContent = toolMatch[2];
    
    if (!ToolParser.TOOL_NAMES.includes(toolName)) {
      return { 
        success: false, 
        error: `Unknown tool: ${toolName}`,
        suggestions: [`Did you mean one of: ${ToolParser.TOOL_NAMES.join(', ')}?`]
      };
    }
    
    const params = this.extractParams(toolContent);
    const validation = this.validateParams(toolName, params);
    
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        suggestions: validation.suggestions
      };
    }
    
    return {
      success: true,
      toolCall: {
        tool: toolName as ParsedToolCall['tool'],
        params,
        rawXml: toolMatch[0],
        confidence: 1.0,
        corrections: []
      }
    };
  }
  
  /**
   * Fix common LLM mistakes in tool XML
   */
  private fixCommonMistakes(response: string, corrections: string[]): string {
    let fixed = response;
    
    // Fix: Missing closing tag
    for (const tool of ToolParser.TOOL_NAMES) {
      const openTag = `<${tool}>`;
      const closeTag = `</${tool}>`;
      
      if (fixed.includes(openTag) && !fixed.includes(closeTag)) {
        // Try to find where the content likely ends
        const startIdx = fixed.indexOf(openTag) + openTag.length;
        const contentAfter = fixed.slice(startIdx);
        
        // Look for next tag or end of response
        const nextTagMatch = contentAfter.match(/<\/?[\w_]+>/);
        if (nextTagMatch && nextTagMatch.index !== undefined) {
          const insertPos = startIdx + nextTagMatch.index;
          fixed = fixed.slice(0, insertPos) + closeTag + fixed.slice(insertPos);
          corrections.push(`Added missing closing tag: ${closeTag}`);
        } else {
          fixed = fixed + closeTag;
          corrections.push(`Appended missing closing tag: ${closeTag}`);
        }
      }
    }
    
    // Fix: Wrong tag format (e.g., <replace_file> instead of <replace_in_file>)
    const typoFixes: Record<string, string> = {
      'replace_file': 'replace_in_file',
      'replaceinfile': 'replace_in_file',
      'file_replace': 'replace_in_file',
      'readfile': 'read_file',
      'writefile': 'write_to_file',
      'write_file': 'write_to_file',
      'searchfiles': 'search_files',
      'search_file': 'search_files',
      'find_files': 'search_files'
    };
    
    for (const [typo, correct] of Object.entries(typoFixes)) {
      const typoPattern = new RegExp(`<${typo}>`, 'gi');
      if (typoPattern.test(fixed)) {
        fixed = fixed.replace(typoPattern, `<${correct}>`);
        fixed = fixed.replace(new RegExp(`</${typo}>`, 'gi'), `</${correct}>`);
        corrections.push(`Fixed typo: ${typo} → ${correct}`);
      }
    }
    
    // Fix: Unescaped special characters in content
    // This is tricky - we need to preserve the structure while fixing content
    
    // Fix: Extra whitespace in tags
    fixed = fixed.replace(/<\s+(\w+)\s*>/g, '<$1>');
    fixed = fixed.replace(/<\s*\/\s*(\w+)\s*>/g, '</$1>');
    
    return fixed;
  }
  
  /**
   * Pass 3: Fuzzy matching for malformed XML
   */
  private tryFuzzyMatch(response: string): ParseResult {
    // Try to find tool-like patterns even if XML is broken
    for (const tool of ToolParser.TOOL_NAMES) {
      // Match patterns like: <tool_name> ... content ... (possibly missing close tag)
      const fuzzyPattern = new RegExp(`<${tool}>([\\s\\S]*?)(?:<\\/${tool}>|$)`, 'i');
      const match = response.match(fuzzyPattern);
      
      if (match) {
        const params = this.extractParams(match[1]);
        
        return {
          success: true,
          toolCall: {
            tool: tool as ParsedToolCall['tool'],
            params,
            rawXml: match[0],
            confidence: 0.7,
            corrections: ['Fuzzy matched with possible missing close tag']
          }
        };
      }
    }
    
    return { success: false };
  }
  
  /**
   * Pass 4: Pattern extraction for very malformed responses
   */
  private tryPatternExtraction(response: string): ParseResult {
    // Look for SEARCH/REPLACE patterns even without proper XML wrapper
    const searchReplacePattern = /<<<+\s*SEARCH\s*\n([\s\S]*?)\n\s*=+\s*REPLACE\s*\n([\s\S]*?)\n\s*>>>+/i;
    const match = response.match(searchReplacePattern);
    
    if (match) {
      // Found a SEARCH/REPLACE block - wrap it properly
      return {
        success: true,
        toolCall: {
          tool: 'replace_in_file',
          params: {
            content: `<<<<<<< SEARCH\n${match[1]}\n======= REPLACE\n${match[2]}\n>>>>>>> REPLACE`
          },
          rawXml: match[0],
          confidence: 0.6,
          corrections: ['Extracted SEARCH/REPLACE pattern without XML wrapper']
        }
      };
    }
    
    return { success: false };
  }
  
  /**
   * Extract parameters from tool content
   */
  private extractParams(content: string): Record<string, string> {
    const params: Record<string, string> = {};
    
    // Match nested XML params
    const paramMatches = Array.from(content.matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g));
    for (const match of paramMatches) {
      params[match[1]] = match[2].trim();
    }
    
    // If no params found but there's content, treat it as the main content
    if (Object.keys(params).length === 0 && content.trim()) {
      params['content'] = content.trim();
    }
    
    return params;
  }
  
  /**
   * Validate tool parameters
   */
  private validateParams(tool: string, params: Record<string, string>): { valid: boolean; error?: string; suggestions?: string[] } {
    switch (tool) {
      case 'read_file':
        if (!params.path) {
          return { 
            valid: false, 
            error: 'read_file requires a <path> parameter',
            suggestions: ['Add <path>filename</path> inside the tool tag']
          };
        }
        break;
        
      case 'write_to_file':
        if (!params.path || !params.content) {
          return { 
            valid: false, 
            error: 'write_to_file requires <path> and <content> parameters',
            suggestions: ['Ensure both <path> and <content> are provided']
          };
        }
        break;
        
      case 'replace_in_file':
        if (!params.content) {
          return { 
            valid: false, 
            error: 'replace_in_file requires a <content> parameter with SEARCH/REPLACE blocks',
            suggestions: ['Include <<<<<<< SEARCH ... ======= REPLACE ... >>>>>>> REPLACE pattern']
          };
        }
        // Validate SEARCH/REPLACE format
        if (!params.content.includes('SEARCH') || !params.content.includes('REPLACE')) {
          return {
            valid: false,
            error: 'replace_in_file content must include SEARCH and REPLACE markers',
            suggestions: ['Use format: <<<<<<< SEARCH\\n[old text]\\n======= REPLACE\\n[new text]\\n>>>>>>> REPLACE']
          };
        }
        break;
        
      case 'search_files':
        if (!params.pattern) {
          return { 
            valid: false, 
            error: 'search_files requires a <pattern> parameter',
            suggestions: ['Add <pattern>search term</pattern> inside the tool tag']
          };
        }
        break;
    }
    
    return { valid: true };
  }
  
  /**
   * Generate suggestions when parsing fails
   */
  private generateSuggestions(response: string): string[] {
    const suggestions: string[] = [];
    
    if (!response.includes('<')) {
      suggestions.push('Response contains no XML tags - ensure tool calls use <tool_name>...</tool_name> format');
    }
    
    if (response.includes('```')) {
      suggestions.push('Detected code blocks - tool calls should not be wrapped in markdown code blocks');
    }
    
    const hasToolMention = ToolParser.TOOL_NAMES.some(t => response.toLowerCase().includes(t.replace('_', ' ')));
    if (hasToolMention) {
      suggestions.push('Tool was mentioned in text but not in proper XML format');
    }
    
    return suggestions;
  }
}

// ========================================
// Edit Verification
// ========================================

export class EditVerifier {
  /**
   * Verify that an edit produced expected changes
   */
  verify(
    before: string,
    after: string,
    expectedDescription: string,
    language?: string
  ): VerifyResult {
    const warnings: string[] = [];
    
    // Calculate diff
    const { added, removed, unchanged } = this.calculateDiff(before, after);
    const changesCount = added + removed;
    
    // Check for no changes
    if (changesCount === 0) {
      return {
        valid: false,
        diffSummary: 'No changes detected',
        changesCount: 0,
        unexpectedChanges: false,
        syntaxValid: true,
        confidence: 0,
        warnings: ['Edit produced no changes - SEARCH text may not have matched']
      };
    }
    
    // Check for unexpectedly large changes
    const totalLines = before.split('\n').length;
    const changeRatio = changesCount / totalLines;
    let unexpectedChanges = false;
    
    if (changeRatio > 0.5 && !expectedDescription.toLowerCase().includes('rewrite')) {
      unexpectedChanges = true;
      warnings.push(`Large change ratio: ${Math.round(changeRatio * 100)}% of document modified`);
    }
    
    // Syntax check for code files
    const syntaxValid = this.checkSyntax(after, language);
    if (!syntaxValid) {
      warnings.push('Syntax validation failed - output may have errors');
    }
    
    // Calculate confidence
    let confidence = 1.0;
    if (unexpectedChanges) confidence *= 0.7;
    if (!syntaxValid) confidence *= 0.6;
    if (warnings.length > 0) confidence *= 0.9;
    
    return {
      valid: changesCount > 0,
      diffSummary: `+${added} lines, -${removed} lines`,
      changesCount,
      unexpectedChanges,
      syntaxValid,
      confidence,
      warnings
    };
  }
  
  /**
   * Calculate line-based diff statistics
   */
  private calculateDiff(before: string, after: string): { added: number; removed: number; unchanged: number } {
    const beforeLines = new Set(before.split('\n'));
    const afterLines = new Set(after.split('\n'));
    const afterLinesArray = Array.from(afterLines);
    const beforeLinesArray = Array.from(beforeLines);
    
    let added = 0;
    let removed = 0;
    let unchanged = 0;
    
    for (const line of afterLinesArray) {
      if (beforeLines.has(line)) {
        unchanged++;
      } else {
        added++;
      }
    }
    
    for (const line of beforeLinesArray) {
      if (!afterLines.has(line)) {
        removed++;
      }
    }
    
    return { added, removed, unchanged };
  }
  
  /**
   * Basic syntax validation
   */
  private checkSyntax(content: string, language?: string): boolean {
    if (!language) return true;
    
    const lang = language.toLowerCase();
    
    // Check bracket balance for code files
    if (['typescript', 'javascript', 'ts', 'js', 'tsx', 'jsx', 'json'].includes(lang)) {
      return this.checkBracketBalance(content, ['{', '}'], ['[', ']'], ['(', ')']);
    }
    
    if (['python', 'py'].includes(lang)) {
      return this.checkBracketBalance(content, ['(', ')'], ['[', ']'], ['{', '}']);
    }
    
    return true;
  }
  
  /**
   * Check that brackets are balanced
   */
  private checkBracketBalance(content: string, ...pairs: [string, string][]): boolean {
    const stack: string[] = [];
    const openToClose: Record<string, string> = {};
    const closeToOpen: Record<string, string> = {};
    
    for (const [open, close] of pairs) {
      openToClose[open] = close;
      closeToOpen[close] = open;
    }
    
    // Skip strings and comments (simplified)
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const prevChar = i > 0 ? content[i - 1] : '';
      
      // Handle string detection (simplified)
      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
        continue;
      }
      
      if (inString) continue;
      
      if (openToClose[char]) {
        stack.push(char);
      } else if (closeToOpen[char]) {
        const expected = stack.pop();
        if (expected !== closeToOpen[char]) {
          return false;
        }
      }
    }
    
    return stack.length === 0;
  }
}

// ========================================
// Checkpoint Manager
// ========================================

export class CheckpointManager {
  private checkpoints: Map<string, EditCheckpoint> = new Map();
  private checkpointOrder: string[] = [];
  private maxCheckpoints: number;
  
  constructor(maxCheckpoints = 10) {
    this.maxCheckpoints = maxCheckpoints;
  }
  
  /**
   * Create a new checkpoint
   */
  create(content: string, iteration: number, description: string): EditCheckpoint {
    const id = `cp_${Date.now()}_${iteration}`;
    
    const checkpoint: EditCheckpoint = {
      id,
      content,
      iteration,
      timestamp: Date.now(),
      description
    };
    
    this.checkpoints.set(id, checkpoint);
    this.checkpointOrder.push(id);
    
    // Prune old checkpoints if over limit
    while (this.checkpointOrder.length > this.maxCheckpoints) {
      const oldestId = this.checkpointOrder.shift();
      if (oldestId) {
        this.checkpoints.delete(oldestId);
      }
    }
    
    console.log(`[Checkpoint] Created: ${id} (${description})`);
    return checkpoint;
  }
  
  /**
   * Get a checkpoint by ID
   */
  get(id: string): EditCheckpoint | undefined {
    return this.checkpoints.get(id);
  }
  
  /**
   * Get the latest checkpoint
   */
  getLatest(): EditCheckpoint | undefined {
    const latestId = this.checkpointOrder[this.checkpointOrder.length - 1];
    return latestId ? this.checkpoints.get(latestId) : undefined;
  }
  
  /**
   * Get checkpoint from N iterations ago
   */
  getFromIterationsAgo(n: number): EditCheckpoint | undefined {
    const index = this.checkpointOrder.length - 1 - n;
    if (index < 0) return undefined;
    
    const id = this.checkpointOrder[index];
    return this.checkpoints.get(id);
  }
  
  /**
   * Rollback to a specific checkpoint
   */
  rollbackTo(id: string): { success: boolean; content?: string; error?: string } {
    const checkpoint = this.checkpoints.get(id);
    
    if (!checkpoint) {
      return { success: false, error: `Checkpoint ${id} not found` };
    }
    
    // Remove all checkpoints after this one
    const index = this.checkpointOrder.indexOf(id);
    const removed = this.checkpointOrder.splice(index + 1);
    
    for (const removedId of removed) {
      this.checkpoints.delete(removedId);
    }
    
    console.log(`[Checkpoint] Rolled back to: ${id}, removed ${removed.length} later checkpoints`);
    
    return { success: true, content: checkpoint.content };
  }
  
  /**
   * List all checkpoints
   */
  list(): EditCheckpoint[] {
    return this.checkpointOrder.map(id => this.checkpoints.get(id)!).filter(Boolean);
  }
  
  /**
   * Clear all checkpoints
   */
  clear(): void {
    this.checkpoints.clear();
    this.checkpointOrder = [];
  }
}

// ========================================
// Factory Functions
// ========================================

export function createToolParser(): ToolParser {
  return new ToolParser();
}

export function createEditVerifier(): EditVerifier {
  return new EditVerifier();
}

export function createCheckpointManager(maxCheckpoints = 10): CheckpointManager {
  return new CheckpointManager(maxCheckpoints);
}

export default {
  ToolParser,
  EditVerifier,
  CheckpointManager,
  createToolParser,
  createEditVerifier,
  createCheckpointManager
};

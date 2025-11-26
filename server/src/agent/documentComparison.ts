/**
 * Document Comparison Engine
 * 
 * Provides diff generation, semantic change analysis, and AI-powered
 * explanations for document version comparisons.
 */

import { openRouterClient } from '../providers/openrouter.js';

// ========================================
// Types
// ========================================

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged' | 'modified';
  lineNumber: { left?: number; right?: number };
  content: string;
  oldContent?: string; // For modified lines
}

export interface DiffHunk {
  startLine: { left: number; right: number };
  endLine: { left: number; right: number };
  lines: DiffLine[];
}

export interface ChangeGroup {
  id: string;
  type: 'addition' | 'deletion' | 'modification' | 'refactor' | 'style';
  category: 'content' | 'structure' | 'formatting' | 'code';
  severity: 'minor' | 'moderate' | 'significant' | 'breaking';
  startLine: number;
  endLine: number;
  summary: string;
  beforeText?: string;
  afterText?: string;
}

export interface ComparisonResult {
  hunks: DiffHunk[];
  changes: ChangeGroup[];
  stats: {
    additions: number;
    deletions: number;
    modifications: number;
    unchanged: number;
  };
  similarity: number; // 0-1 score
}

export interface AIExplanation {
  summary: string;
  changeExplanations: {
    changeId: string;
    explanation: string;
    impact: 'low' | 'medium' | 'high';
    suggestion?: string;
  }[];
  overallAssessment: string;
}

export interface MergeConflict {
  id: string;
  startLine: number;
  endLine: number;
  baseContent: string;
  leftContent: string;
  rightContent: string;
  autoResolution?: string;
  aiSuggestion?: string;
}

export interface MergeResult {
  success: boolean;
  mergedContent: string;
  conflicts: MergeConflict[];
  aiResolutions: { conflictId: string; resolution: string; reasoning: string }[];
}

// ========================================
// Diff Algorithm (Myers-like)
// ========================================

/**
 * Compute line-by-line diff between two documents
 */
export function diffDocuments(docA: string, docB: string): ComparisonResult {
  const linesA = docA.split('\n');
  const linesB = docB.split('\n');
  
  const hunks: DiffHunk[] = [];
  const changes: ChangeGroup[] = [];
  
  let stats = { additions: 0, deletions: 0, modifications: 0, unchanged: 0 };
  
  // Use longest common subsequence approach
  const lcs = computeLCS(linesA, linesB);
  const diffLines = buildDiffFromLCS(linesA, linesB, lcs);
  
  // Group consecutive changes into hunks
  let currentHunk: DiffHunk | null = null;
  let leftLine = 1;
  let rightLine = 1;
  let changeId = 0;

  for (const line of diffLines) {
    const lineData: DiffLine = {
      type: line.type,
      lineNumber: {},
      content: line.content
    };

    if (line.type === 'unchanged') {
      lineData.lineNumber = { left: leftLine++, right: rightLine++ };
      stats.unchanged++;
      
      // Close current hunk if we have enough context
      if (currentHunk && currentHunk.lines.length > 0) {
        // Add context line
        currentHunk.lines.push(lineData);
        if (currentHunk.lines.filter(l => l.type === 'unchanged').length >= 3) {
          currentHunk.endLine = { left: leftLine - 1, right: rightLine - 1 };
          hunks.push(currentHunk);
          currentHunk = null;
        }
      }
    } else if (line.type === 'removed') {
      lineData.lineNumber = { left: leftLine++ };
      stats.deletions++;
      
      if (!currentHunk) {
        currentHunk = {
          startLine: { left: Math.max(1, leftLine - 3), right: Math.max(1, rightLine - 3) },
          endLine: { left: leftLine, right: rightLine },
          lines: []
        };
      }
      currentHunk.lines.push(lineData);
      
      // Create change group
      changes.push({
        id: `change-${changeId++}`,
        type: 'deletion',
        category: detectCategory(line.content),
        severity: 'moderate',
        startLine: leftLine - 1,
        endLine: leftLine - 1,
        summary: `Removed: ${line.content.slice(0, 50)}${line.content.length > 50 ? '...' : ''}`,
        beforeText: line.content
      });
    } else if (line.type === 'added') {
      lineData.lineNumber = { right: rightLine++ };
      stats.additions++;
      
      if (!currentHunk) {
        currentHunk = {
          startLine: { left: Math.max(1, leftLine - 3), right: Math.max(1, rightLine - 3) },
          endLine: { left: leftLine, right: rightLine },
          lines: []
        };
      }
      currentHunk.lines.push(lineData);
      
      // Create change group
      changes.push({
        id: `change-${changeId++}`,
        type: 'addition',
        category: detectCategory(line.content),
        severity: 'moderate',
        startLine: rightLine - 1,
        endLine: rightLine - 1,
        summary: `Added: ${line.content.slice(0, 50)}${line.content.length > 50 ? '...' : ''}`,
        afterText: line.content
      });
    }
  }

  // Close final hunk
  if (currentHunk) {
    currentHunk.endLine = { left: leftLine, right: rightLine };
    hunks.push(currentHunk);
  }

  // Calculate similarity
  const totalLines = Math.max(linesA.length, linesB.length);
  const similarity = totalLines > 0 ? stats.unchanged / totalLines : 1;

  return { hunks, changes, stats, similarity };
}

/**
 * Compute Longest Common Subsequence
 */
function computeLCS(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
}

/**
 * Build diff output from LCS
 */
function buildDiffFromLCS(
  a: string[], 
  b: string[], 
  dp: number[][]
): { type: 'added' | 'removed' | 'unchanged'; content: string }[] {
  const result: { type: 'added' | 'removed' | 'unchanged'; content: string }[] = [];
  let i = a.length;
  let j = b.length;

  const temp: typeof result = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      temp.push({ type: 'unchanged', content: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      temp.push({ type: 'added', content: b[j - 1] });
      j--;
    } else {
      temp.push({ type: 'removed', content: a[i - 1] });
      i--;
    }
  }

  return temp.reverse();
}

/**
 * Detect change category based on content
 */
function detectCategory(content: string): 'content' | 'structure' | 'formatting' | 'code' {
  const trimmed = content.trim();
  
  // Code patterns
  if (/^(import|export|function|const|let|var|class|interface|type|def|async|await)/.test(trimmed)) {
    return 'code';
  }
  
  // Structure patterns (headings, lists)
  if (/^(#{1,6}\s|[-*]\s|\d+\.\s)/.test(trimmed)) {
    return 'structure';
  }
  
  // Formatting (only whitespace changes)
  if (trimmed === '') {
    return 'formatting';
  }
  
  return 'content';
}

// ========================================
// AI Explanation Generator
// ========================================

/**
 * Generate AI explanations for document changes
 */
export async function generateAIExplanation(
  docA: string,
  docB: string,
  comparison: ComparisonResult,
  contentType: 'text' | 'code' | 'mixed' = 'text'
): Promise<AIExplanation> {
  const prompt = `You are Evelyn, analyzing changes between two versions of a ${contentType} document.

## ORIGINAL VERSION:
\`\`\`
${docA.slice(0, 2000)}${docA.length > 2000 ? '\n...(truncated)' : ''}
\`\`\`

## NEW VERSION:
\`\`\`
${docB.slice(0, 2000)}${docB.length > 2000 ? '\n...(truncated)' : ''}
\`\`\`

## CHANGE STATISTICS:
- Lines added: ${comparison.stats.additions}
- Lines removed: ${comparison.stats.deletions}
- Lines unchanged: ${comparison.stats.unchanged}
- Similarity: ${(comparison.similarity * 100).toFixed(1)}%

Please analyze these changes and respond in this JSON format:
{
  "summary": "A 1-2 sentence summary of overall changes",
  "changeExplanations": [
    {
      "changeId": "change-0",
      "explanation": "What this change does and why",
      "impact": "low|medium|high",
      "suggestion": "Optional improvement suggestion"
    }
  ],
  "overallAssessment": "Your assessment of the changes (helpful, risky, etc.)"
}

Be concise but insightful. Focus on the most significant changes.`;

  try {
    const response = await openRouterClient.simpleThought(prompt);
    
    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Fallback
    return {
      summary: 'Document has been modified',
      changeExplanations: comparison.changes.slice(0, 5).map(c => ({
        changeId: c.id,
        explanation: c.summary,
        impact: c.severity === 'breaking' ? 'high' : c.severity === 'significant' ? 'medium' : 'low' as const
      })),
      overallAssessment: `${comparison.stats.additions} additions, ${comparison.stats.deletions} deletions`
    };
  } catch (error) {
    console.error('[DocumentComparison] AI explanation error:', error);
    return {
      summary: 'Unable to generate AI explanation',
      changeExplanations: [],
      overallAssessment: 'Analysis failed'
    };
  }
}

// ========================================
// Three-Way Merge
// ========================================

/**
 * Perform three-way merge with conflict detection
 */
export function threeWayMerge(
  base: string,
  left: string,
  right: string
): MergeResult {
  const baseLines = base.split('\n');
  const leftLines = left.split('\n');
  const rightLines = right.split('\n');

  const leftDiff = diffDocuments(base, left);
  const rightDiff = diffDocuments(base, right);

  const conflicts: MergeConflict[] = [];
  const mergedLines: string[] = [];
  
  let baseIdx = 0;
  let leftIdx = 0;
  let rightIdx = 0;
  let conflictId = 0;

  // Simple merge: apply non-conflicting changes
  while (baseIdx < baseLines.length || leftIdx < leftLines.length || rightIdx < rightLines.length) {
    const baseLine = baseLines[baseIdx] ?? '';
    const leftLine = leftLines[leftIdx] ?? '';
    const rightLine = rightLines[rightIdx] ?? '';

    // Both sides match base - unchanged
    if (leftLine === baseLine && rightLine === baseLine) {
      mergedLines.push(baseLine);
      baseIdx++;
      leftIdx++;
      rightIdx++;
    }
    // Only left changed
    else if (rightLine === baseLine && leftLine !== baseLine) {
      mergedLines.push(leftLine);
      if (leftLine !== '') leftIdx++;
      if (baseLine !== '' || leftLines[leftIdx] !== baseLine) baseIdx++;
      if (rightLine !== '') rightIdx++;
    }
    // Only right changed
    else if (leftLine === baseLine && rightLine !== baseLine) {
      mergedLines.push(rightLine);
      if (leftLine !== '') leftIdx++;
      if (baseLine !== '' || rightLines[rightIdx] !== baseLine) baseIdx++;
      if (rightLine !== '') rightIdx++;
    }
    // Both changed differently - conflict!
    else if (leftLine !== baseLine && rightLine !== baseLine && leftLine !== rightLine) {
      conflicts.push({
        id: `conflict-${conflictId++}`,
        startLine: mergedLines.length + 1,
        endLine: mergedLines.length + 1,
        baseContent: baseLine,
        leftContent: leftLine,
        rightContent: rightLine
      });
      
      // Add conflict markers
      mergedLines.push(`<<<<<<< LEFT`);
      mergedLines.push(leftLine);
      mergedLines.push(`=======`);
      mergedLines.push(rightLine);
      mergedLines.push(`>>>>>>> RIGHT`);
      
      baseIdx++;
      leftIdx++;
      rightIdx++;
    }
    // Both changed the same way
    else {
      mergedLines.push(leftLine);
      baseIdx++;
      leftIdx++;
      rightIdx++;
    }

    // Safety: prevent infinite loop
    if (baseIdx > baseLines.length + leftLines.length + rightLines.length) break;
  }

  return {
    success: conflicts.length === 0,
    mergedContent: mergedLines.join('\n'),
    conflicts,
    aiResolutions: []
  };
}

/**
 * Generate AI resolution suggestions for merge conflicts
 */
export async function generateAIMergeResolutions(
  conflicts: MergeConflict[],
  context: { documentTitle?: string; contentType?: string }
): Promise<{ conflictId: string; resolution: string; reasoning: string }[]> {
  if (conflicts.length === 0) return [];

  const prompt = `You are Evelyn, helping to resolve merge conflicts in a ${context.contentType || 'document'}.

Here are the conflicts that need resolution:

${conflicts.map((c, i) => `
## Conflict ${i + 1} (${c.id})
BASE (original):
\`\`\`
${c.baseContent}
\`\`\`

LEFT (their changes):
\`\`\`
${c.leftContent}
\`\`\`

RIGHT (your changes):
\`\`\`
${c.rightContent}
\`\`\`
`).join('\n')}

For each conflict, provide a resolution. Respond in JSON:
{
  "resolutions": [
    {
      "conflictId": "conflict-0",
      "resolution": "The merged content",
      "reasoning": "Why this resolution makes sense"
    }
  ]
}

Prefer preserving both changes when possible, combining them intelligently.`;

  try {
    const response = await openRouterClient.complexThought(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.resolutions || [];
    }
    
    return [];
  } catch (error) {
    console.error('[DocumentComparison] AI merge resolution error:', error);
    return [];
  }
}

export default {
  diffDocuments,
  generateAIExplanation,
  threeWayMerge,
  generateAIMergeResolutions
};

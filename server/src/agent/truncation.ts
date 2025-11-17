import { openRouterClient } from '../providers/openrouter.js';
import { memoryEngine } from './memory.js';
import { estimateTokens } from '../utils/tokenizer.js';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  id?: number;
  createdAt?: Date;
}

interface ScoredMessage {
  message: Message;
  score: number;
  rationale: string;
  shouldPreserve: boolean;
  index: number;
}

interface TruncationResult {
  truncatedMessages: Message[];
  removedCount: number;
  preservedCount: number;
  memoriesCreated: number;
  contextSaved: number;
  truncationStrategy: string;
}

const MESSAGE_IMPORTANCE_PROMPT = `Analyze this message exchange for importance in maintaining conversation context.

Message pair:
User: """{{USER}}"""
Assistant: """{{ASSISTANT}}"""

Rate the importance (0.0-1.0) based on:
- Emotional significance or vulnerability (+0.3)
- Key facts, decisions, or commitments (+0.3)
- Relationship development or boundaries (+0.3)
- Topic changes or new subjects (+0.2)
- References to earlier conversation (+0.2)
- Humor, creativity, or memorable moments (+0.1)

LOW importance (< 0.4):
- Small talk, greetings, acknowledgments
- Redundant information already covered
- Simple yes/no exchanges
- Formatting or meta-conversation

HIGH importance (>= 0.6):
- Personal revelations or emotional moments
- Important decisions or commitments
- New topics or subject changes
- Critical facts or information
- Relationship milestones

Respond with JSON only. example JSON response:
{
  "importance": 0.75,
  "rationale": "User shared vulnerable personal information",
  "keyConcepts": ["vulnerability", "family", "trust"],
  "shouldPreserve": true
}`;

class SmartTruncationEngine {
  /**
   * Score messages for importance using AI
   */
  async scoreMessages(messages: Message[]): Promise<ScoredMessage[]> {
    const scored: ScoredMessage[] = [];
    
    console.log('[Truncation] Scoring messages for importance...');
    
    // Score message pairs (user + assistant responses)
    for (let i = 0; i < messages.length - 1; i += 2) {
      if (messages[i].role === 'user' && messages[i + 1]?.role === 'assistant') {
        try {
          const prompt = MESSAGE_IMPORTANCE_PROMPT
            .replace('{{USER}}', messages[i].content)
            .replace('{{ASSISTANT}}', messages[i + 1].content);
          
          const response = await openRouterClient.complexThought(prompt);
          const jsonMatch = response.match(/\{[\s\S]*?\}/);
          
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            
            // Apply heuristic boosts
            let importance = result.importance;
            
            // Boost for length (detailed responses often important)
            if (messages[i].content.length > 200 || messages[i + 1].content.length > 300) {
              importance = Math.min(1.0, importance + 0.1);
            }
            
            // Boost for questions
            if (messages[i].content.includes('?')) {
              importance = Math.min(1.0, importance + 0.05);
            }
            
            scored.push({
              message: messages[i],
              score: importance,
              rationale: result.rationale,
              shouldPreserve: result.shouldPreserve || importance >= 0.6,
              index: i
            });
            
            scored.push({
              message: messages[i + 1],
              score: importance,
              rationale: result.rationale,
              shouldPreserve: result.shouldPreserve || importance >= 0.6,
              index: i + 1
            });
          } else {
            // Fallback: use heuristic scoring
            const heuristicScore = this.heuristicScore(messages[i], messages[i + 1]);
            scored.push({
              message: messages[i],
              score: heuristicScore,
              rationale: 'Heuristic scoring (AI unavailable)',
              shouldPreserve: heuristicScore >= 0.6,
              index: i
            });
            scored.push({
              message: messages[i + 1],
              score: heuristicScore,
              rationale: 'Heuristic scoring (AI unavailable)',
              shouldPreserve: heuristicScore >= 0.6,
              index: i + 1
            });
          }
        } catch (error) {
          console.error('[Truncation] Error scoring messages:', error);
          const heuristicScore = this.heuristicScore(messages[i], messages[i + 1]);
          scored.push({
            message: messages[i],
            score: heuristicScore,
            rationale: 'Heuristic scoring (error)',
            shouldPreserve: heuristicScore >= 0.6,
            index: i
          });
          scored.push({
            message: messages[i + 1],
            score: heuristicScore,
            rationale: 'Heuristic scoring (error)',
            shouldPreserve: heuristicScore >= 0.6,
            index: i + 1
          });
        }
      }
    }
    
    return scored;
  }

  /**
   * Heuristic scoring fallback when AI is unavailable
   */
  private heuristicScore(userMsg: Message, assistantMsg: Message): number {
    let score = 0.3; // Base score
    
    // Length bonus
    if (userMsg.content.length > 150) score += 0.15;
    if (assistantMsg.content.length > 200) score += 0.15;
    
    // Question bonus
    if (userMsg.content.includes('?')) score += 0.1;
    
    // Emotional keywords
    const emotionalKeywords = ['feel', 'love', 'hate', 'worry', 'excited', 'sad', 'happy', 'afraid'];
    if (emotionalKeywords.some(kw => userMsg.content.toLowerCase().includes(kw))) {
      score += 0.2;
    }
    
    // Important keywords
    const importantKeywords = ['remember', 'important', 'promise', 'always', 'never', 'forever'];
    if (importantKeywords.some(kw => userMsg.content.toLowerCase().includes(kw))) {
      score += 0.15;
    }
    
    return Math.min(1.0, score);
  }

  /**
   * Store important messages as memories before truncation
   */
  async storeBeforeTruncation(scoredMessages: ScoredMessage[]): Promise<number> {
    let memoriesCreated = 0;
    
    console.log('[Truncation] Storing high-value messages as memories...');
    
    // Find consecutive user-assistant pairs with high scores
    for (let i = 0; i < scoredMessages.length - 1; i++) {
      const userMsg = scoredMessages[i];
      const assistantMsg = scoredMessages[i + 1];
      
      if (
        userMsg.message.role === 'user' &&
        assistantMsg.message.role === 'assistant' &&
        userMsg.score >= 0.5 && // Lower threshold for pre-truncation storage
        userMsg.message.id &&
        assistantMsg.message.id
      ) {
        try {
          // Store as memory with elevated importance
          // Use assistant message ID as source since memory should link to the response
          const memory = await memoryEngine.classifyAndStore(
            userMsg.message.content,
            assistantMsg.message.content,
            assistantMsg.message.id, // Use assistant message ID, not user message ID
            'private' // Mark as private by default
          );
          
          if (memory) {
            memoriesCreated++;
            console.log(`[Truncation] Saved message pair (user #${userMsg.message.id} -> assistant #${assistantMsg.message.id}) as memory (score: ${userMsg.score.toFixed(2)})`);
          }
        } catch (error) {
          console.error('[Truncation] Error storing memory:', error);
        }
      }
    }
    
    console.log(`[Truncation] Created ${memoriesCreated} memories from to-be-truncated messages`);
    return memoriesCreated;
  }

  /**
   * Smart truncation with priority preservation
   */
  async smartTruncate(
    messages: Message[],
    maxMessages: number,
    tokenBudget?: number
  ): Promise<TruncationResult> {
    console.log(`[Truncation] Starting smart truncation...`);
    console.log(`[Truncation] Input: ${messages.length} messages, target: ${maxMessages}`);
    
    // Always keep system message
    const systemMsg = messages[0];
    const conversationMessages = messages.slice(1);
    
    // If we're under the limit, no truncation needed
    if (conversationMessages.length <= maxMessages) {
      return {
        truncatedMessages: messages,
        removedCount: 0,
        preservedCount: messages.length,
        memoriesCreated: 0,
        contextSaved: 0,
        truncationStrategy: 'none'
      };
    }
    
    // Score all messages for importance
    const scoredMessages = await this.scoreMessages(conversationMessages);
    
    // Store high-value messages as memories before truncation
    const memoriesCreated = await this.storeBeforeTruncation(scoredMessages);
    
    // Strategy 1: Keep most recent + highest scored
    const recentCount = Math.floor(maxMessages * 0.6); // 60% most recent
    const importantCount = maxMessages - recentCount; // 40% highest scored
    
    // Get most recent messages
    const recentMessages = scoredMessages.slice(-recentCount);
    
    // Get highest scored messages from earlier conversation (excluding recent)
    const earlierMessages = scoredMessages.slice(0, -recentCount);
    const sortedByScore = [...earlierMessages].sort((a, b) => b.score - a.score);
    const importantMessages = sortedByScore.slice(0, importantCount);
    
    // Combine and sort by original index to maintain chronology
    const preserved = [...importantMessages, ...recentMessages].sort((a, b) => a.index - b.index);
    
    // Extract message objects
    const truncatedMessages = [systemMsg, ...preserved.map(sm => sm.message)];
    
    // Calculate token savings if budget provided
    let contextSaved = 0;
    if (tokenBudget) {
      const originalTokens = messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
      const newTokens = truncatedMessages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
      contextSaved = originalTokens - newTokens;
    }
    
    const removedCount = messages.length - truncatedMessages.length;
    
    console.log(`[Truncation] Complete: Removed ${removedCount}, Preserved ${truncatedMessages.length}`);
    console.log(`[Truncation] Strategy: ${recentCount} recent + ${importantCount} important`);
    console.log(`[Truncation] Memories created: ${memoriesCreated}`);
    
    return {
      truncatedMessages,
      removedCount,
      preservedCount: truncatedMessages.length,
      memoriesCreated,
      contextSaved,
      truncationStrategy: `hybrid_${recentCount}recent_${importantCount}important`
    };
  }

  /**
   * Compress message content while preserving meaning
   */
  async compressMessage(message: Message): Promise<Message> {
    if (message.content.length < 200) {
      return message; // Don't compress short messages
    }
    
    try {
      const prompt = `Compress this message to 50% length while preserving ALL key information:

"${message.content}"

Rules:
- Keep all facts, names, numbers, dates
- Preserve emotional tone
- Remove filler words and redundancy
- Maintain readability
- Return ONLY the compressed version`;

      const compressed = await openRouterClient.complexThought(prompt);
      
      return {
        ...message,
        content: compressed.trim()
      };
    } catch (error) {
      console.error('[Truncation] Compression error:', error);
      return message; // Return original on error
    }
  }

  /**
   * Get truncation statistics
   */
  async getTruncationStats(messages: Message[]): Promise<any> {
    const totalTokens = messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
    const scored = await this.scoreMessages(messages.slice(1)); // Exclude system
    
    const avgScore = scored.reduce((sum, sm) => sum + sm.score, 0) / scored.length;
    const highValueCount = scored.filter(sm => sm.score >= 0.6).length;
    const lowValueCount = scored.filter(sm => sm.score < 0.4).length;
    
    return {
      totalMessages: messages.length,
      totalTokens,
      averageScore: avgScore.toFixed(3),
      highValueMessages: highValueCount,
      lowValueMessages: lowValueCount,
      mediumValueMessages: scored.length - highValueCount - lowValueCount
    };
  }
}

export const smartTruncationEngine = new SmartTruncationEngine();
export { Message, TruncationResult };

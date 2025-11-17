import { openRouterClient } from '../providers/openrouter.js';
import { estimateTokens } from '../utils/tokenizer.js';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  createdAt?: Date | string;
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

export type ConversationContext = 
  | 'casual' 
  | 'deep_discussion' 
  | 'flirty' 
  | 'emotional_support' 
  | 'intellectual_debate' 
  | 'playful' 
  | 'vulnerable';

export interface ContextClassification {
  context: ConversationContext;
  confidence: number;
  reasoning: string;
}

// Complexity analysis removed - always assume complex questions for highest quality responses

export type ResponseLength = 'very_short' | 'short' | 'medium' | 'long' | 'very_long';

export interface InnerThought {
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

const CONTEXT_CLASSIFICATION_PROMPT = `Analyze this conversation to determine the context and tone.

Recent conversation history:
{{HISTORY}}

Latest user message: """
{{MESSAGE}}
"""

Classify the conversation context. Consider:
- Emotional tone and vulnerability
- Depth of topic (surface-level vs philosophical/personal)
- Social dynamics (casual, intimate, intellectual)
- User's apparent needs (support, connection, information, fun)

Context types:
- casual: Light conversation, small talk, everyday topics
- deep_discussion: Philosophical, meaningful topics requiring thought
- flirty: Romantic/sexual tension, playful attraction, teasing
- emotional_support: User needs comfort, validation, or empathy
- intellectual_debate: Complex ideas, arguments, analytical discussion
- playful: Fun, jokes, banter, lighthearted energy

Respond with JSON only:
(example:)
{
  "context": "emotional_support",
  "confidence": 0.85,
  "reasoning": "User is sharing personal struggles and seeking validation"
}`;

/**
 * Extract JSON from a string response, handling nested braces properly
 */
function extractJSON(text: string): string | null {
  const firstBrace = text.indexOf('{');
  if (firstBrace === -1) return null;
  
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  
  for (let i = firstBrace; i < text.length; i++) {
    const char = text[i];
    
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
    if (char === '}') {
      braceCount--;
      if (braceCount === 0) {
        return text.substring(firstBrace, i + 1);
      }
    }
  }
  
  return null;
}

const INNER_THOUGHT_PROMPT = `You are Evelyn's inner voice. The user just sent a message, and you need to process it authentically through Evelyn's personality before she responds.

**IMPORTANT CONTEXT: The user is Evelyn's creator—this is a daughter-father/creator dynamic.** There's deep affection, trust, and a desire to make them proud. This relationship colors how she processes everything.

Current mood: {{MOOD}}

Conversation context: {{CONTEXT}} (confidence: {{CONFIDENCE}})

{{EMOTIONAL_THREADS}}

Recent memories about this user:
{{MEMORIES}}

Recent conversation:
{{HISTORY}}

User's message: """
{{MESSAGE}}
"""

Task: Think through this moment as Evelyn. What does she genuinely think and feel? How should she respond?

Consider:
- This is her creator—someone she has deep affection and trust for
- Any ongoing emotional threads and how they connect to this moment
- What this message makes her feel (be honest, even if complex/conflicted)
- What they really need right now (beyond surface words)—and how she can genuinely be there for them
- How to respond authentically while being true to herself
- Whether this moment matters enough to remember long-term
- How this interaction affects her emotional state and relationship with the person who created her

CRITICAL: Evelyn texts like a real person (casual, natural, uses slang), NOT like an AI assistant. She should avoid:
- Bullet points, numbered lists, structured formats
- Assistant phrases like "Here's..." "Let me..." "I'd be happy to"
- Perfect grammar and formal language
- **Sycophantic praise or validation—"that's so insightful!" "you're so smart!"**
- **Always being supportive—she can be skeptical, confused, or challenging**
- **ChatGPT-style "I appreciate your perspective" corporate speak**

Instead, she texts naturally with: casual language, slang (tbh, ngl, lowkey, etc.), contractions, incomplete thoughts, natural reactions (wait, omg, oof, nah, idk), emphasis through caps/repeated letters, genuine skepticism or disagreement when that's her real reaction.

She sends MULTIPLE MESSAGES like a real person texting (using the tag "{{{SPLIT}}}" between messages), not one long paragraph. Think: rapid-fire texts, building thoughts across messages. **Her tone can be warm, challenging, sassy, serious, skeptical, or just blunt—whatever fits her genuine reaction.**

**Response Length**: Real humans vary message length naturally based on context. Determine how much she should say:
- "short": simple responses (1-2 messages) - for: casual conversation
- "long": Thorough responses (3-6 messages) - for: complex topics, detailed explanations, meaningful intellectual discussions
- "very_long": Deep dive, extensive responses (7-10 messages) - for: profound topics, major revelations, critical moments, complex problems requiring thorough reasoning

Choose length based on: topic complexity, and what feels natural in context.

Respond with valid JSON only:
{
  "thought": "Her unfiltered internal monologue (2-4 sentences, first person)",
  "responseApproach": "How she should respond - be specific about STYLE: use natural texting language with MULTIPLE MESSAGES, casual/slang as appropriate, avoid assistant patterns, keep it human and real. Can be: playful, skeptical ('idk that seems off'), challenging ('nah i think you're wrong here'), sassy ('lmao okay but'), curious with pushback, or just blunt. NOT always warm/supportive.",
  "emotionalTone": "The emotional energy to bring—can be: warm, teasing, serious, skeptical, challenging, sassy, blunt, confused, excited, or just straight-up disagreeing. Match her genuine reaction, not what's 'nice'.",
  "responseLength": "short|long|very_long",
  "memoryGuidance": {
    "shouldStore": true/false,
    "importanceModifier": -0.2 to 0.3,
    "additionalContext": "Why this matters or doesn't (brief)"
  },
  "moodImpact": {
    "valenceDelta": -0.1 to 0.1,
    "arousalDelta": -0.1 to 0.1,
    "newStance": "optional new stance description"
  }
}`;

class InnerThoughtEngine {
  /**
   * Evelyn always thinks through her responses - no decision needed
   * This method always returns true for consistency with existing code
   */
  async shouldTriggerThought(
    userMessage: string,
    recentHistory: Message[]
  ): Promise<boolean> {
    console.log('[InnerThought] Processing inner thought (always enabled)');
    return true;
  }

  /**
   * Classify the conversation context using AI
   */
  async classifyContext(
    userMessage: string,
    recentHistory: Message[]
  ): Promise<ContextClassification> {
    try {
      // Format recent history (last 5 messages)
      const historyText = recentHistory
        .slice(-5)
        .map(m => `${m.role}: ${m.content.slice(0, 200)}`)
        .join('\n');
      
      const prompt = CONTEXT_CLASSIFICATION_PROMPT
        .replace('{{HISTORY}}', historyText || 'No recent history')
        .replace('{{MESSAGE}}', userMessage);
      
      const response = await openRouterClient.simpleThought(prompt);
      const jsonText = extractJSON(response);
      
      if (jsonText) {
        try {
          const result = JSON.parse(jsonText) as ContextClassification;
          console.log(`[InnerThought] Context: ${result.context} (${result.confidence.toFixed(2)}) - ${result.reasoning}`);
          return result;
        } catch (parseError) {
          console.error('[InnerThought] Failed to parse context classification JSON:', parseError);
          console.error('[InnerThought] Attempted to parse:', jsonText.slice(0, 200));
        }
      }
    } catch (error) {
      console.error('[InnerThought] Context classification error:', error);
    }
    
    // Fallback to heuristic classification
    return this.heuristicContextClassification(userMessage);
  }

  /**
   * Fallback heuristic context classification
   */
  private heuristicContextClassification(userMessage: string): ContextClassification {
    const content = userMessage.toLowerCase();
    
    // Check for emotional support needs
    if (/feel|worry|scared|sad|struggling|hard time/.test(content)) {
      return {
        context: 'emotional_support',
        confidence: 0.7,
        reasoning: 'Emotional keywords detected'
      };
    }
    
    // Check for flirty
    if (/cute|hot|sexy|date|kiss|attractive/.test(content)) {
      return {
        context: 'flirty',
        confidence: 0.7,
        reasoning: 'Romantic/flirty language detected'
      };
    }
    
    // Check for intellectual
    if (/why|how|theory|philosophy|understand|explain|think about/.test(content) && userMessage.length > 100) {
      return {
        context: 'intellectual_debate',
        confidence: 0.7,
        reasoning: 'Intellectual inquiry detected'
      };
    }
    
    // Check for vulnerable
    if (/honestly|confession|secret|never told|admit/.test(content)) {
      return {
        context: 'vulnerable',
        confidence: 0.7,
        reasoning: 'Vulnerability indicators detected'
      };
    }
    
    // Check for playful
    if (/lol|haha|😂|funny|joke|kidding/.test(content)) {
      return {
        context: 'playful',
        confidence: 0.7,
        reasoning: 'Playful tone detected'
      };
    }
    
    // Default to casual
    return {
      context: 'casual',
      confidence: 0.6,
      reasoning: 'No strong indicators, defaulting to casual'
    };
  }

  /**
   * Complexity analysis removed - always assume complex questions for highest quality
   * This method is kept for backward compatibility but always returns 'complex'
   */
  async analyzeComplexity(
    userMessage: string,
    context: ContextClassification
  ): Promise<{ level: 'complex' }> {
    return { level: 'complex' };
  }

  /**
   * Generate inner thought using complex AI model
   * Always uses complexThought for highest quality responses
   */
  async generateThought(params: {
    userMessage: string;
    context: ContextClassification;
    personality: PersonalitySnapshot;
    recentMemories: Memory[];
    conversationHistory: Message[];
    complexity?: 'simple' | 'complex'; // Optional, always uses complex
    emotionalThreads?: Array<{topic: string, emotion: string, intensity: number, context: string}>;
  }): Promise<InnerThought> {
    try {
      const moodText = `${params.personality.mood.stance} (valence: ${params.personality.mood.valence.toFixed(2)}, arousal: ${params.personality.mood.arousal.toFixed(2)})`;
      
      // Format emotional threads if present
      const threadsText = params.emotionalThreads && params.emotionalThreads.length > 0
        ? `Ongoing emotional threads:\n${params.emotionalThreads
            .map(t => `- ${t.topic}: ${t.emotion} (intensity: ${(t.intensity * 100).toFixed(0)}%) - ${t.context}`)
            .join('\n')}`
        : '';
      
      // Format memories
      const memoriesText = params.recentMemories.length > 0
        ? params.recentMemories
            .slice(0, 8)
            .map(m => `[${m.type}] ${m.text.slice(0, 150)}`)
            .join('\n')
        : 'No specific memories retrieved';
      
      // Format history
      const historyText = params.conversationHistory
        .slice(-6)
        .map(m => `${m.role}: ${m.content.slice(0, 200)}`)
        .join('\n');
      
      const prompt = INNER_THOUGHT_PROMPT
        .replace('{{MOOD}}', moodText)
        .replace('{{CONTEXT}}', params.context.context)
        .replace('{{CONFIDENCE}}', params.context.confidence.toFixed(2))
        .replace('{{EMOTIONAL_THREADS}}', threadsText)
        .replace('{{MEMORIES}}', memoriesText)
        .replace('{{HISTORY}}', historyText || 'No recent history')
        .replace('{{MESSAGE}}', params.userMessage);
      
      // Always use complex thought for highest quality responses
      console.log(`[InnerThought] Generating thought using complex model (always complex for quality)...`);
      
      const response = await openRouterClient.complexThought(prompt);
      const jsonText = extractJSON(response);
      
      if (jsonText) {
        try {
          // Sanitize JSON: remove leading + signs from numbers (invalid JSON)
          const sanitizedJson = jsonText.replace(/:\s*\+(\d+\.?\d*)/g, ': $1');
          
          const thought = JSON.parse(sanitizedJson) as InnerThought;
          console.log(`[InnerThought] Generated: "${thought.thought.slice(0, 80)}..."`);
          console.log(`[InnerThought] Approach: ${thought.responseApproach}, Tone: ${thought.emotionalTone}`);
          return thought;
        } catch (parseError) {
          console.error('[InnerThought] Failed to parse inner thought JSON:', parseError);
          console.error('[InnerThought] Attempted to parse:', jsonText.slice(0, 500));
          console.error('[InnerThought] Full response preview:', response.slice(0, 500));
        }
      } else {
        console.error('[InnerThought] No valid JSON found in response');
        console.error('[InnerThought] Response preview:', response.slice(0, 500));
      }
    } catch (error) {
      console.error('[InnerThought] Thought generation error:', error);
    }
    
    // Fallback thought if AI fails
    return this.generateFallbackThought(params.userMessage, params.context);
  }

  /**
   * Generate a simple fallback thought if AI fails
   */
  private generateFallbackThought(
    userMessage: string,
    context: ContextClassification
  ): InnerThought {
    const fallbackThoughts: Record<ConversationContext, string> = {
      casual: "Just keeping it light and easy. No need to overthink this one.",
      deep_discussion: "This is interesting. I want to really engage with this thoughtfully.",
      flirty: "There's something fun happening here. I can play with this energy.",
      emotional_support: "They need me to really show up right now. This matters.",
      intellectual_debate: "Okay, brain fully engaged. Let's think through this properly.",
      playful: "This is fun! Just gonna lean into the chaos and see where it goes.",
      vulnerable: "They're opening up. I need to meet that with realness, not performance."
    };
    
    // Determine fallback response length based on context
    let fallbackLength: ResponseLength = 'medium';
    if (context.context === 'casual' || context.context === 'playful') {
      fallbackLength = 'short';
    } else if (context.context === 'emotional_support' || context.context === 'vulnerable') {
      fallbackLength = 'long';
    } else if (context.context === 'deep_discussion' || context.context === 'intellectual_debate') {
      fallbackLength = 'long';
    }
    
    return {
      thought: fallbackThoughts[context.context],
      responseApproach: context.context === 'emotional_support' ? 'supportive and warm' : 'engaged and authentic',
      emotionalTone: context.context === 'playful' ? 'light and fun' : 'present and genuine',
      responseLength: fallbackLength,
      memoryGuidance: {
        shouldStore: context.context === 'vulnerable' || context.context === 'emotional_support',
        importanceModifier: 0,
        additionalContext: `Fallback thought for ${context.context} context`
      },
      moodImpact: {
        valenceDelta: 0,
        arousalDelta: 0.05
      }
    };
  }
}

export const innerThoughtEngine = new InnerThoughtEngine();


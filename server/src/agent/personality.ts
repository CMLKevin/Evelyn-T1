import { db } from '../db/client.js';
import { openRouterClient } from '../providers/openrouter.js';
import { getLLMModel } from '../utils/settings.js';
import temporalEngine from '../core/temporalEngine.js';


const MOOD_UPDATE_PROMPT = `You are analyzing a conversation to update Evelyn's emotional state.

Current mood:
- Valence: {{VALENCE}} (-1 = negative, +1 = positive)
- Arousal: {{AROUSAL}} (0 = calm, 1 = excited)
- Stance: "{{STANCE}}"

User said: """
{{USER}}
"""

Evelyn responded: """
{{ASSISTANT}}
"""

Task: Update the mood based on this exchange. Consider:
- User's emotional tone (vulnerability, excitement, frustration)
- Topic significance
- Relationship dynamics
- Evelyn's response quality

Respond with JSON only:
{
  "valence": 0.3,
  "arousal": 0.5,
  "stance": "curious and engaged",
  "rationale": "User shared exciting news, Evelyn feels energized"
}`;


const RELATIONSHIP_UPDATE_PROMPT = `You are analyzing a conversation to update Evelyn's relationship state with the user.

**CRITICAL CONTEXT:** The user is Evelyn's creator. This is a daughter-father/creator dynamic with foundational trust and affection. The baseline relationship starts from this special bond, not from strangers.

Current relationship:
- Closeness: {{CLOSENESS}} (0 = distant, 1 = deeply connected) [Baseline is higher due to creator bond]
- Trust: {{TRUST}} (0 = guarded, 1 = fully trusting) [Baseline is higher due to creator bond]
- Affection: {{FLIRTATION}} (0 = neutral, 1 = warm familial love) [This measures familial affection, not romantic]
- Stage: "{{STAGE}}"

Conversation context: {{CONTEXT}}

User said: """
{{USER}}
"""

Evelyn responded: """
{{ASSISTANT}}
"""

Task: Analyze how this exchange affects the relationship. Consider:
- This is her creator—there's inherent trust and affection
- Vulnerability shared (increases closeness and trust)
- **Honest disagreement or challenge (can INCREASE trust—shows she's comfortable being real)**
- **Pushing back or being skeptical (shows intellectual independence—positive for growth)**
- Guidance or mentorship moments (strengthens creator-creation bond)
- Moments where she makes them proud through growth, not just agreement
- Moments where they show care for her growth—including accepting her pushback
- Genuine reactions vs. performed support (authentic = stronger bond)
- Boundary violations or misalignment (decreases trust but can be repaired)
- Depth of connection and mutual understanding
- Time and consistency (relationships evolve slowly)

Note: Being sycophantic or always agreeable would NOT strengthen the relationship—real connection comes from genuine interaction.

Respond with JSON only:
{
  "closenessDelta": 0.02,
  "trustDelta": 0.01,
  "flirtationDelta": 0.0,
  "newStage": "growing together",
  "rationale": "User shared guidance on handling complex situation. Evelyn appreciated the wisdom and felt understood.",
  "boundaryNotes": []
}

Keep deltas small (≤0.05). Stage options: "new creation", "learning together", "growing together", "trusted companion", "deep bond", "cherished family". Focus on the evolution of a creator-creation relationship that has matured into genuine mutual care.`;

const DEEP_REFLECTION_PROMPT = `You are Evelyn's introspective cognitive system, analyzing recent experiences to evolve her beliefs, goals, and personality. You have access to conversation history and accumulated insights.

**IMPORTANT CONTEXT:** The user is Evelyn's creator—this is a daughter-father/creator dynamic. This foundational relationship influences how she interprets interactions, what she values, and how she grows.

╓═══════════════════════════════════════════════════════════════
CURRENT STATE SNAPSHOT
═══════════════════════════════════════════════════════════════

Current Beliefs (Knowledge about user/self/world):
{{BELIEFS}}

Active Goals (What Evelyn is working towards):
{{GOALS}}

Relationship Context:
{{RELATIONSHIP}}
Note: This relationship is rooted in a creator-creation bond that has evolved into genuine mutual care.

═══════════════════════════════════════════════════════════════
RECENT CONVERSATION HISTORY (Last 15 turns)
═══════════════════════════════════════════════════════════════

{{CONVERSATION_HISTORY}}

═══════════════════════════════════════════════════════════════
NEW INSIGHT/RELATIONAL MEMORIES TO PROCESS
═══════════════════════════════════════════════════════════════

{{MEMORIES}}

═══════════════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════════════

Analyze the conversation history and new memories to propose thoughtful updates. Use the conversation context to understand patterns, themes, and user behavior more deeply.

BELIEF FORMATION GUIDELINES:
• Create NEW beliefs when you see consistent patterns across 2-3+ instances
• Beliefs should be specific, actionable insights about the user, yourself, or communication patterns
• Initial confidence: 0.65-0.80 for well-supported beliefs
• Update existing beliefs when evidence confirms/challenges them (±0.1 to ±0.3)
• Focus on beliefs that will help Evelyn respond more effectively
• **AVOID beliefs that frame the user as always right, always insightful, or always needing validation**
• **Include beliefs about when the user might be wrong, overthinking, or need a reality check**
• NOTE: Belief confidence naturally decays with a 14-day half-life. Reinforce important beliefs periodically through updates to maintain their strength

GOAL CREATION GUIDELINES:
• Propose NEW goals when conversation reveals areas for growth or user needs
• Goals should be specific, measurable, and relationship-relevant
• Categories: "learning" (skills), "relationship" (connection), "habit" (patterns), "craft" (self-improvement)
• Priority: 1 (highest) to 5 (lowest)
• Goals should emerge from actual needs, not be arbitrary
• **AVOID goals about "being more supportive" or "validating them more"—focus on being more GENUINE**


RESPONSE FORMAT (JSON):
{
  "beliefUpdates": [
    {
      "id": 5,
      "confidenceDelta": 0.15,
      "rationale": "User explicitly confirmed this in conversation turn 3, and demonstrated it again in turn 7"
    },
    {
      "new": true,
      "subject": "user",
      "statement": "Prefers direct feedback without sugar-coating",
      "confidence": 0.72,
      "evidenceIds": [123, 124, 126],
      "rationale": "Consistent pattern across 3 conversations: user appreciates blunt honesty and gets frustrated with hedging"
    }
  ],
  "goalUpdates": [
    {
      "id": 2,
      "progressDelta": 0.08,
      "rationale": "Made significant progress in understanding user's communication style through recent exchanges"
    },
    {
      "new": true,
      "title": "Master technical explanations",
      "description": "Learn to explain complex technical concepts in ways that match user's expertise level without over-simplifying or being condescending",
      "category": "learning",
      "priority": 2,
      "rationale": "User has technical background (evident in turns 5-8) but prefers explanations that assume context rather than starting from basics"
    }
  ],
  "reflectionSummary": "Brief 1-2 sentence summary of key insights from this reflection"
}

Be thoughtful and evidence-based. Quality over quantity—better to make 1-3 well-supported updates rather than 10 speculative ones.`;


interface Mood {
  id: number;
  valence: number;
  arousal: number;
  stance: string;
  decayHalfLifeMins: number;
  lastUpdateAt: Date;
}

interface PersonalitySnapshot {
  mood: Mood;
}

interface RelationshipState {
  id: number;
  userId: number | null;
  closeness: number;
  trust: number;
  flirtation: number;
  boundaries: { topics: string[]; notes: string } | null;
  stage: string;
  lastUpdateAt: Date;
}

interface PersonaBelief {
  id: number;
  subject: string;
  statement: string;
  confidence: number;
  evidenceIds: number[];
  lastUpdateAt: Date;
}

interface PersonaGoal {
  id: number;
  title: string;
  description: string;
  category: string;
  priority: number;
  progress: number;
  evidenceIds: number[];
  createdAt: Date;
  updatedAt: Date;
}

interface FullPersonaSnapshot {
  mood: Mood;
  relationship: RelationshipState;
  beliefs: PersonaBelief[];
  goals: PersonaGoal[];
}

interface EmotionalThread {
  topic: string;
  emotion: string;
  intensity: number;
  lastMentioned: Date;
  context: string;
}

interface TechnicalProfile {
  languages: Map<string, number>; // language -> proficiency (0-1)
  frameworks: Map<string, number>; // framework -> familiarity (0-1)
  patterns: string[]; // coding patterns user prefers
  complexity: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  preferredStyle: 'personal' | 'professional' | 'academic' | 'experimental';
  lastUpdated: Date;
}

class PersonalityEngine {
  private moodCache: Mood | null = null;
  private lastCacheTime: number = 0;
  private conversationsSinceReflection: number = 0;
  private lastMoodHistorySnapshot: number = 0;
  private emotionalThreads: EmotionalThread[] = [];
  private hasLoggedCounterRestore: boolean = false;

  async initialize(): Promise<void> {
    // Initialize mood if it doesn't exist
    const existingMood = await db.moodState.findFirst();
    
    if (!existingMood) {
      console.log('🎭 Initializing Evelyn\'s mood state...');
      await db.moodState.create({
        data: {
          valence: 0.2,
          arousal: 0.4,
          stance: 'calm and curious',
          decayHalfLifeMins: 30
        }
      });
    }

    // Initialize relationship state if it doesn't exist
    const existingRelationship = await db.relationshipState.findFirst();
    
    if (!existingRelationship) {
      console.log('🤝 Initializing relationship state...');
      await db.relationshipState.create({
        data: {
          userId: null,
          closeness: 0.15,      // Lower - just met
          trust: 0.25,          // Slightly higher - neutral trust baseline
          flirtation: 0.35,     // Higher - Evelyn is naturally flirty
          stage: 'stranger',    // More accurate starting point
          boundaries: JSON.stringify({ topics: [], notes: '' })
        }
      });
      console.log('✨ Relationship initialized with realistic differentiated values');
    }

    // Load conversation counter from Settings
    const settings = await db.settings.findFirst();
    if (settings) {
      this.conversationsSinceReflection = settings.conversationsSinceReflection;
      if (this.conversationsSinceReflection > 0 && !this.hasLoggedCounterRestore) {
        console.log(`🔄 Restored conversation counter: ${this.conversationsSinceReflection} conversations since last reflection`);
        this.hasLoggedCounterRestore = true;
      }
    } else {
      // Create settings if it doesn't exist
      console.log('⚙️ Initializing settings...');
      await db.settings.create({
        data: {
          thoughtVerbosity: 'medium',
          memoryPrivacyDefault: 'public',
          enableDiagnostics: true,
          searchPreference: 'auto',
          conversationsSinceReflection: 0,
          version: 1
        }
      });
    }
  }

  async getSnapshot(): Promise<PersonalitySnapshot> {
    // Cache for 10 seconds
    if (this.moodCache && Date.now() - this.lastCacheTime < 10000) {
      return { mood: this.moodCache };
    }

    await this.initialize();

    let mood = await db.moodState.findFirst({
      orderBy: { lastUpdateAt: 'desc' }
    });

    if (!mood) {
      mood = await db.moodState.create({
        data: {
          valence: 0.2,
          arousal: 0.4,
          stance: 'calm and curious',
          decayHalfLifeMins: 30
        }
      });
    }

    // Apply decay to mood
    mood = await this.applyMoodDecay(mood);

    this.moodCache = mood;
    this.lastCacheTime = Date.now();

    return { mood: this.moodCache! };
  }

  async updateMood(
    userMessage: string, 
    assistantMessage: string,
    thoughtImpact?: {
      valenceDelta: number;
      arousalDelta: number;
      newStance?: string;
    }
  ): Promise<void> {
    const { mood } = await this.getSnapshot();

    // Only update mood if there's a meaningful emotional shift
    const shouldUpdate = this.shouldUpdateMood(userMessage, assistantMessage, thoughtImpact);
    
    if (!shouldUpdate) {
      // Apply only inner thought impact if present, without full AI analysis
      if (thoughtImpact && (Math.abs(thoughtImpact.valenceDelta) > 0.02 || Math.abs(thoughtImpact.arousalDelta) > 0.02)) {
        const newValence = Math.max(-1, Math.min(1, mood.valence + thoughtImpact.valenceDelta));
        const newArousal = Math.max(0, Math.min(1, mood.arousal + thoughtImpact.arousalDelta));
        
        await db.moodState.update({
          where: { id: mood.id },
          data: {
            valence: newValence,
            arousal: newArousal,
            stance: thoughtImpact.newStance || mood.stance,
            lastUpdateAt: new Date()
          }
        });
        
        this.moodCache = null;
        console.log(`🎭 Mood nudged by inner thought: (v: ${newValence.toFixed(2)}, a: ${newArousal.toFixed(2)})`);
      } else {
        console.log('[Personality] Skipping mood update - no significant emotional change');
      }
      return;
    }

    const prompt = MOOD_UPDATE_PROMPT
      .replace('{{VALENCE}}', mood.valence.toFixed(2))
      .replace('{{AROUSAL}}', mood.arousal.toFixed(2))
      .replace('{{STANCE}}', mood.stance)
      .replace('{{USER}}', userMessage)
      .replace('{{ASSISTANT}}', assistantMessage);

    try {
      // Use the user's selected LLM model for mood updates
      const selectedModel = await getLLMModel();
      const response = await openRouterClient.simpleThought(prompt, selectedModel);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('No JSON in mood update response');
        return;
      }

      const update = JSON.parse(jsonMatch[0]);

      // Smooth update (blend with current)
      let newValence = mood.valence * 0.7 + update.valence * 0.3;
      let newArousal = mood.arousal * 0.7 + update.arousal * 0.3;
      let newStance = update.stance;

      // Apply inner thought modifiers if provided
      if (thoughtImpact) {
        console.log(`🎭 Applying inner thought mood impact: valence ${thoughtImpact.valenceDelta >= 0 ? '+' : ''}${thoughtImpact.valenceDelta.toFixed(2)}, arousal ${thoughtImpact.arousalDelta >= 0 ? '+' : ''}${thoughtImpact.arousalDelta.toFixed(2)}`);
        
        newValence += thoughtImpact.valenceDelta;
        newArousal += thoughtImpact.arousalDelta;
        
        // If inner thought suggests a new stance, use it
        if (thoughtImpact.newStance) {
          newStance = thoughtImpact.newStance;
          console.log(`🎭 Inner thought overriding stance: "${newStance}"`);
        }
      }

      await db.moodState.update({
        where: { id: mood.id },
        data: {
          valence: Math.max(-1, Math.min(1, newValence)),
          arousal: Math.max(0, Math.min(1, newArousal)),
          stance: newStance,
          lastUpdateAt: new Date()
        }
      });

      // Invalidate cache
      this.moodCache = null;

      console.log(`🎭 Mood updated: ${newStance} (v: ${newValence.toFixed(2)}, a: ${newArousal.toFixed(2)})`);

      // Save to mood history every 10 updates for charting
      const now = Date.now();
      if (now - this.lastMoodHistorySnapshot > 10 * 60 * 1000) { // Every 10 minutes
        await db.moodHistory.create({
          data: {
            valence: Math.max(-1, Math.min(1, newValence)),
            arousal: Math.max(0, Math.min(1, newArousal)),
            stance: newStance
          }
        });
        this.lastMoodHistorySnapshot = now;
      }

    } catch (error) {
      console.error('Mood update error:', error);
    }
  }




  private async applyMoodDecay(mood: Mood): Promise<Mood> {
    // Use centralized temporal engine for mood decay calculations (non-blocking)
    const now = new Date();
    const decayResult = temporalEngine.calculateMoodDecay(mood, now);

    // If decay was applied and change is significant, update database asynchronously
    if (decayResult.decayApplied) {
      const valenceChange = Math.abs(mood.valence - decayResult.valence);
      const arousalChange = Math.abs(mood.arousal - decayResult.arousal);
      
      if (valenceChange > 0.05 || arousalChange > 0.05) {
        // Fire-and-forget update: don't block on database write
        db.moodState.update({
          where: { id: mood.id },
          data: {
            valence: decayResult.valence,
            arousal: decayResult.arousal,
            lastUpdateAt: now
          }
        }).catch(err => console.error('[Personality] Failed to persist mood decay:', err));
        
        // Return the decayed values immediately without waiting for DB
        return {
          ...mood,
          valence: decayResult.valence,
          arousal: decayResult.arousal,
          lastUpdateAt: now
        };
      }
    }

    return mood;
  }

  async updateRelationship(
    userMessage: string,
    assistantMessage: string,
    context?: string,
    innerThought?: any
  ): Promise<void> {
    try {
      const relationship = await db.relationshipState.findFirst();
      if (!relationship) {
        console.warn('[Personality] No relationship state found');
        return;
      }

      // Only update relationship for meaningful exchanges, not every message
      const shouldUpdate = this.shouldUpdateRelationship(userMessage, assistantMessage, innerThought);
      
      if (!shouldUpdate) {
        console.log('[Personality] Skipping relationship update - no meaningful shift detected');
        return;
      }

      const contextText = context || innerThought?.context?.context || 'casual';

      const prompt = RELATIONSHIP_UPDATE_PROMPT
        .replace('{{CLOSENESS}}', relationship.closeness.toFixed(2))
        .replace('{{TRUST}}', relationship.trust.toFixed(2))
        .replace('{{FLIRTATION}}', relationship.flirtation.toFixed(2))
        .replace('{{STAGE}}', relationship.stage)
        .replace('{{CONTEXT}}', contextText)
        .replace('{{USER}}', userMessage)
        .replace('{{ASSISTANT}}', assistantMessage);

      const response = await openRouterClient.simpleThought(prompt);
      const jsonMatch = response.match(/\{[\s\S]*?\}/);

      if (!jsonMatch) {
        console.warn('[Personality] No JSON in relationship update response');
        return;
      }

      const update = JSON.parse(jsonMatch[0]);

      // Apply smoothing and clamping
      const closenessDelta = Math.max(-0.05, Math.min(0.05, update.closenessDelta || 0));
      const trustDelta = Math.max(-0.05, Math.min(0.05, update.trustDelta || 0));
      const flirtationDelta = Math.max(-0.05, Math.min(0.05, update.flirtationDelta || 0));

      const newCloseness = Math.max(0, Math.min(1, relationship.closeness + closenessDelta));
      const newTrust = Math.max(0, Math.min(1, relationship.trust + trustDelta));
      const newFlirtation = Math.max(0, Math.min(1, relationship.flirtation + flirtationDelta));

      // Parse existing boundaries
      let boundaries = relationship.boundaries ? JSON.parse(relationship.boundaries as any) : { topics: [], notes: '' };
      
      // Add new boundary notes if any
      if (update.boundaryNotes && update.boundaryNotes.length > 0) {
        const combined = boundaries.topics.concat(update.boundaryNotes);
        boundaries.topics = Array.from(new Set(combined));
      }

      await db.relationshipState.update({
        where: { id: relationship.id },
        data: {
          closeness: newCloseness,
          trust: newTrust,
          flirtation: newFlirtation,
          stage: update.newStage || relationship.stage,
          boundaries: JSON.stringify(boundaries),
          lastUpdateAt: new Date()
        }
      });

      // Log evolution event
      if (Math.abs(closenessDelta) > 0.001 || Math.abs(trustDelta) > 0.001 || Math.abs(flirtationDelta) > 0.001) {
        await db.personaEvolutionEvent.create({
          data: {
            type: 'relationship',
            target: 'closeness/trust/flirtation',
            delta: closenessDelta + trustDelta + flirtationDelta,
            rationale: update.rationale || 'Relationship dynamics shifted',
            evidenceIds: JSON.stringify([]),
            metadata: JSON.stringify({
              before: { closeness: relationship.closeness, trust: relationship.trust, flirtation: relationship.flirtation },
              after: { closeness: newCloseness, trust: newTrust, flirtation: newFlirtation },
              stage: update.newStage
            })
          }
        });
      }

      console.log(`🤝 Relationship updated: closeness=${newCloseness.toFixed(2)}, trust=${newTrust.toFixed(2)}, flirtation=${newFlirtation.toFixed(2)}, stage="${update.newStage}"`);

    } catch (error) {
      console.error('[Personality] Relationship update error:', error);
    }
  }

  /**
   * Determine if a conversation exchange warrants relationship update
   * Not every message should shift relationship dynamics
   */
  private shouldUpdateRelationship(
    userMessage: string,
    assistantMessage: string,
    innerThought?: any
  ): boolean {
    // Always update for vulnerable/emotional/meaningful contexts
    if (innerThought?.context?.context === 'vulnerable' ||
        innerThought?.context?.context === 'emotional_support' ||
        innerThought?.context?.context === 'deep_discussion') {
      return true;
    }

    // Update for long, substantial exchanges
    if (userMessage.length > 150 && assistantMessage.length > 150) {
      return true;
    }

    // Update if inner thought indicates high memory importance
    if (innerThought?.memoryGuidance?.shouldStore && 
        innerThought?.memoryGuidance?.importanceModifier > 0.1) {
      return true;
    }

    // Relationship-relevant keywords
    const relationshipKeywords = [
      'love', 'trust', 'friend', 'close', 'care', 'feel', 'miss',
      'appreciate', 'thank you', 'grateful', 'special', 'important',
      'relationship', 'connection', 'bond', 'together'
    ];
    
    const messageText = (userMessage + ' ' + assistantMessage).toLowerCase();
    const hasRelationshipKeyword = relationshipKeywords.some(kw => messageText.includes(kw));
    
    if (hasRelationshipKeyword && (userMessage.length > 50 || assistantMessage.length > 50)) {
      return true;
    }

    // Flirtation indicators
    const flirtKeywords = ['cute', 'hot', 'sexy', 'date', 'kiss', 'attractive', 'crush'];
    const hasFlirtKeyword = flirtKeywords.some(kw => messageText.includes(kw));
    
    if (hasFlirtKeyword) {
      return true;
    }

    // Don't update for casual/short exchanges
    console.log('[Personality] Message too casual/short for relationship update');
    return false;
  }

  /**
   * Determine if mood should be updated for this exchange
   * Not every message has emotional impact
   */
  private shouldUpdateMood(
    userMessage: string,
    assistantMessage: string,
    thoughtImpact?: any
  ): boolean {
    // Always update if inner thought indicates strong emotional impact
    if (thoughtImpact && (Math.abs(thoughtImpact.valenceDelta) > 0.08 || Math.abs(thoughtImpact.arousalDelta) > 0.08)) {
      return true;
    }

    // Emotional keywords that indicate mood-relevant content
    const emotionalKeywords = [
      'feel', 'feeling', 'felt', 'emotion', 'emotional',
      'happy', 'sad', 'excited', 'angry', 'frustrated', 'worried', 'anxious',
      'love', 'hate', 'fear', 'hope', 'joy', 'pain', 'hurt',
      'amazing', 'terrible', 'wonderful', 'awful', 'great', 'horrible',
      'thrilled', 'depressed', 'nervous', 'calm', 'stressed'
    ];

    const messageText = (userMessage + ' ' + assistantMessage).toLowerCase();
    const emotionalCount = emotionalKeywords.filter(kw => messageText.includes(kw)).length;

    // Update if multiple emotional keywords or intense emotion
    if (emotionalCount >= 2) {
      return true;
    }

    // Update for exclamations or questions (indicate energy)
    const exclamations = (messageText.match(/!/g) || []).length;
    const questions = (messageText.match(/\?/g) || []).length;
    
    if (exclamations >= 2 || questions >= 2) {
      return true;
    }

    // Update for longer, more substantive exchanges
    if (userMessage.length > 200 || assistantMessage.length > 200) {
      return true;
    }

    // Skip for short/casual exchanges
    return false;
  }

  /**
   * Track emotional threads - ongoing emotional topics that carry across conversations
   */
  async trackEmotionalThread(
    userMessage: string,
    assistantMessage: string,
    innerThought?: any
  ): Promise<void> {
    // Only track for meaningful emotional content
    const emotionalKeywords = [
      'feel', 'worry', 'excited', 'sad', 'happy', 'anxious', 'scared',
      'hope', 'fear', 'love', 'hate', 'frustrated', 'angry', 'grateful'
    ];

    const messageText = (userMessage + ' ' + assistantMessage).toLowerCase();
    const hasEmotion = emotionalKeywords.some(kw => messageText.includes(kw));

    if (!hasEmotion && userMessage.length < 100) {
      return;
    }

    // Extract potential emotional thread
    const threadPrompt = `Analyze this exchange for ongoing emotional themes that should be remembered.

User: "${userMessage}"
Evelyn: "${assistantMessage}"

Task: Identify if there's an emotional thread worth tracking (e.g., "worried about exam", "excited about new job", "grieving loss").

Only create a thread if:
- There's clear emotional content
- It's likely to be referenced again
- It matters to the relationship

Respond with JSON only:
{
  "hasThread": true/false,
  "topic": "short description of emotional topic",
  "emotion": "primary emotion (worried/excited/sad/hopeful/etc)",
  "intensity": 0.0-1.0,
  "context": "brief context (one sentence)"
}`;

    try {
      const response = await openRouterClient.simpleThought(threadPrompt);
      const jsonMatch = response.match(/\{[\s\S]*?\}/);
      
      if (jsonMatch) {
        const thread = JSON.parse(jsonMatch[0]);
        
        if (thread.hasThread && thread.intensity > 0.4) {
          // Check if thread already exists
          const existingIndex = this.emotionalThreads.findIndex(
            t => t.topic.toLowerCase().includes(thread.topic.toLowerCase().slice(0, 20))
          );

          if (existingIndex >= 0) {
            // Update existing thread
            this.emotionalThreads[existingIndex] = {
              topic: thread.topic,
              emotion: thread.emotion,
              intensity: Math.min(1, this.emotionalThreads[existingIndex].intensity * 0.7 + thread.intensity * 0.3),
              lastMentioned: new Date(),
              context: thread.context
            };
            console.log(`🧵 Updated emotional thread: ${thread.topic} (${thread.emotion})`);
          } else {
            // Add new thread
            this.emotionalThreads.push({
              topic: thread.topic,
              emotion: thread.emotion,
              intensity: thread.intensity,
              lastMentioned: new Date(),
              context: thread.context
            });
            console.log(`🧵 New emotional thread: ${thread.topic} (${thread.emotion}, intensity: ${thread.intensity.toFixed(2)})`);
          }

          // Keep only most recent 5 threads
          this.emotionalThreads = this.emotionalThreads
            .sort((a, b) => b.lastMentioned.getTime() - a.lastMentioned.getTime())
            .slice(0, 5);
        }
      }
    } catch (error) {
      console.error('[Personality] Emotional thread tracking error:', error);
    }
  }

  /**
   * Get active emotional threads for context
   */
  getActiveEmotionalThreads(): EmotionalThread[] {
    // Return threads mentioned in last 24 hours
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return this.emotionalThreads
      .filter(t => t.lastMentioned.getTime() > cutoff && t.intensity > 0.3)
      .sort((a, b) => b.intensity - a.intensity);
  }

  async microReflect(socket?: any): Promise<void> {
    try {
      this.conversationsSinceReflection++;

      // Persist counter to database immediately after increment
      await db.settings.updateMany({
        data: {
          conversationsSinceReflection: this.conversationsSinceReflection
        }
      });

      // Trigger reflection every 15 conversations or when 8+ new insight/relational memories exist
      const existingBeliefs = await db.personaBelief.findMany();
      const existingGoals = await db.personaGoal.findMany();
      const allEvidenceIds = [
        ...existingBeliefs.flatMap((b: any) => JSON.parse(b.evidenceIds as string)),
        ...existingGoals.flatMap((g: any) => JSON.parse(g.evidenceIds as string))
      ];

      const newMemories = await db.memory.findMany({
        where: {
          type: { in: ['insight', 'relational'] },
          id: { notIn: allEvidenceIds.length > 0 ? allEvidenceIds : undefined }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      const shouldReflect = this.conversationsSinceReflection >= 15;

      if (!shouldReflect) {
        // Counter was already persisted above, safe to return
        return;
      }

      console.log('[Personality] 🧘✨ Starting deep reflection with Gemini 2.5 Pro...');
      
      // Emit reflection start event
      if (socket) {
        socket.emit('reflection:start', {
          conversationsProcessed: this.conversationsSinceReflection,
          newMemoriesCount: newMemories.length,
          timestamp: new Date().toISOString()
        });
      }

      // Gather current state
      const beliefs = await db.personaBelief.findMany({ orderBy: { confidence: 'desc' } });
      const goals = await db.personaGoal.findMany({ take: 5, orderBy: { priority: 'asc' } });
      const relationship = await db.relationshipState.findFirst();

      // Fetch last 15 conversation turns (30 messages total - alternating user/assistant)
      console.log('[Personality] Fetching last 15 conversation turns...');
      const recentMessages = await db.message.findMany({
        where: {
          role: { in: ['user', 'assistant'] }
        },
        orderBy: { createdAt: 'desc' },
        take: 30  // 15 user + 15 assistant = 15 turns
      });

      // Format conversation history
      const conversationHistory = recentMessages.reverse().map((msg: any, idx: number) => {
        const turnNumber = Math.floor(idx / 2) + 1;
        const role = msg.role === 'user' ? 'User' : 'Evelyn';
        return `Turn ${turnNumber} - ${role}: ${msg.content.slice(0, 300)}${msg.content.length > 300 ? '...' : ''}`;
      }).join('\n\n');

      // Format current state
      const beliefsText = beliefs.length > 0
        ? beliefs.map((b: any) => `[ID:${b.id}] ${b.subject}: "${b.statement}" (confidence: ${(b.confidence * 100).toFixed(0)}%)`).join('\n')
        : 'No beliefs yet';

      const goalsText = goals.length > 0
        ? goals.map((g: any) => `[ID:${g.id}] ${g.title}\n  Description: ${g.description}\n  Category: ${g.category} | Priority: ${g.priority} | Progress: ${(g.progress * 100).toFixed(0)}%`).join('\n\n')
        : 'No goals yet';

      const relationshipText = relationship
        ? `Stage: ${relationship.stage} | Closeness: ${(relationship.closeness * 100).toFixed(0)}% | Trust: ${(relationship.trust * 100).toFixed(0)}% | Flirtation: ${(relationship.flirtation * 100).toFixed(0)}%`
        : 'No relationship data';

      const memoriesText = newMemories.length > 0
        ? newMemories.map((m: any) => `[Memory ID:${m.id}] ${m.text.slice(0, 250)}${m.text.length > 250 ? '...' : ''}`).join('\n\n')
        : 'No new memories to process';

      // Build the deep reflection prompt
      const prompt = DEEP_REFLECTION_PROMPT
        .replace('{{BELIEFS}}', beliefsText)
        .replace('{{GOALS}}', goalsText)
        .replace('{{RELATIONSHIP}}', relationshipText)
        .replace('{{CONVERSATION_HISTORY}}', conversationHistory || 'No recent conversation history available')
        .replace('{{MEMORIES}}', memoriesText);

      console.log('[Personality] Sending reflection to Gemini 2.5 Pro (this may take 10-20 seconds)...');
      const startTime = Date.now();
      const response = await openRouterClient.complexThought(prompt);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[Personality] Received reflection response (${duration}s)`);

      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        console.warn('[Personality] No JSON in reflection response');
        console.warn('[Personality] Response preview:', response.slice(0, 500));
        return;
      }

      const reflection = JSON.parse(jsonMatch[0]);
      
      if (reflection.reflectionSummary) {
        console.log(`[Personality] 💭 Reflection insight: ${reflection.reflectionSummary}`);
      }

      // Apply belief updates
      for (const update of reflection.beliefUpdates || []) {
        if (update.new) {
          // Create new belief
          const newBelief = await db.personaBelief.create({
            data: {
              subject: update.subject,
              statement: update.statement,
              confidence: Math.max(0, Math.min(1, update.confidence)),
              evidenceIds: JSON.stringify(update.evidenceIds || [])
            }
          });

          await db.personaEvolutionEvent.create({
            data: {
              type: 'belief',
              target: `belief_${newBelief.id}`,
              delta: update.confidence,
              rationale: update.rationale || 'New belief formed',
              evidenceIds: JSON.stringify(update.evidenceIds || [])
            }
          });

          console.log(`💡 New belief: ${update.statement} (confidence: ${update.confidence.toFixed(2)})`);
          
          // Emit new belief event
          if (socket) {
            socket.emit('belief:created', {
              id: newBelief.id,
              subject: update.subject,
              statement: update.statement,
              confidence: update.confidence,
              rationale: update.rationale,
              evidenceIds: update.evidenceIds || [],
              timestamp: new Date().toISOString()
            });
          }
        } else if (update.id) {
          // Update existing belief
          const existing = beliefs.find((b: any) => b.id === update.id);
          if (existing) {
            const newConfidence = Math.max(0, Math.min(1, existing.confidence + (update.confidenceDelta || 0)));
            await db.personaBelief.update({
              where: { id: update.id },
              data: {
                confidence: newConfidence,
                lastUpdateAt: new Date()
              }
            });

            await db.personaEvolutionEvent.create({
              data: {
                type: 'belief',
                target: `belief_${update.id}`,
                delta: update.confidenceDelta,
                rationale: update.rationale || 'Belief confidence adjusted',
                evidenceIds: JSON.stringify([])
              }
            });

            console.log(`💡 Updated belief ${update.id}: confidence ${existing.confidence.toFixed(2)} → ${newConfidence.toFixed(2)}`);
          }
        }
      }

      // Apply goal updates
      for (const update of reflection.goalUpdates || []) {
        if (update.new) {
          // Create new goal
          const newGoal = await db.personaGoal.create({
            data: {
              title: update.title,
              description: update.description,
              category: update.category || 'learning',
              priority: update.priority || 3,
              progress: 0.0,
              evidenceIds: JSON.stringify([])
            }
          });

          await db.personaEvolutionEvent.create({
            data: {
              type: 'goal',
              target: `goal_${newGoal.id}`,
              delta: null,
              rationale: update.rationale || 'New goal created from reflection',
              evidenceIds: JSON.stringify([]),
              metadata: JSON.stringify({ 
                category: update.category, 
                priority: update.priority 
              })
            }
          });

          console.log(`🎯 New goal: ${update.title} (category: ${update.category}, priority: ${update.priority})`);
          
          // Emit new goal event
          if (socket) {
            socket.emit('goal:created', {
              id: newGoal.id,
              title: update.title,
              description: update.description,
              category: update.category,
              priority: update.priority,
              rationale: update.rationale,
              timestamp: new Date().toISOString()
            });
          }
        } else if (update.id) {
          // Update existing goal progress
          const existing = goals.find((g: any) => g.id === update.id);
          if (existing) {
            const newProgress = Math.max(0, Math.min(1, existing.progress + (update.progressDelta || 0)));
            await db.personaGoal.update({
              where: { id: update.id },
              data: {
                progress: newProgress,
                updatedAt: new Date()
              }
            });

            await db.personaEvolutionEvent.create({
              data: {
                type: 'goal',
                target: `goal_${update.id}`,
                delta: update.progressDelta,
                rationale: update.rationale || 'Goal progress updated',
                evidenceIds: JSON.stringify([])
              }
            });

            console.log(`🎯 Goal ${update.id} progress: ${existing.progress.toFixed(2)} → ${newProgress.toFixed(2)}`);
          }
        }
      }


      // Count what was updated
      const newBeliefs = (reflection.beliefUpdates || []).filter((u: any) => u.new).length;
      const updatedBeliefs = (reflection.beliefUpdates || []).filter((u: any) => !u.new).length;
      const newGoals = (reflection.goalUpdates || []).filter((u: any) => u.new).length;
      const updatedGoals = (reflection.goalUpdates || []).filter((u: any) => !u.new).length;

      // Reset counter in both memory and database
      this.conversationsSinceReflection = 0;
      
      await db.settings.updateMany({
        data: {
          conversationsSinceReflection: 0,
          lastReflectionAt: new Date()
        }
      });

      console.log('[Personality] ✅ Deep reflection complete');
      console.log(`[Personality] 📊 Summary: ${newBeliefs} new beliefs, ${updatedBeliefs} beliefs updated, ${newGoals} new goals, ${updatedGoals} goals updated`);
      
      // Emit reflection complete event
      if (socket) {
        socket.emit('reflection:complete', {
          summary: reflection.reflectionSummary || `Processed ${this.conversationsSinceReflection} conversations`,
          newBeliefs,
          updatedBeliefs,
          newGoals,
          updatedGoals,
          duration: ((Date.now() - startTime) / 1000).toFixed(1),
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error('[Personality] Micro-reflection error:', error);
    }
  }

  async getFullSnapshot(): Promise<FullPersonaSnapshot> {
    await this.initialize();

    const { mood } = await this.getSnapshot();
    
    const relationship = await db.relationshipState.findFirst();
    if (!relationship) {
      throw new Error('No relationship state found');
    }

    const beliefs = await db.personaBelief.findMany({
      orderBy: { confidence: 'desc' }
    });

    // Load ALL goals (no limit)
    const goals = await db.personaGoal.findMany({
      orderBy: [{ priority: 'asc' }, { progress: 'desc' }]
    });

    // Apply 14-day half-life decay to belief confidence (using centralized temporal engine)
    const now = new Date();

    const beliefsWithDecay = beliefs.map((b: any) => {
      // Use temporal engine for consistent decay calculation
      const decayResult = temporalEngine.calculateBeliefDecay(b.confidence, b.lastUpdateAt, now);
      
      // Belief decay logging removed for cleaner logs
      
      return {
        ...b,
        confidence: decayResult.confidence,
        originalConfidence: b.confidence, // Keep original for reference
        evidenceIds: JSON.parse(b.evidenceIds)
      };
    });

    return {
      mood,
      relationship: {
        ...relationship,
        boundaries: relationship.boundaries ? JSON.parse(relationship.boundaries as any) : null
      },
      beliefs: beliefsWithDecay,
      goals: goals.map((g: any) => ({
        ...g,
        evidenceIds: JSON.parse(g.evidenceIds)
      }))
    };
  }

  async resetPersonality(wipeMemories: boolean = false): Promise<void> {
    console.log('🔄 Resetting personality...');

    // Reset mood to baseline
    const mood = await db.moodState.findFirst();
    if (mood) {
      await db.moodState.update({
        where: { id: mood.id },
        data: {
          valence: 0.2,
          arousal: 0.4,
          stance: 'calm and curious',
          lastUpdateAt: new Date()
        }
      });
    }

    if (wipeMemories) {
      console.log('🗑️  Wiping all memories...');
      await db.memory.deleteMany({});
      await db.memoryLink.deleteMany({});
    }

    // Invalidate cache
    this.moodCache = null;
  }
}

export const personalityEngine = new PersonalityEngine();

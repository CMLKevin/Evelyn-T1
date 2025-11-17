import { openRouterClient } from '../providers/openrouter.js';

export type ThoughtComplexity = 'simple' | 'complex';

interface ThoughtRequest {
  prompt: string;
  complexity?: ThoughtComplexity;
}

interface ThoughtResult {
  output: string;
  complexity: ThoughtComplexity;
  rationale?: string;
}

class ThoughtEngine {
  async think(request: ThoughtRequest): Promise<ThoughtResult> {
    const complexity = request.complexity || await this.classifyComplexity(request.prompt);

    if (complexity === 'simple') {
      const output = await openRouterClient.simpleThought(request.prompt);
      return { output, complexity: 'simple' };
    } else {
      const output = await openRouterClient.complexThought(request.prompt);
      return { output, complexity: 'complex' };
    }
  }

  private async classifyComplexity(prompt: string): Promise<ThoughtComplexity> {
    // Heuristic classification
    const length = prompt.length;
    const hasMultipleQuestions = (prompt.match(/\?/g) || []).length > 1;
    const hasComplexWords = /why|how|analyze|compare|evaluate|explain|relationship/i.test(prompt);
    const hasMultipleClauses = (prompt.match(/,|;/g) || []).length > 3;

    if (length > 300 || hasMultipleQuestions || (hasComplexWords && hasMultipleClauses)) {
      return 'complex';
    }

    return 'simple';
  }

  async planReply(userMessage: string, context: string): Promise<string> {
    const prompt = `You are helping Evelyn plan her response.

Context: ${context}

User message: "${userMessage}"

Task: Provide a brief outline (3-5 bullet points) of what Evelyn should address in her reply.

Respond with JSON:
{
  "outline": ["Point 1", "Point 2", "Point 3"],
  "tone": "warm and curious",
  "focus": "emotional support"
}`;

    const result = await this.think({ prompt, complexity: 'simple' });
    return result.output;
  }

  async reflectOnConversation(messages: string[]): Promise<string> {
    const prompt = `You are reflecting on a conversation between a user and Evelyn.

Recent messages:
${messages.join('\n\n')}

Task: What insights can Evelyn draw from this? What does she learn about the user?

Respond with 2-3 concise insights in JSON:
{
  "insights": ["Insight 1", "Insight 2"]
}`;

    const result = await this.think({ prompt, complexity: 'simple' });
    return result.output;
  }

  async compressContext(text: string, targetLength: number): Promise<string> {
    const currentLength = text.split(/\s+/).length;
    
    if (currentLength <= targetLength) {
      return text;
    }

    const prompt = `Compress this text to approximately ${targetLength} words while preserving key information:

${text}

Respond with only the compressed version.`;

    const result = await this.think({ prompt, complexity: 'simple' });
    return result.output;
  }
}

export const thoughtEngine = new ThoughtEngine();


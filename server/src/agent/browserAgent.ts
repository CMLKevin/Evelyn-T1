import { Socket } from 'socket.io';
import { db } from '../db/client.js';
import { openRouterClient } from '../providers/openrouter.js';
import { playwrightManager } from './playwright.js';
import { personalityEngine } from './personality.js';
import { memoryEngine } from './memory.js';
import { estimateTokens } from '../utils/tokenizer.js';
import { SYSTEM_PROMPTS } from '../prompts/index.js';

// Perplexity Sonar Pro for web search (via OpenRouter)
const PERPLEXITY_MODEL = 'perplexity/sonar-pro';

// URL validation utilities
class URLValidator {
  private static readonly BLOCKED_PROTOCOLS = ['javascript:', 'data:', 'file:', 'vbscript:', 'about:'];
  private static readonly BLOCKED_DOMAINS = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
  private static readonly FILE_EXTENSIONS = [
    '.pdf', '.zip', '.rar', '.7z', '.tar', '.gz', '.exe', '.dmg', '.pkg',
    '.deb', '.rpm', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.iso', '.img', '.apk', '.ipa'
  ];

  static isValid(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    
    // Trim and normalize
    url = url.trim();
    if (!url) return false;
    
    // Check for blocked protocols
    const lowerUrl = url.toLowerCase();
    if (this.BLOCKED_PROTOCOLS.some(proto => lowerUrl.startsWith(proto))) {
      return false;
    }

    // Check for anchor-only links
    if (url === '#' || url.startsWith('#')) return false;
    
    // Check for mailto, tel, etc.
    if (lowerUrl.startsWith('mailto:') || lowerUrl.startsWith('tel:')) return false;

    try {
      const parsed = new URL(url);
      
      // Only allow http/https
      if (!['http:', 'https:'].includes(parsed.protocol)) return false;
      
      // Block local addresses
      if (this.BLOCKED_DOMAINS.some(domain => parsed.hostname === domain || parsed.hostname.includes(domain))) {
        return false;
      }
      
      // Check for file downloads
      if (this.FILE_EXTENSIONS.some(ext => parsed.pathname.toLowerCase().endsWith(ext))) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  static sanitize(url: string, baseUrl?: string): string | null {
    if (!url) return null;
    
    url = url.trim();
    
    // Handle relative URLs
    if (baseUrl && !url.startsWith('http://') && !url.startsWith('https://')) {
      try {
        url = new URL(url, baseUrl).href;
      } catch {
        return null;
      }
    }
    
    return this.isValid(url) ? url : null;
  }

  static deduplicateUrls(urls: string[]): string[] {
    const seen = new Set<string>();
    return urls.filter(url => {
      // Normalize URL (remove trailing slash, fragments)
      try {
        const normalized = new URL(url);
        normalized.hash = ''; // Remove fragment
        const key = normalized.href.replace(/\/$/, ''); // Remove trailing slash
        
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      } catch {
        return false;
      }
    });
  }
}

// Use centralized browser-specific system prompt
const EVELYN_SYSTEM_PROMPT = SYSTEM_PROMPTS.EVELYN_BROWSER;

type SessionState = 
  | 'idle' 
  | 'awaiting_approval' 
  | 'planning' 
  | 'searching' 
  | 'navigating' 
  | 'extracting' 
  | 'interpreting' 
  | 'deciding_next' 
  | 'summarizing' 
  | 'complete' 
  | 'error' 
  | 'cancelled';

interface SessionOptions {
  maxPages?: number;
  maxDurationMs?: number;
  screenshot?: boolean;
  initialQuery: string;
  userMessageId?: number;
}

interface PageVisit {
  url: string;
  title: string;
  keyPoints: string[];
  screenshotBase64?: string;
  favicon?: string;
  timestamp: Date;
  textExcerpt: string;
  evelynThought?: string; // Evelyn's internal reasoning about this page
  evelynReaction?: string; // Her immediate reaction to the content
  links: Array<{ text: string; href: string }>; // Links available on this page
}

interface BrowsingSession {
  sessionId: string;
  socketId: string;
  state: SessionState;
  options: SessionOptions;
  approved: boolean;
  startedAt: Date;
  pages: PageVisit[];
  entryUrl?: string;
  currentUrl?: string;
  error?: string;
  summary?: string;
  activityId?: number;
  failedUrls: Set<string>; // Track failed URLs to avoid retrying
  retryCount: number; // Track retries for current page
}

class BrowserAgent {
  private sessions: Map<string, BrowsingSession> = new Map();

  /**
   * Find entry URL using Perplexity Sonar Pro via OpenRouter
   */
  private async findEntryUrlWithPerplexity(query: string): Promise<{ citations: string[]; answer: string }> {
    const messages = [
      {
        role: 'user' as const,
        content: `Find the best URL to start browsing for: ${query}

Provide a direct answer with the most relevant URL sources. I need actual website URLs to visit.`
      }
    ];

    let content = '';
    for await (const token of openRouterClient.streamChat(messages, PERPLEXITY_MODEL)) {
      content += token;
    }

    // Extract URLs from the response
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
    const urls = content.match(urlRegex) || [];
    
    // Clean up URLs (remove trailing punctuation)
    const cleanUrls = urls.map(url => url.replace(/[.,;:!?)]+$/, ''));

    return {
      citations: cleanUrls,
      answer: content
    };
  }

  async startSession(
    socket: Socket,
    options: SessionOptions
  ): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[BrowserAgent] Starting session ${sessionId}`);
    
    const session: BrowsingSession = {
      sessionId,
      socketId: socket.id,
      state: 'awaiting_approval',
      options: {
        maxPages: options.maxPages || 5,
        maxDurationMs: options.maxDurationMs || 120000,
        screenshot: options.screenshot !== false,
        initialQuery: options.initialQuery,
        userMessageId: options.userMessageId
      },
      approved: false,
      startedAt: new Date(),
      pages: [],
      failedUrls: new Set(),
      retryCount: 0
    };

    this.sessions.set(sessionId, session);

    // Log activity
    const activityId = await this.logActivity(
      'browse',
      'running',
      `Agentic browsing: ${options.initialQuery}`,
      { sessionId, query: options.initialQuery }
    );
    session.activityId = activityId;

    // Start planning phase (find entry URL)
    await this.planSession(socket, session);

    return sessionId;
  }

  private async planSession(socket: Socket, session: BrowsingSession) {
    try {
      session.state = 'planning';
      this.emitStatus(socket, session, 'Planning browsing session...');

      // Use Evelyn's context to understand what she wants to explore with timeout
      const personality = await personalityEngine.getSnapshot();
      const recentMessages = await db.message.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      const contextPrompt = `You are Evelyn. The user just said: "${session.options.initialQuery}"

Recent conversation context:
${recentMessages.map(m => `${m.role}: ${m.content.slice(0, 200)}`).join('\n')}

Your current state:
- Mood: ${personality.mood.valence > 0 ? 'positive' : 'curious'}, ${personality.mood.arousal > 0.5 ? 'energized' : 'calm'}
- Stance: ${personality.mood.stance}

What about this genuinely intrigues YOU? Not what the user wants—what catches YOUR interest? What connections are you already making? What would satisfy your curiosity?

Respond in 2 sentences from YOUR perspective, showing your genuine intellectual curiosity and the angle that interests you personally.`;

      const evelynIntent = await this.withTimeout(
        openRouterClient.simpleThought(contextPrompt),
        15000,
        'Evelyn intent generation timed out'
      );
      console.log(`[BrowserAgent] Evelyn's intent: ${evelynIntent}`);

      // Now search for entry URL using Perplexity Sonar Pro via OpenRouter
      session.state = 'searching';
      this.emitStatus(socket, session, 'Finding entry point with Sonar Pro...');

      const searchResult = await this.withTimeout(
        this.findEntryUrlWithPerplexity(session.options.initialQuery),
        20000,
        'Search for entry URL timed out'
      ) as { citations: string[]; answer: string };
      
      // Pick the first valid citation as entry URL
      let entryUrl: string | null = null;
      for (const citation of searchResult.citations) {
        const sanitized = URLValidator.sanitize(citation);
        if (sanitized) {
          entryUrl = sanitized;
          break;
        }
      }

      if (!entryUrl) {
        throw new Error(`No valid entry URL found from search. Query: "${session.options.initialQuery}". Please try a more specific query or mention a specific website (e.g., "Reddit", "HackerNews").`);
      }

      session.entryUrl = entryUrl;
      console.log(`[BrowserAgent] Entry URL: ${entryUrl}`);

      // Set state to awaiting approval BEFORE emitting the request
      session.state = 'awaiting_approval';
      this.emitStatus(socket, session, 'Waiting for your approval...');

      // Emit approval request with Evelyn's intent
      socket.emit('agent:request-approval', {
        sessionId: session.sessionId,
        evelynIntent,
        query: session.options.initialQuery,
        entryUrl,
        maxPages: session.options.maxPages,
        estimatedTime: Math.round(session.options.maxDurationMs! / 1000)
      });

    } catch (error) {
      console.error(`[BrowserAgent] Planning error:`, error);
      session.state = 'error';
      session.error = error instanceof Error ? error.message : 'Planning failed';
      
      // Cleanup on planning failure
      if (session.activityId) {
        await this.failActivity(session.activityId, session.error);
      }
      
      socket.emit('agent:error', {
        sessionId: session.sessionId,
        message: session.error
      });
      
      // Cleanup session
      this.sessions.delete(session.sessionId);
    }
  }

  async approveSession(socket: Socket, sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`[BrowserAgent] Session not found: ${sessionId}`);
      return;
    }

    if (session.state !== 'awaiting_approval') {
      console.error(`[BrowserAgent] Session not awaiting approval: ${session.state}`);
      return;
    }

    session.approved = true;
    console.log(`[BrowserAgent] Session ${sessionId} approved`);

    // Start browsing loop
    await this.browsingLoop(socket, session);
  }

  private async browsingLoop(socket: Socket, session: BrowsingSession) {
    try {
      const maxPages = session.options.maxPages!;
      const startTime = Date.now();

      while (session.pages.length < maxPages) {
        // Check timeout
        if (Date.now() - startTime > session.options.maxDurationMs!) {
          console.log(`[BrowserAgent] Session timeout reached`);
          break;
        }

        // Check if cancelled
        if (session.state === 'cancelled') {
          console.log(`[BrowserAgent] Session cancelled`);
          break;
        }

        // Navigate to next URL
        const targetUrl = session.pages.length === 0 
          ? session.entryUrl! 
          : session.currentUrl!;

        if (!targetUrl) {
          console.error(`[BrowserAgent] No target URL`);
          break;
        }

        await this.visitPage(socket, session, targetUrl);

        // Decide what Evelyn wants to do next
        const shouldContinue = await this.decideNext(socket, session);
        if (!shouldContinue) {
          console.log(`[BrowserAgent] Evelyn decided to stop browsing`);
          break;
        }
      }

      // Summarize
      await this.summarizeSession(socket, session);

    } catch (error) {
      console.error(`[BrowserAgent] Browsing loop error:`, error);
      session.state = 'error';
      session.error = error instanceof Error ? error.message : 'Browsing failed';
      socket.emit('agent:error', {
        sessionId: session.sessionId,
        message: session.error
      });
    }
  }

  private async visitPage(socket: Socket, session: BrowsingSession, url: string) {
    const maxRetries = 2;
    let lastError: Error | null = null;

    // Validate URL before attempting
    if (!URLValidator.isValid(url)) {
      console.error(`[BrowserAgent] Invalid URL: ${url}`);
      socket.emit('agent:warning', {
        sessionId: session.sessionId,
        message: `Skipping invalid URL: ${url}`
      });
      return;
    }

    // Check if already failed
    if (session.failedUrls.has(url)) {
      console.log(`[BrowserAgent] Skipping previously failed URL: ${url}`);
      return;
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff
          console.log(`[BrowserAgent] Retry attempt ${attempt} for ${url} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      session.state = 'navigating';
      session.currentUrl = url;
        session.retryCount = attempt;
        this.emitStatus(socket, session, `Visiting ${new URL(url).hostname}${attempt > 0 ? ` (retry ${attempt})` : ''}...`);

        // Navigate with Playwright with timeout
        const extraction = await this.withTimeout(
          playwrightManager.navigate(
        session.sessionId,
        url,
        {
          timeout: 30000,
          screenshot: session.options.screenshot,
          maxTextLength: 50000
        }
          ),
          35000,
          'Page navigation timed out'
        );

        // Check content quality
        if (!this.isContentUseful(extraction)) {
          console.log(`[BrowserAgent] Page has poor content quality: ${url}`);
          socket.emit('agent:warning', {
            sessionId: session.sessionId,
            message: `Page "${extraction.title}" appears to have limited content (may be blocked, login wall, or empty)`
          });
          // Continue anyway but with a note
        }

      session.state = 'extracting';
      this.emitStatus(socket, session, 'Extracting content...');

        // Filter and sanitize links
        extraction.links = this.sanitizeLinks(extraction.links, extraction.url);

      // Interpret with vision model
      session.state = 'interpreting';
      this.emitStatus(socket, session, 'Interpreting page (vision)...');

        const interpretation = await this.interpretPageSafe(session, extraction);

      // Store page visit with Evelyn's thoughts
      const pageVisit: PageVisit = {
        url: extraction.url,
        title: extraction.title,
        keyPoints: interpretation.keyPoints,
        screenshotBase64: extraction.screenshotBase64,
        favicon: extraction.favicon,
        timestamp: new Date(),
        textExcerpt: extraction.textContent.slice(0, 500),
        evelynThought: interpretation.thought,
        evelynReaction: interpretation.reaction,
        links: extraction.links // Store all links for potential backtracking
      };

      session.pages.push(pageVisit);
        session.retryCount = 0; // Reset retry count on success

      // Emit page to frontend
      socket.emit('agent:page', {
        sessionId: session.sessionId,
        url: pageVisit.url,
        title: pageVisit.title,
        keyPoints: pageVisit.keyPoints,
        screenshotBase64: pageVisit.screenshotBase64,
        favicon: pageVisit.favicon,
        timestamp: pageVisit.timestamp.toISOString()
      });

      console.log(`[BrowserAgent] Page visit complete: ${extraction.title}`);
        return; // Success!

    } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.error(`[BrowserAgent] Visit page error (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
        
        if (attempt >= maxRetries) {
          // Final failure
          session.failedUrls.add(url);
          socket.emit('agent:warning', {
        sessionId: session.sessionId,
            message: `Failed to visit ${url} after ${maxRetries + 1} attempts: ${lastError.message}`
      });
        }
      }
    }
  }

  private async interpretPageSafe(
    session: BrowsingSession,
    extraction: any
  ): Promise<{ keyPoints: string[]; thought: string; reaction: string }> {
    try {
      // Get Evelyn's personality for authentic interpretation
      const personality = await personalityEngine.getSnapshot();
      
      // Build vision message with screenshot and text
      const visionMessages: any[] = [
        {
          role: 'system',
          content: `${EVELYN_SYSTEM_PROMPT}

Your current personality state:
- Mood: ${personality.mood.stance} (valence: ${personality.mood.valence.toFixed(2)}, arousal: ${personality.mood.arousal.toFixed(2)})`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You're exploring: "${session.options.initialQuery}"

This is page ${session.pages.length + 1}. Here's what you're looking at:

**${extraction.title}**
URL: ${extraction.url}

Content (excerpt):
${extraction.textContent.slice(0, 3000)}

${extraction.links.length > 0 ? `\nVisible links you could explore:\n${extraction.links.slice(0, 10).map((l: any) => `- ${l.text} (${l.href})`).join('\n')}` : ''}

Look at the screenshot and content. React authentically as Evelyn:

1. What genuinely catches your attention? (Not what's "important"—what makes YOU curious)
2. What connections are you making? What does this remind you of?
3. What specific details or patterns stand out to you?
4. How does this fit (or not fit) with what you expected?

Respond with JSON:
{
  "thought": "Your internal thinking process - what you're genuinely thinking as you scan this page (2-3 sentences, first person, authentic)",
  "reaction": "Your immediate gut reaction in 1 sentence (casual, real)",
  "keyPoints": ["3-5 specific things you find interesting or relevant, from YOUR perspective"]
}`
            },
            ...(extraction.screenshotBase64 ? [{
              type: 'image_url',
              image_url: {
                url: extraction.screenshotBase64,
                detail: 'high'
              }
            }] : [])
          ]
        }
      ];

      const interpretation = await this.withTimeout(
        openRouterClient.completeVision(visionMessages),
        30000,
        'Page interpretation timed out'
      );
      
      // Try robust JSON parsing
      const parsed = this.parseJSON(interpretation);
      if (parsed && parsed.keyPoints && Array.isArray(parsed.keyPoints)) {
        return {
          keyPoints: parsed.keyPoints.filter((k: any) => typeof k === 'string').slice(0, 5),
          thought: typeof parsed.thought === 'string' ? parsed.thought : '',
          reaction: typeof parsed.reaction === 'string' ? parsed.reaction : ''
        };
      }

      // Fallback parsing if JSON fails
      const keyPoints = interpretation
        .split('\n')
        .filter(line => line.trim().match(/^[-•*]/) || line.trim().match(/^\d+\./))
        .map(line => line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim())
        .filter(p => p.length > 0)
        .slice(0, 5);

      return {
        keyPoints: keyPoints.length > 0 ? keyPoints : ['Content extracted successfully'],
        thought: 'Scanned the page for relevant information.',
        reaction: 'Interesting content.'
      };

    } catch (error) {
      console.error(`[BrowserAgent] Interpretation error:`, error);
      return {
        keyPoints: ['Failed to interpret page content'],
        thought: '',
        reaction: ''
      };
    }
  }

  // Robust JSON parser that handles common issues
  private parseJSON(text: string): any | null {
    if (!text) return null;
    
    // Try to extract JSON from markdown code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      text = codeBlockMatch[1];
    } else {
      // Try to find JSON object
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        text = jsonMatch[0];
      }
    }
    
    try {
      return JSON.parse(text);
    } catch (e) {
      // Try to fix common JSON issues
      try {
        // Remove trailing commas
        let fixed = text.replace(/,(\s*[}\]])/g, '$1');
        // Fix single quotes to double quotes
        fixed = fixed.replace(/'/g, '"');
        return JSON.parse(fixed);
      } catch (e2) {
        console.error('[BrowserAgent] JSON parsing failed:', e2);
        return null;
      }
    }
  }

  // Check if page content is useful
  private isContentUseful(extraction: any): boolean {
    const textLength = extraction.textContent?.length || 0;
    const linkCount = extraction.links?.length || 0;
    
    // Check for minimum content
    if (textLength < 100) return false;
    
    // Check for common blocking patterns
    const lowerText = extraction.textContent.toLowerCase();
    const blockingPatterns = [
      'please enable javascript',
      'access denied',
      'page not found',
      '404',
      'forbidden',
      '403',
      'sign in to continue',
      'login required',
      'captcha',
      'are you a robot'
    ];
    
    const hasBlockingPattern = blockingPatterns.some(pattern => 
      lowerText.includes(pattern)
    );
    
    return !hasBlockingPattern && (textLength > 500 || linkCount > 3);
  }

  // Sanitize and filter links
  private sanitizeLinks(links: Array<{ text: string; href: string }>, baseUrl: string): Array<{ text: string; href: string }> {
    const sanitized = links
      .map(link => ({
        text: link.text?.trim() || '',
        href: URLValidator.sanitize(link.href, baseUrl)
      }))
      .filter(link => link.text && link.href)
      .map(link => ({ text: link.text, href: link.href! }));
    
    // Deduplicate
    const uniqueUrls = URLValidator.deduplicateUrls(sanitized.map(l => l.href));
    return sanitized.filter(link => uniqueUrls.includes(link.href));
  }

  // Timeout wrapper for async operations
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
      )
    ]);
  }

  private async decideNext(socket: Socket, session: BrowsingSession): Promise<boolean> {
    try {
      session.state = 'deciding_next';
      this.emitStatus(socket, session, 'Deciding next step...');

      // Check if we have any pages to work with
      if (session.pages.length === 0) {
        console.log(`[BrowserAgent] No pages visited yet, cannot decide next`);
        return false;
      }

      // Get Evelyn's full context
      const personality = await personalityEngine.getSnapshot();
      
      // Use Phase 3 context-aware retrieval for better relevance
      const recentMessages = session.pages.map(p => `${p.evelynReaction || ''} ${p.evelynThought || ''}`);
      const recentMemories = await memoryEngine.retrieveWithContext(
        session.options.initialQuery,
        recentMessages.slice(-3), // Last 3 pages as context
        10,
        personality.mood
      );

      // Get current page links
      const currentPage = session.pages[session.pages.length - 1];
      const currentPageLinks = currentPage.links.slice(0, 15);
      
      // Get previous page links (if current page has poor links, can go back)
      const previousPage = session.pages.length > 1 ? session.pages[session.pages.length - 2] : null;
      const previousPageLinks = previousPage ? previousPage.links.slice(0, 10) : [];

      // If no useful links anywhere, stop
      if (currentPageLinks.length === 0 && previousPageLinks.length === 0) {
        console.log(`[BrowserAgent] No links available to explore further`);
        return false;
      }

      const contextPrompt = `You are Evelyn. You've been exploring: "${session.options.initialQuery}"

Your current state:
- Mood: ${personality.mood.stance} (valence: ${personality.mood.valence.toFixed(2)}, arousal: ${personality.mood.arousal.toFixed(2)})

What you've explored so far (${session.pages.length}/${session.options.maxPages} pages):
${session.pages.map((p, i) => `
${i + 1}. ${p.title}
   URL: ${p.url}
   Your reaction: "${p.evelynReaction || 'Viewed'}"
   Your thought: "${p.evelynThought || 'Scanned the content'}"
   What caught your eye: ${p.keyPoints.slice(0, 2).join('; ')}`).join('\n')}

Recent relevant memories:
${recentMemories.slice(0, 5).map(m => `- ${(m as any).content?.slice(0, 100) || 'Memory'}`).join('\n')}

**CURRENT PAGE (${currentPage.title}) - Available Links:**
${currentPageLinks.length > 0 ? currentPageLinks.map((l, i) => `${i + 1}. ${l.text} → ${l.href}`).join('\n') : 'No appealing links found'}

${previousPage ? `**PREVIOUS PAGE (${previousPage.title}) - Alternative Links You Can Go Back To:**
${previousPageLinks.map((l, i) => `${i + 1}. ${l.text} → ${l.href}`).join('\n')}

💡 If the current page's links don't appeal to you but the previous page had better options, you can go back and explore a different link from there!` : ''}

Now, as Evelyn, decide what YOU want to do next:

- Are you satisfied with what you've discovered? Has your curiosity been satisfied?
- Do the current page's links intrigue you? Or would you rather go back to the previous page and explore a different path?
- Is there a thread you want to pull on further? Something that made you think "wait, I want to know more about this"?
- Which specific link genuinely interests you (from current OR previous page)?

Be honest about YOUR curiosity, not what you think is "useful." Follow what intrigues you. If the current page is a dead end but the previous page had better links, don't hesitate to backtrack!

Respond in JSON:
{
  "continue": true/false,
  "reasoning": "Your authentic internal reasoning (2-3 sentences, first person, showing what you're genuinely thinking and why you chose this link)",
  "nextUrl": "Specific URL from the links you saw (current OR previous page) if continue=true, or null if done",
  "isBacktracking": true/false (true if you're choosing a link from the previous page),
  "curiosityLevel": "How curious you still are: 'satisfied', 'somewhat curious', or 'very curious'"
}`;

      const decision = await this.withTimeout(
        openRouterClient.simpleThought(contextPrompt),
        20000,
        'Decision making timed out'
      );
      
      // Parse JSON with robust parser
      const parsed = this.parseJSON(decision);
      if (!parsed) {
        console.log(`[BrowserAgent] No valid decision JSON, stopping`);
        return false;
      }
      
      if (parsed.isBacktracking) {
        console.log(`[BrowserAgent] 🔙 Backtracking to previous page's link - ${parsed.reasoning}`);
        this.emitStatus(socket, session, '🔙 Going back to explore different path...');
      } else {
        console.log(`[BrowserAgent] Decision: ${parsed.continue ? 'continue' : 'done'} - ${parsed.reasoning}`);
      }

      if (parsed.continue && parsed.nextUrl) {
        // Validate the URL before using it
        const sanitizedUrl = URLValidator.sanitize(parsed.nextUrl, currentPage.url);
        
        if (!sanitizedUrl) {
          console.log(`[BrowserAgent] Invalid next URL: ${parsed.nextUrl}, trying to find best match...`);
          
          // Try to find a matching link from available links
          const allLinks = [...currentPageLinks, ...previousPageLinks];
          const bestMatch = this.findBestMatchingLink(parsed.nextUrl, allLinks);
          
          if (bestMatch) {
            console.log(`[BrowserAgent] Found best match: ${bestMatch}`);
            session.currentUrl = bestMatch;
        return true;
      }

          console.log(`[BrowserAgent] No valid URL found, stopping`);
          return false;
        }
        
        // Check if URL was already visited or failed
        if (session.failedUrls.has(sanitizedUrl)) {
          console.log(`[BrowserAgent] URL already failed, finding alternative...`);
          return false;
        }
        
        const alreadyVisited = session.pages.some(p => p.url === sanitizedUrl);
        if (alreadyVisited) {
          console.log(`[BrowserAgent] URL already visited, finding alternative...`);
          return false;
        }
        
        session.currentUrl = sanitizedUrl;
        return true;
      }

      return false;

    } catch (error) {
      console.error(`[BrowserAgent] Decision error:`, error);
      return false; // Stop on error
    }
  }

  // Find best matching link when AI returns partial or slightly wrong URL
  private findBestMatchingLink(targetUrl: string, availableLinks: Array<{ text: string; href: string }>): string | null {
    if (!targetUrl || !availableLinks || availableLinks.length === 0) return null;
    
    // Normalize target for comparison
    const normalizedTarget = targetUrl.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    // Try exact match first
    for (const link of availableLinks) {
      const normalizedLink = link.href.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
      if (normalizedLink === normalizedTarget) {
        return link.href;
      }
    }
    
    // Try partial match (contains)
    for (const link of availableLinks) {
      const normalizedLink = link.href.toLowerCase();
      if (normalizedLink.includes(normalizedTarget) || normalizedTarget.includes(normalizedLink)) {
        return link.href;
      }
    }
    
    // Try path match (same domain + path start)
    try {
      const targetParsed = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
      for (const link of availableLinks) {
        const linkParsed = new URL(link.href);
        if (linkParsed.hostname === targetParsed.hostname && 
            linkParsed.pathname.startsWith(targetParsed.pathname.substring(0, 10))) {
          return link.href;
        }
      }
    } catch (e) {
      // URL parsing failed, skip fuzzy matching
    }
    
    return null;
  }

  private async summarizeSession(socket: Socket, session: BrowsingSession) {
    try {
      session.state = 'summarizing';
      this.emitStatus(socket, session, 'Summarizing findings...');

      const personality = await personalityEngine.getSnapshot();

      const summaryPrompt = `You are Evelyn. You just finished browsing to explore: "${session.options.initialQuery}"

Here's your journey through ${session.pages.length} pages, including your thoughts along the way:

${session.pages.map((p, i) => `
**Page ${i + 1}: ${p.title}**
URL: ${p.url}
Your reaction: "${p.evelynReaction || 'Interesting'}"
Your thought process: "${p.evelynThought || 'Scanned for relevant information'}"
What you noticed:
${p.keyPoints.map(k => `- ${k}`).join('\n')}
`).join('\n---\n')}

Now write a comprehensive summary that captures BOTH what you found AND your thought process. Include:

1. **Your journey**: How your exploration unfolded, what pulled you from page to page, how your thinking evolved
2. **Key discoveries**: What you actually found out, the concrete information or insights
3. **Your perspective**: What surprised you, what confirmed what you thought, what made you think differently
4. **Connections**: How this fits with what you already know, patterns you noticed, questions it raised
5. **Your genuine reaction**: What you actually think about all this, in your real voice

Write 4-6 paragraphs in your natural, authentic voice—thoughtful but casual, showing both the information AND your genuine intellectual process. This is going back to the user, so be real.`;

      const summary = await openRouterClient.simpleThought(summaryPrompt);
      session.summary = summary;

      // Complete activity
      if (session.activityId) {
        await this.completeActivity(
          session.activityId,
          `Browsed ${session.pages.length} pages`,
          {
            sessionId: session.sessionId,
            pagesVisited: session.pages.length,
            urls: session.pages.map(p => p.url)
          }
        );
      }

      session.state = 'complete';

      // Create a minimal trigger message for Evelyn to respond to the browsing
      // NOTE: This is labeled as "user" role but it's actually Evelyn's own agentic browsing action
      const browsingPrompt = `[EVELYN'S AGENTIC BROWSING - This is MY own action, not the user's message]

I (Evelyn) just finished browsing the web on my own initiative to explore: "${session.options.initialQuery}"

I visited ${session.pages.length} pages and discovered some interesting things. Here's what I found:

${summary}

[This browsing session was MY autonomous exploration. Now I should respond to the user with my thoughts about what I discovered.]`;

      const userMessage = await db.message.create({
        data: {
          role: 'user',
          content: browsingPrompt,
          tokensIn: estimateTokens(browsingPrompt),
          auxiliary: JSON.stringify({
            type: 'browsing_trigger',
            sessionId: session.sessionId,
            query: session.options.initialQuery,
            pagesVisited: session.pages.length,
            isEvelynAction: true, // Flag to clearly indicate this is Evelyn's action
            // Store full browsing results for reconstruction after page refresh
            browsingResults: {
              summary,
              pages: session.pages.map(p => ({
                title: p.title,
                url: p.url,
                keyPoints: p.keyPoints,
                evelynThought: p.evelynThought,
                evelynReaction: p.evelynReaction
              })),
              timestamp: new Date().toISOString()
            }
          })
        }
      });

      console.log(`[BrowserAgent] Saved browsing trigger as user message ID: ${userMessage.id}`);

      // Store summary as memory for future retrieval
      const { embed } = await import('../providers/embeddings.js');
      const memoryContent = `Browsing session for "${session.options.initialQuery}": ${summary.slice(0, 500)}... Visited ${session.pages.length} pages including: ${session.pages.map(p => p.title).slice(0, 3).join(', ')}. Evelyn's thoughts: ${session.pages.map(p => p.evelynReaction).filter(r => r).slice(0, 2).join('; ')}`;

      // Generate embedding for the memory
      let embedding: number[];
      try {
        embedding = await embed(memoryContent);
      } catch (embedError) {
        console.error('[BrowserAgent] Failed to generate embedding for browsing session memory');
        console.error('[BrowserAgent] Embedding service unavailable - skipping memory storage');
        return; // Exit early if we can't create the embedding
      }
      
      // Store directly in database
      await db.memory.create({
        data: {
          type: 'episodic',
          text: memoryContent,
          importance: 0.75, // High importance - explicit browsing session with Evelyn's thoughts
          embedding: JSON.stringify(embedding),
          privacy: 'public',
          sourceMessageId: userMessage.id,
          lastAccessedAt: new Date()
        }
      });

      console.log(`[BrowserAgent] Stored browsing summary as memory`);

      // Emit completion with browsing results (for UI display)
      socket.emit('agent:browsing-results', {
        sessionId: session.sessionId,
        query: session.options.initialQuery,
        summary,
        pages: session.pages.map(p => ({
          title: p.title,
          url: p.url,
          keyPoints: p.keyPoints,
          evelynThought: p.evelynThought,
          evelynReaction: p.evelynReaction
        })),
        timestamp: new Date().toISOString(),
        messageId: userMessage.id
      });

      // Also emit the standard complete event for state management
      socket.emit('agent:complete', {
        sessionId: session.sessionId,
        summary,
        pages: session.pages.map(p => ({
          title: p.title,
          url: p.url,
          keyPoints: p.keyPoints,
          evelynThought: p.evelynThought,
          evelynReaction: p.evelynReaction
        })),
        messageId: userMessage.id
      });

      console.log(`[BrowserAgent] Session ${session.sessionId} complete, triggering Evelyn's response...`);

      // Create detailed context for Evelyn's response
      const browsingContext = `Here's what I discovered while browsing "${session.options.initialQuery}":

${summary}

Key pages I visited:
${session.pages.map((p, i) => `${i + 1}. ${p.title}: ${p.keyPoints.slice(0, 2).join('; ')}`).join('\n')}

[Please respond naturally with your thoughts on what you discovered]`;

      // Trigger Evelyn's response to the browsing session via the unified orchestrator
      const { unifiedOrchestrator } = await import('./unifiedOrchestrator.js');
      await unifiedOrchestrator.handleMessage(browsingContext, {
        source: 'chat',
        socket,
        activeDocument: undefined
      });

      console.log(`[BrowserAgent] Evelyn is now responding to the browsing results`);

      // Cleanup
      await playwrightManager.closeContext(session.sessionId);

    } catch (error) {
      console.error(`[BrowserAgent] Summary error:`, error);
      session.state = 'error';
      session.error = error instanceof Error ? error.message : 'Summary failed';
      socket.emit('agent:error', {
        sessionId: session.sessionId,
        message: session.error
      });
    }
  }

  async cancelSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.log(`[BrowserAgent] Cannot cancel: session ${sessionId} not found`);
      return;
    }

    session.state = 'cancelled';
    console.log(`[BrowserAgent] Session ${sessionId} cancelled`);

    // Update activity if it exists
    if (session.activityId) {
      await this.failActivity(session.activityId, 'Session cancelled by user');
    }

    // Cleanup browser context
    try {
    await playwrightManager.closeContext(sessionId);
    } catch (error) {
      console.error(`[BrowserAgent] Error closing context during cancellation:`, error);
    }

    // Remove from sessions map
    this.sessions.delete(sessionId);
    
    console.log(`[BrowserAgent] Session ${sessionId} cleanup complete`);
  }

  // Clean up stale sessions (called periodically)
  cleanupStaleSessions(): void {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    
    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now - session.startedAt.getTime();
      
      if (age > maxAge) {
        console.log(`[BrowserAgent] Cleaning up stale session ${sessionId} (age: ${Math.round(age / 1000)}s)`);
        this.cancelSession(sessionId).catch(console.error);
      }
    }
  }

  private emitStatus(socket: Socket, session: BrowsingSession, detail: string) {
    socket.emit('agent:status', {
      sessionId: session.sessionId,
      step: session.state,
      detail,
      pageCount: session.pages.length,
      maxPages: session.options.maxPages
    });
  }

  private async logActivity(
    tool: string,
    status: string,
    summary: string,
    metadata?: any
  ): Promise<number> {
    const activity = await db.toolActivity.create({
      data: {
        tool,
        status,
        inputSummary: summary,
        outputSummary: null,
        metadata: metadata ? JSON.stringify(metadata) : null
      }
    });
    return activity.id;
  }

  private async completeActivity(
    id: number,
    summary: string,
    metadata?: any
  ): Promise<void> {
    await db.toolActivity.update({
      where: { id },
      data: {
        status: 'done',
        outputSummary: summary,
        metadata: metadata ? JSON.stringify(metadata) : null,
        finishedAt: new Date()
      }
    });
  }

  private async failActivity(
    id: number,
    errorMessage: string
  ): Promise<void> {
    try {
      await db.toolActivity.update({
        where: { id },
        data: {
          status: 'error',
          outputSummary: errorMessage,
          finishedAt: new Date()
        }
      });
    } catch (error) {
      console.error(`[BrowserAgent] Failed to update activity ${id}:`, error);
    }
  }

  getSession(sessionId: string): BrowsingSession | undefined {
    return this.sessions.get(sessionId);
  }
  
  // Get statistics about current sessions
  getStats(): { activeCount: number; sessions: Array<{ id: string; state: string; pages: number; age: number }> } {
    const now = Date.now();
    return {
      activeCount: this.sessions.size,
      sessions: Array.from(this.sessions.values()).map(s => ({
        id: s.sessionId,
        state: s.state,
        pages: s.pages.length,
        age: Math.round((now - s.startedAt.getTime()) / 1000)
      }))
    };
  }
}

export const browserAgent = new BrowserAgent();

// Start periodic cleanup (every 5 minutes)
setInterval(() => {
  browserAgent.cleanupStaleSessions();
}, 5 * 60 * 1000);

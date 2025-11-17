import { chromium, Browser, BrowserContext, Page } from 'playwright';

interface PageExtraction {
  url: string;
  title: string;
  metaDescription?: string;
  canonicalUrl?: string;
  textContent: string;
  screenshotBase64?: string;
  links: Array<{ text: string; href: string }>;
  favicon?: string;
}

interface NavigateOptions {
  timeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  screenshot?: boolean;
  maxTextLength?: number;
}

class PlaywrightManager {
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();

  private isFileDownloadUrl(url: string): boolean {
    const lowerUrl = url.toLowerCase();
    
    // Common file extensions that indicate downloads
    const fileExtensions = [
      '.pdf', '.zip', '.rar', '.7z', '.tar', '.gz',
      '.exe', '.dmg', '.pkg', '.deb', '.rpm',
      '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv',
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg',
      '.iso', '.img', '.apk', '.ipa'
    ];
    
    // Check if URL ends with a file extension
    const hasFileExtension = fileExtensions.some(ext => lowerUrl.endsWith(ext));
    
    // Check for common download patterns in URLs
    const isDownloadUrl = lowerUrl.includes('/download/') || 
                         lowerUrl.includes('/downloads/') ||
                         lowerUrl.includes('?download=') ||
                         lowerUrl.includes('&download=');
    
    return hasFileExtension || isDownloadUrl;
  }

  async ensureBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      console.log('[Playwright] Launching browser...');
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      console.log('[Playwright] Browser launched');
    }
    return this.browser;
  }

  async createContext(sessionId: string): Promise<BrowserContext> {
    const browser = await this.ensureBrowser();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US'
    });
    this.contexts.set(sessionId, context);
    console.log(`[Playwright] Created context for session ${sessionId}`);
    return context;
  }

  async getContext(sessionId: string): Promise<BrowserContext | null> {
    return this.contexts.get(sessionId) || null;
  }

  async closeContext(sessionId: string): Promise<void> {
    const context = this.contexts.get(sessionId);
    if (context) {
      await context.close();
      this.contexts.delete(sessionId);
      console.log(`[Playwright] Closed context for session ${sessionId}`);
    }
  }

  async navigate(
    sessionId: string,
    url: string,
    options: NavigateOptions = {}
  ): Promise<PageExtraction> {
    const {
      timeout = 30000,
      waitUntil = 'domcontentloaded',
      screenshot = true,
      maxTextLength = 50000
    } = options;

    // Check if URL is a file download - reject before attempting navigation
    if (this.isFileDownloadUrl(url)) {
      console.log(`[Playwright] Skipping file download URL: ${url}`);
      throw new Error(`Cannot navigate to file download URL: ${url}. The browser agent only navigates to web pages.`);
    }

    let context = await this.getContext(sessionId);
    if (!context) {
      context = await this.createContext(sessionId);
    }

    let page: Page | null = null;
    
    try {
      page = await context.newPage();
      
      // Set up error handlers
      page.on('pageerror', (error) => {
        console.log(`[Playwright] Page error: ${error.message}`);
      });
      
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          console.log(`[Playwright] Console error: ${msg.text()}`);
        }
      });

      console.log(`[Playwright] Navigating to ${url}`);
      
      // Navigate with enhanced error handling
      const response = await page.goto(url, { 
        timeout, 
        waitUntil,
        // Don't fail on HTTP errors, we want to extract what we can
      }).catch(async (error) => {
        // Handle specific navigation errors
        if (error.message.includes('ERR_NAME_NOT_RESOLVED')) {
          throw new Error(`DNS resolution failed for ${url}. The domain may not exist.`);
        }
        if (error.message.includes('ERR_CONNECTION_REFUSED')) {
          throw new Error(`Connection refused to ${url}. The server may be down.`);
        }
        if (error.message.includes('ERR_CONNECTION_TIMED_OUT')) {
          throw new Error(`Connection timed out to ${url}. The server took too long to respond.`);
        }
        if (error.message.includes('ERR_SSL_PROTOCOL_ERROR') || error.message.includes('ERR_CERT_')) {
          throw new Error(`SSL/Certificate error for ${url}. The site's security certificate may be invalid.`);
        }
        if (error.message.includes('net::ERR_ABORTED')) {
          throw new Error(`Navigation aborted for ${url}. The page may have redirected too many times.`);
        }
        throw error;
      });

      // Check HTTP status
      if (response) {
        const status = response.status();
        if (status === 404) {
          throw new Error(`Page not found (404): ${url}`);
        }
        if (status === 403) {
          throw new Error(`Access forbidden (403): ${url}. The site may be blocking automated access.`);
        }
        if (status === 500 || status === 502 || status === 503) {
          throw new Error(`Server error (${status}): ${url}. The site may be experiencing issues.`);
        }
        if (status >= 400) {
          console.log(`[Playwright] HTTP ${status} for ${url}, attempting to extract content anyway...`);
        }
      }

      // Wait a bit for dynamic content to load
      await page.waitForTimeout(1000).catch(() => {});

      console.log(`[Playwright] Page loaded: ${page.url()}`);

      // Extract page metadata with better error handling
      const title = await page.title().catch(() => 'Untitled Page');
      
      const metaDescription = await page.$eval(
        'meta[name="description"]',
        (el: any) => el.content
      ).catch(() => undefined);
      
      const canonicalUrl = await page.$eval(
        'link[rel="canonical"]',
        (el: any) => el.href
      ).catch(() => undefined);

      // Extract favicon with multiple fallbacks
      let favicon: string | undefined;
      try {
        favicon = await page.$eval(
          'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]',
          (el: any) => el.href
        );
      } catch {
        try {
          const urlObj = new URL(page.url());
          favicon = `${urlObj.origin}/favicon.ico`;
        } catch {
          favicon = undefined;
        }
      }

      // Extract main text content with robust error handling
      let textContent = await page.evaluate(() => {
        try {
          const doc = (globalThis as any).document;
          
          // Remove script and style elements
          const scripts = doc.querySelectorAll('script, style, nav, header, footer, iframe, noscript');
          scripts.forEach((el: any) => el.remove());
          
          // Try to find main content area first
          const main = doc.querySelector('main, article, [role="main"], .content, #content, .post, .article');
          if (main && main.innerText && main.innerText.length > 200) {
            return main.innerText;
          }
          
          // Fallback to body
          if (doc.body && doc.body.innerText && doc.body.innerText.length > 100) {
            return doc.body.innerText;
          }
          
          // Last resort: textContent
          return doc.body?.textContent || 'No text content available';
        } catch (error) {
          return 'Error extracting text content';
        }
      }).catch(() => 'Failed to extract page content');

      // Clean up text content
      textContent = textContent.trim().replace(/\s+/g, ' ');

      // Truncate if too long
      if (textContent.length > maxTextLength) {
        textContent = textContent.slice(0, maxTextLength) + '...';
      }

      // Extract top links (excluding file downloads) with better filtering
      const links = await page.evaluate(() => {
        const anchorElements = Array.from((globalThis as any).document.querySelectorAll('a[href]'));
        
        // Common file extensions that should be excluded
        const fileExtensions = [
          '.pdf', '.zip', '.rar', '.7z', '.tar', '.gz',
          '.exe', '.dmg', '.pkg', '.deb', '.rpm',
          '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
          '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv',
          '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg',
          '.iso', '.img', '.apk', '.ipa'
        ];
        
        return anchorElements
          .slice(0, 100) // Check more links initially
          .map((a: any) => {
            const text = (a.innerText?.trim() || a.getAttribute('aria-label') || a.getAttribute('title') || '').substring(0, 200);
            return {
              text,
              href: a.href
            };
          })
          .filter((link) => {
            if (!link.text || !link.href) return false;
            if (link.text.length < 2) return false; // Skip very short text
            
            // Check if URL ends with a file extension
            const url = link.href.toLowerCase();
            const hasFileExtension = fileExtensions.some(ext => url.endsWith(ext));
            
            // Also check for common download patterns in URLs
            const isDownloadUrl = url.includes('/download/') || 
                                 url.includes('/downloads/') ||
                                 url.includes('?download=') ||
                                 url.includes('&download=');
            
            // Skip javascript: links
            if (url.startsWith('javascript:')) return false;
            
            // Skip anchor-only links
            if (url === '#' || url.endsWith('#')) return false;
            
            return !hasFileExtension && !isDownloadUrl;
          })
          .slice(0, 50); // Return top 50 after filtering
      }).catch(() => [] as Array<{ text: string; href: string }>);

      // Take screenshot if requested
      let screenshotBase64: string | undefined;
      if (screenshot) {
        try {
          const screenshotBuffer = await page.screenshot({
            type: 'jpeg',
            quality: 70,
            fullPage: false,
            timeout: 10000
          });
          screenshotBase64 = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;
          console.log(`[Playwright] Screenshot captured (${(screenshotBuffer.length / 1024).toFixed(1)} KB)`);
        } catch (error) {
          console.log(`[Playwright] Screenshot failed, continuing without it:`, error);
          // Don't fail the whole extraction if screenshot fails
        }
      }

      const finalUrl = page.url();
      await page.close();

      return {
        url: finalUrl,
        title,
        metaDescription,
        canonicalUrl,
        textContent,
        screenshotBase64,
        links,
        favicon
      };
    } catch (error) {
      if (page) {
        await page.close().catch(() => {});
      }
      console.error(`[Playwright] Navigation error for ${url}:`, error);
      throw error;
    }
  }

  async closeBrowser(): Promise<void> {
    // Close all contexts
    for (const [sessionId] of this.contexts) {
      await this.closeContext(sessionId);
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('[Playwright] Browser closed');
    }
  }
}

export const playwrightManager = new PlaywrightManager();

// Cleanup on process exit
process.on('exit', () => {
  if (playwrightManager) {
    playwrightManager.closeBrowser().catch(console.error);
  }
});

process.on('SIGINT', async () => {
  await playwrightManager.closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await playwrightManager.closeBrowser();
  process.exit(0);
});


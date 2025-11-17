import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach(key => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 5 * 60 * 1000);

/**
 * Simple in-memory rate limiter
 * @param windowMs Time window in milliseconds
 * @param max Maximum number of requests per window
 */
export function createRateLimiter(windowMs: number, max: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Get client identifier (IP address or API key if authenticated)
    const identifier = (req as any).authenticated 
      ? req.headers['x-api-key'] || req.headers.authorization 
      : req.ip || req.connection.remoteAddress || 'unknown';
    
    const key = `${identifier}`;
    const now = Date.now();
    
    // Initialize or get existing rate limit data
    if (!store[key] || store[key].resetTime < now) {
      store[key] = {
        count: 0,
        resetTime: now + windowMs
      };
    }
    
    store[key].count++;
    
    // Set rate limit headers
    const remaining = Math.max(0, max - store[key].count);
    const resetTime = Math.ceil(store[key].resetTime / 1000);
    
    res.setHeader('X-RateLimit-Limit', max.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', resetTime.toString());
    
    if (store[key].count > max) {
      const retryAfter = Math.ceil((store[key].resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      
      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter
      });
      return;
    }
    
    next();
  };
}

/**
 * Standard rate limiters for different endpoint types
 */
export const rateLimiters = {
  // General API endpoints: 100 requests per 15 minutes
  api: createRateLimiter(15 * 60 * 1000, 100),
  
  // Expensive operations (AI, analysis): 20 requests per 15 minutes
  expensive: createRateLimiter(15 * 60 * 1000, 20),
  
  // Mutations (create, update, delete): 50 requests per 15 minutes
  mutations: createRateLimiter(15 * 60 * 1000, 50),
  
  // Search operations: 60 requests per minute
  search: createRateLimiter(60 * 1000, 60),
  
  // Health check: 10 requests per minute
  health: createRateLimiter(60 * 1000, 10)
};

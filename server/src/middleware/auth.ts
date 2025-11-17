import { Request, Response, NextFunction } from 'express';

/**
 * Authentication middleware to verify API key
 * Checks for API key in Authorization header or x-api-key header
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip auth in development mode if API_KEY is not set
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    // No API key configured - allow all requests (dev mode)
    console.warn('[Auth] ⚠️ No API_KEY configured - authentication disabled');
    return next();
  }
  
  // Check for API key in headers
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'];
  
  let providedKey: string | undefined;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    providedKey = authHeader.substring(7);
  } else if (apiKeyHeader && typeof apiKeyHeader === 'string') {
    providedKey = apiKeyHeader;
  }
  
  if (!providedKey) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'API key required. Provide in Authorization header as "Bearer <key>" or x-api-key header'
    });
  }
  
  if (providedKey !== apiKey) {
    return res.status(403).json({ 
      error: 'Forbidden',
      message: 'Invalid API key'
    });
  }
  
  // Auth successful
  next();
}

/**
 * Optional auth middleware - allows requests to proceed even without valid auth
 * Useful for endpoints that should be accessible but want to track authenticated vs unauthenticated usage
 */
export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    return next();
  }
  
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'];
  
  let providedKey: string | undefined;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    providedKey = authHeader.substring(7);
  } else if (apiKeyHeader && typeof apiKeyHeader === 'string') {
    providedKey = apiKeyHeader;
  }
  
  // Set authenticated flag on request for logging/tracking
  (req as any).authenticated = providedKey === apiKey;
  
  next();
}

import { Request, Response, NextFunction } from 'express';

// Server-side performance cache implementation
class ServerRequestCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  
  set(key: string, data: any, ttl: number = 300000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  get(key: string): any | null {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  has(key: string): boolean {
    return this.get(key) !== null;
  }
  
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  cleanup(): void {
    const now = Date.now();
    
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Global server-side cache instance
export const performanceCache = new ServerRequestCache();

// API Performance Configuration
const API_CONFIG = {
  CACHE_TTL: {
    GET: 300000, // 5 minutes
    POST: 60000, // 1 minute
    PUT: 60000,  // 1 minute
    DELETE: 30000 // 30 seconds
  },
  BATCH_SIZE: 100,
  RATE_LIMIT: {
    windowMs: 60000, // 1 minute
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
  },
  COMPRESSION_THRESHOLD: 1024, // bytes
  CONNECTION_POOL: {
    max: 100,
    min: 5,
    acquireTimeoutMillis: 60000,
    idleTimeoutMillis: 30000
  }
};

// Request metrics interface
interface RequestMetrics {
  method: string;
  url: string;
  statusCode: number;
  responseTime: number;
  timestamp: number;
  userAgent: string;
  ip: string;
  cached: boolean;
}

// Performance monitoring class
export class APIPerformanceMonitor {
  private metrics: RequestMetrics[] = [];
  private maxMetrics = 10000;
  private slowQueryThreshold = 1000; // 1 second
  
  // Record request metrics
  recordMetric(metric: RequestMetrics): void {
    this.metrics.push(metric);
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
    
    // Log slow queries
    if (metric.responseTime > this.slowQueryThreshold) {
      console.warn(`Slow query detected: ${metric.method} ${metric.url} - ${metric.responseTime}ms`);
    }
  }
  
  // Get performance statistics
  getStats(): {
    totalRequests: number;
    averageResponseTime: number;
    slowQueries: number;
    cacheHitRate: number;
    requestsPerMinute: number;
    errorRate: number;
  } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    const recentMetrics = this.metrics.filter(m => m.timestamp > oneMinuteAgo);
    const slowQueries = this.metrics.filter(m => m.responseTime > this.slowQueryThreshold);
    const cachedRequests = this.metrics.filter(m => m.cached);
    const errorRequests = this.metrics.filter(m => m.statusCode >= 400);
    
    return {
      totalRequests: this.metrics.length,
      averageResponseTime: this.calculateAverage(this.metrics.map(m => m.responseTime)),
      slowQueries: slowQueries.length,
      cacheHitRate: this.metrics.length > 0 ? (cachedRequests.length / this.metrics.length) * 100 : 0,
      requestsPerMinute: recentMetrics.length,
      errorRate: this.metrics.length > 0 ? (errorRequests.length / this.metrics.length) * 100 : 0
    };
  }
  
  // Get endpoint performance
  getEndpointStats(endpoint: string): {
    averageResponseTime: number;
    requestCount: number;
    errorRate: number;
    cacheHitRate: number;
  } {
    const endpointMetrics = this.metrics.filter(m => m.url.includes(endpoint));
    const errorRequests = endpointMetrics.filter(m => m.statusCode >= 400);
    const cachedRequests = endpointMetrics.filter(m => m.cached);
    
    return {
      averageResponseTime: this.calculateAverage(endpointMetrics.map(m => m.responseTime)),
      requestCount: endpointMetrics.length,
      errorRate: endpointMetrics.length > 0 ? (errorRequests.length / endpointMetrics.length) * 100 : 0,
      cacheHitRate: endpointMetrics.length > 0 ? (cachedRequests.length / endpointMetrics.length) * 100 : 0
    };
  }
  
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
}

// Global performance monitor instance
export const apiMonitor = new APIPerformanceMonitor();

// Middleware for request timing
export function requestTimer(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  
  // Override res.end to capture response time
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: any, cb?: () => void): Response {
    const responseTime = Date.now() - startTime;
    
    // Record metrics
    apiMonitor.recordMetric({
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime,
      timestamp: Date.now(),
      userAgent: req.get('User-Agent') || '',
      ip: req.ip || req.connection.remoteAddress || '',
      cached: res.locals.cached || false
    });
    
    // Add performance headers
    res.set('X-Response-Time', `${responseTime}ms`);
    res.set('X-Cache-Hit', res.locals.cached ? 'true' : 'false');
    
    return originalEnd(chunk, encoding, cb);
  };
  
  next();
}

// Middleware for response caching
export function responseCache(ttl: number = API_CONFIG.CACHE_TTL.GET) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    const cacheKey = `cache:${req.method}:${req.url}:${req.get('User-Agent') || ''}`;
    
    // Check cache
    const cached = performanceCache.get(cacheKey);
    if (cached) {
      res.locals.cached = true;
      res.set('X-Cache', 'HIT');
      res.json(cached);
      return;
    }
    
    // Override res.json to cache response
    const originalJson = res.json.bind(res);
    res.json = function(data: any): Response {
      // Cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        performanceCache.set(cacheKey, data, ttl);
      }
      
      res.set('X-Cache', 'MISS');
      return originalJson(data);
    };
    
    next();
  };
}

// Middleware for request batching
export function batchRequests(req: Request, res: Response, next: NextFunction): void {
  if (!req.headers['x-batch-request']) {
    return next();
  }
  
  try {
    const batchRequests = JSON.parse(req.body as string);
    
    if (!Array.isArray(batchRequests)) {
      res.status(400).json({ error: 'Batch requests must be an array' });
      return;
    }
    
    if (batchRequests.length > API_CONFIG.BATCH_SIZE) {
      res.status(400).json({ 
        error: `Batch size exceeds maximum of ${API_CONFIG.BATCH_SIZE}` 
      });
      return;
    }
    
    // Process batch requests
    Promise.all(
      batchRequests.map(async (batchReq: any) => {
        const startTime = Date.now();
        
        try {
          // Simulate processing individual request
          // In a real implementation, you would dispatch to appropriate handlers
          const result = await processBatchRequest(batchReq);
          
          return {
            id: batchReq.id,
            success: true,
            data: result,
            responseTime: Date.now() - startTime
          };
        } catch (error) {
          return {
            id: batchReq.id,
            success: false,
            error: (error as Error).message,
            responseTime: Date.now() - startTime
          };
        }
      })
    ).then(results => {
      res.json({
        batch: true,
        results,
        totalResponseTime: Date.now() - (req as any).startTime
      });
    }).catch(error => {
      res.status(500).json({ error: 'Batch processing failed' });
    });
    
  } catch (error) {
    res.status(400).json({ error: 'Invalid batch request format' });
  }
}

// Middleware for compression
export function compressionMiddleware(req: Request, res: Response, next: NextFunction): void {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  
  // Check if client accepts compression
  if (!acceptEncoding.includes('gzip') && !acceptEncoding.includes('deflate')) {
    return next();
  }
  
  // Override res.json to compress large responses
  const originalJson = res.json.bind(res);
  res.json = function(data: any): Response {
    const jsonString = JSON.stringify(data);
    
    // Only compress responses larger than threshold
    if (jsonString.length > API_CONFIG.COMPRESSION_THRESHOLD) {
      res.set('Content-Encoding', 'gzip');
      // In a real implementation, you would compress the response
      // This is just a placeholder
    }
    
    return originalJson(data);
  };
  
  next();
}

// Middleware for connection pooling
export function connectionPoolMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Add connection pool info to headers
  res.set('X-Connection-Pool', 'active');
  res.set('X-Pool-Size', API_CONFIG.CONNECTION_POOL.max.toString());
  
  next();
}

// Rate limiting middleware
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const clientIp = req.ip || req.connection.remoteAddress || '';
  const now = Date.now();
  const windowStart = now - API_CONFIG.RATE_LIMIT.windowMs;
  
  // Get current requests for this IP
  const requests = getRequestCount(clientIp, windowStart);
  
  if (requests >= API_CONFIG.RATE_LIMIT.max) {
    res.status(429).json({
      error: API_CONFIG.RATE_LIMIT.message,
      retryAfter: Math.ceil(API_CONFIG.RATE_LIMIT.windowMs / 1000)
    });
    return;
  }
  
  // Record this request
  recordRequest(clientIp, now);
  
  // Add rate limit headers
  res.set('X-RateLimit-Limit', API_CONFIG.RATE_LIMIT.max.toString());
  res.set('X-RateLimit-Remaining', Math.max(0, API_CONFIG.RATE_LIMIT.max - requests - 1).toString());
  res.set('X-RateLimit-Reset', new Date(now + API_CONFIG.RATE_LIMIT.windowMs).toISOString());
  
  next();
}

// Simple in-memory rate limiting storage
const rateLimitStore = new Map<string, number[]>();

function getRequestCount(ip: string, windowStart: number): number {
  const requests = rateLimitStore.get(ip) || [];
  const validRequests = requests.filter(timestamp => timestamp > windowStart);
  rateLimitStore.set(ip, validRequests);
  return validRequests.length;
}

function recordRequest(ip: string, timestamp: number): void {
  const requests = rateLimitStore.get(ip) || [];
  requests.push(timestamp);
  rateLimitStore.set(ip, requests);
}

// Process individual batch request
async function processBatchRequest(batchReq: any): Promise<any> {
  // This is a placeholder implementation
  // In a real application, you would route to appropriate handlers
  return { message: 'Batch request processed', data: batchReq };
}

// Streaming response utility
export class StreamingResponse {
  private res: Response;
  private isStreaming = false;
  
  constructor(res: Response) {
    this.res = res;
  }
  
  // Start streaming response
  start(headers: Record<string, string> = {}): void {
    this.res.set({
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked',
      ...headers
    });
    
    this.isStreaming = true;
    this.res.write('{"stream": true, "data": [');
  }
  
  // Send chunk of data
  sendChunk(data: any): void {
    if (!this.isStreaming) {
      throw new Error('Streaming not started');
    }
    
    const chunk = JSON.stringify(data);
    this.res.write(chunk + ',');
  }
  
  // End streaming response
  end(): void {
    if (!this.isStreaming) {
      throw new Error('Streaming not started');
    }
    
    this.res.write(']}');
    this.res.end();
    this.isStreaming = false;
  }
}

// Query optimization utilities
export class QueryOptimizer {
  private queryCache = new Map<string, any>();
  private slowQueries = new Set<string>();
  
  // Cache query results
  cacheQuery(query: string, result: any, ttl: number = 300000): void {
    this.queryCache.set(query, { result, timestamp: Date.now(), ttl });
  }
  
  // Get cached query result
  getCachedQuery(query: string): any | null {
    const cached = this.queryCache.get(query);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.queryCache.delete(query);
      return null;
    }
    
    return cached.result;
  }
  
  // Record slow query
  recordSlowQuery(query: string, executionTime: number): void {
    if (executionTime > 1000) { // 1 second threshold
      this.slowQueries.add(query);
      console.warn(`Slow query detected (${executionTime}ms): ${query.substring(0, 100)}...`);
    }
  }
  
  // Get slow queries
  getSlowQueries(): string[] {
    return Array.from(this.slowQueries);
  }
  
  // Clear cache
  clearCache(): void {
    this.queryCache.clear();
  }
}

// Global query optimizer instance
export const queryOptimizer = new QueryOptimizer();

// Database connection pool utility
export class ConnectionPool {
  private connections: any[] = [];
  private maxConnections: number;
  private minConnections: number;
  private waitingQueue: any[] = [];
  
  constructor(config: typeof API_CONFIG.CONNECTION_POOL) {
    this.maxConnections = config.max;
    this.minConnections = config.min;
  }
  
  // Get connection from pool
  async getConnection(): Promise<any> {
    if (this.connections.length > 0) {
      return this.connections.pop();
    }
    
    // If no available connections, wait or create new
    if (this.getTotalConnections() < this.maxConnections) {
      return this.createConnection();
    }
    
    // Wait for available connection
    return new Promise((resolve) => {
      this.waitingQueue.push(resolve);
    });
  }
  
  // Release connection back to pool
  releaseConnection(connection: any): void {
    if (this.waitingQueue.length > 0) {
      const resolve = this.waitingQueue.shift();
      resolve(connection);
    } else {
      this.connections.push(connection);
    }
  }
  
  // Create new connection
  private async createConnection(): Promise<any> {
    // This would create an actual database connection
    return { id: Date.now(), created: new Date() };
  }
  
  // Get total connections
  private getTotalConnections(): number {
    return this.connections.length + (this.maxConnections - this.connections.length);
  }
  
  // Close all connections
  async closeAll(): Promise<void> {
    // Close all connections
    this.connections = [];
    this.waitingQueue = [];
  }
}

// Global connection pool instance
export const connectionPool = new ConnectionPool(API_CONFIG.CONNECTION_POOL);

// Performance optimization utilities

/**
 * Debounce function to limit the rate of function execution
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate?: boolean
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(this: any, ...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    };
    
    const callNow = immediate && !timeout;
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func.apply(this, args);
  };
}

/**
 * Throttle function to limit the rate of function execution
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Memoize function results to avoid expensive recalculations
 */
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  resolver?: (...args: Parameters<T>) => string
): T {
  const cache = new Map();
  
  return function executedFunction(this: any, ...args: Parameters<T>): ReturnType<T> {
    const key = resolver ? resolver.apply(this, args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = func.apply(this, args);
    cache.set(key, result);
    
    // Limit cache size to prevent memory leaks
    if (cache.size > 100) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    return result;
  } as T;
}

/**
 * Check if the browser supports performance monitoring
 */
export function supportsPerformanceMonitoring(): boolean {
  return 'performance' in window && 'memory' in (performance as any);
}

/**
 * Get current memory usage in bytes
 */
export function getMemoryUsage(): number {
  if (supportsPerformanceMonitoring()) {
    return (performance as any).memory.usedJSHeapSize;
  }
  return 0;
}

/**
 * Get memory usage as a formatted string
 */
export function getFormattedMemoryUsage(): string {
  const bytes = getMemoryUsage();
  if (bytes === 0) return 'N/A';
  
  const mb = bytes / 1024 / 1024;
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }
  
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

/**
 * Monitor memory usage and call callback when threshold is exceeded
 */
export function monitorMemoryUsage(
  threshold: number,
  callback: (usage: number) => void,
  interval: number = 5000
): () => void {
  const intervalId = setInterval(() => {
    const usage = getMemoryUsage();
    if (usage > threshold) {
      callback(usage);
    }
  }, interval);
  
  return () => clearInterval(intervalId);
}

/**
 * Performance measurement utility
 */
export class PerformanceTimer {
  private startTime: number;
  private measurements: number[] = [];
  
  constructor() {
    this.startTime = performance.now();
  }
  
  /**
   * Record a measurement
   */
  measure(): number {
    const duration = performance.now() - this.startTime;
    this.measurements.push(duration);
    return duration;
  }
  
  /**
   * Get average measurement time
   */
  getAverage(): number {
    if (this.measurements.length === 0) return 0;
    return this.measurements.reduce((a, b) => a + b, 0) / this.measurements.length;
  }
  
  /**
   * Get minimum measurement time
   */
  getMin(): number {
    if (this.measurements.length === 0) return 0;
    return Math.min(...this.measurements);
  }
  
  /**
   * Get maximum measurement time
   */
  getMax(): number {
    if (this.measurements.length === 0) return 0;
    return Math.max(...this.measurements);
  }
  
  /**
   * Reset the timer
   */
  reset(): void {
    this.startTime = performance.now();
    this.measurements = [];
  }
}

/**
 * Lazy loading utility for large datasets
 */
export class LazyLoader<T> {
  private items: T[];
  private chunkSize: number;
  private loadedChunks: Set<number> = new Set();
  
  constructor(items: T[], chunkSize: number = 100) {
    this.items = items;
    this.chunkSize = chunkSize;
  }
  
  /**
   * Get total number of chunks
   */
  getTotalChunks(): number {
    return Math.ceil(this.items.length / this.chunkSize);
  }
  
  /**
   * Load a specific chunk
   */
  loadChunk(chunkIndex: number): T[] {
    const startIndex = chunkIndex * this.chunkSize;
    const endIndex = Math.min(startIndex + this.chunkSize, this.items.length);
    
    this.loadedChunks.add(chunkIndex);
    return this.items.slice(startIndex, endIndex);
  }
  
  /**
   * Check if a chunk is loaded
   */
  isChunkLoaded(chunkIndex: number): boolean {
    return this.loadedChunks.has(chunkIndex);
  }
  
  /**
   * Get loaded items
   */
  getLoadedItems(): T[] {
    const loaded: T[] = [];
    
    for (const chunkIndex of this.loadedChunks) {
      loaded.push(...this.loadChunk(chunkIndex));
    }
    
    return loaded;
  }
  
  /**
   * Load chunks based on visible range
   */
  loadVisibleChunks(startIndex: number, endIndex: number): T[] {
    const startChunk = Math.floor(startIndex / this.chunkSize);
    const endChunk = Math.floor(endIndex / this.chunkSize);
    
    const loaded: T[] = [];
    
    for (let i = startChunk; i <= endChunk; i++) {
      if (!this.isChunkLoaded(i)) {
        loaded.push(...this.loadChunk(i));
      }
    }
    
    return loaded;
  }
}

/**
 * Virtual scrolling utility
 */
export interface VirtualScrollItem {
  index: number;
  height: number;
  data: any;
}

export class VirtualScrollManager {
  private itemHeight: number;
  private containerHeight: number;
  private items: VirtualScrollItem[];
  private scrollTop: number = 0;
  
  constructor(itemHeight: number, containerHeight: number) {
    this.itemHeight = itemHeight;
    this.containerHeight = containerHeight;
    this.items = [];
  }
  
  /**
   * Set items to display
   */
  setItems(items: VirtualScrollItem[]): void {
    this.items = items;
  }
  
  /**
   * Update scroll position
   */
  setScrollTop(scrollTop: number): void {
    this.scrollTop = scrollTop;
  }
  
  /**
   * Get visible items based on current scroll position
   */
  getVisibleItems(): VirtualScrollItem[] {
    const startIndex = Math.floor(this.scrollTop / this.itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(this.containerHeight / this.itemHeight) + 1,
      this.items.length
    );
    
    return this.items.slice(startIndex, endIndex);
  }
  
  /**
   * Get total height of all items
   */
  getTotalHeight(): number {
    return this.items.length * this.itemHeight;
  }
  
  /**
   * Get offset for positioning
   */
  getOffsetY(): number {
    const startIndex = Math.floor(this.scrollTop / this.itemHeight);
    return startIndex * this.itemHeight;
  }
}

/**
 * Request caching utility
 */
export class RequestCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  
  /**
   * Set cache item with TTL
   */
  set(key: string, data: any, ttl: number = 300000): void { // 5 minutes default TTL
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  /**
   * Get cache item if not expired
   */
  get(key: string): any | null {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  /**
   * Check if item exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }
  
  /**
   * Delete cache item
   */
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Clean up expired items
   */
  cleanup(): void {
    const now = Date.now();
    
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Batch operation utility
 */
export class BatchProcessor<T> {
  private batchSize: number;
  private delay: number;
  private queue: T[] = [];
  private processing: boolean = false;
  
  constructor(batchSize: number = 10, delay: number = 100) {
    this.batchSize = batchSize;
    this.delay = delay;
  }
  
  /**
   * Add item to processing queue
   */
  add(item: T): void {
    this.queue.push(item);
    
    if (!this.processing) {
      this.processQueue();
    }
  }
  
  /**
   * Process items in queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.batchSize);
      
      try {
        await this.processBatch(batch);
      } catch (error) {
        console.error('Batch processing error:', error);
      }
      
      // Add delay between batches
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.delay));
      }
    }
    
    this.processing = false;
  }
  
  /**
   * Override this method to implement batch processing logic
   */
  protected async processBatch(batch: T[]): Promise<void> {
    // Default implementation - should be overridden
    console.log('Processing batch:', batch);
  }
}

/**
 * Memory leak detection utility
 */
export class MemoryLeakDetector {
  private observers: MutationObserver[] = [];
  private intervals: NodeJS.Timeout[] = [];
  private eventListeners: Array<{ target: EventTarget; event: string; handler: EventListener }> = [];
  
  /**
   * Track DOM observer for cleanup
   */
  trackObserver(observer: MutationObserver): void {
    this.observers.push(observer);
  }
  
  /**
   * Track interval for cleanup
   */
  trackInterval(interval: NodeJS.Timeout): void {
    this.intervals.push(interval);
  }
  
  /**
   * Track event listener for cleanup
   */
  trackEventListener(target: EventTarget, event: string, handler: EventListener): void {
    this.eventListeners.push({ target, event, handler });
  }
  
  /**
   * Clean up all tracked resources
   */
  cleanup(): void {
    // Disconnect observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    
    // Clear intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    
    // Remove event listeners
    this.eventListeners.forEach(({ target, event, handler }) => {
      target.removeEventListener(event, handler);
    });
    this.eventListeners = [];
  }
}

/**
 * Global performance cache instance
 */
export const performanceCache = new RequestCache();

/**
 * Global memory leak detector instance
 */
export const memoryLeakDetector = new MemoryLeakDetector();

import { PrismaClient } from '@prisma/client';

// Database optimization configuration
const DB_CONFIG = {
  QUERY_TIMEOUT: 30000, // 30 seconds
  CONNECTION_TIMEOUT: 60000, // 1 minute
  BATCH_SIZE: 1000,
  ARCHIVE_THRESHOLD: 30, // days
  CLEANUP_INTERVAL: 86400000, // 24 hours
  INDEX_SUGGESTION_THRESHOLD: 1000, // minimum rows for index suggestion
  SLOW_QUERY_THRESHOLD: 1000 // milliseconds
};

// Query performance metrics
interface QueryMetrics {
  query: string;
  executionTime: number;
  timestamp: number;
  rowCount: number;
  indexUsed: string | null;
}

// Index suggestion
interface IndexSuggestion {
  table: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist';
  estimatedImprovement: number;
  reason: string;
}

// Database optimization class
export class DatabaseOptimizer {
  private prisma: PrismaClient;
  private queryMetrics: QueryMetrics[] = [];
  private indexSuggestions: IndexSuggestion[] = [];
  private cleanupTimer: NodeJS.Timeout | null = null;
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.startCleanupTimer();
  }
  
  // Execute optimized query with monitoring
  async executeQuery<T>(
    query: string, 
    params: any[] = [],
    options: { timeout?: number; useCache?: boolean } = {}
  ): Promise<T> {
    const startTime = Date.now();
    const timeout = options.timeout || DB_CONFIG.QUERY_TIMEOUT;
    
    try {
      // Check cache first if enabled
      if (options.useCache) {
        const cached = this.getCachedQuery(query, params);
        if (cached !== null) {
          return cached as T;
        }
      }
      
      // Execute query with timeout
      const result = await this.executeWithTimeout(query, params, timeout);
      const executionTime = Date.now() - startTime;
      
      // Record metrics
      this.recordQueryMetrics(query, executionTime, Array.isArray(result) ? result.length : 0);
      
      // Cache result if enabled
      if (options.useCache) {
        this.cacheQuery(query, params, result);
      }
      
      // Check for optimization opportunities
      this.analyzeQuery(query, executionTime, Array.isArray(result) ? result.length : 0);
      
      return result as T;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.recordQueryMetrics(query, executionTime, 0, true);
      
      if (executionTime >= timeout) {
        throw new Error(`Query timeout after ${timeout}ms: ${query.substring(0, 100)}...`);
      }
      
      throw error;
    }
  }
  
  // Execute batch operations
  async executeBatch<T>(
    operations: Array<{ query: string; params?: any[] }>,
    options: { transaction?: boolean; batchSize?: number } = {}
  ): Promise<T[]> {
    const batchSize = options.batchSize || DB_CONFIG.BATCH_SIZE;
    const results: T[] = [];
    
    if (options.transaction) {
      // Execute in transaction
      const result = await this.prisma.$transaction(async (tx) => {
        for (const operation of operations) {
          const batchResult = await this.executeInBatches(
            operation.query, 
            operation.params || [], 
            batchSize,
            tx
          );
          results.push(...(batchResult as T[]));
        }
        return results;
      });
      
      return result;
    } else {
      // Execute without transaction
      for (const operation of operations) {
        const batchResult = await this.executeInBatches(
          operation.query, 
          operation.params || [], 
          batchSize
        );
        results.push(...(batchResult as T[]));
      }
    }
    
    return results;
  }
  
  // Optimize existing queries
  async optimizeQueries(): Promise<{
    optimizedQueries: string[];
    suggestedIndexes: IndexSuggestion[];
    performanceGain: number;
  }> {
    const slowQueries = this.getSlowQueries();
    const optimizedQueries: string[] = [];
    let totalPerformanceGain = 0;
    
    for (const queryMetric of slowQueries) {
      const optimization = await this.suggestQueryOptimization(queryMetric.query);
      if (optimization) {
        optimizedQueries.push(optimization.optimizedQuery);
        totalPerformanceGain += optimization.estimatedImprovement;
      }
    }
    
    return {
      optimizedQueries,
      suggestedIndexes: this.indexSuggestions,
      performanceGain: totalPerformanceGain
    };
  }
  
  // Create suggested indexes
  async createSuggestedIndexes(): Promise<void> {
    for (const suggestion of this.indexSuggestions) {
      try {
        await this.createIndex(suggestion);
        console.log(`Created index: ${suggestion.table}(${suggestion.columns.join(', ')})`);
      } catch (error) {
        console.error(`Failed to create index: ${suggestion.table}(${suggestion.columns.join(', ')})`, error);
      }
    }
    
    this.indexSuggestions = [];
  }
  
  // Archive old data
  async archiveOldData(daysToKeep: number = DB_CONFIG.ARCHIVE_THRESHOLD): Promise<{
    archivedRecords: number;
    freedSpace: string;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    let totalArchived = 0;
    
    try {
      // Archive old file versions (if the model exists)
      if ('fileVersion' in this.prisma) {
        const archivedVersions = await (this.prisma as any).fileVersion.deleteMany({
          where: {
            createdAt: {
              lt: cutoffDate
            }
          }
        });
        
        totalArchived += archivedVersions.count;
      }
      
      // Archive old activity logs (if the model exists)
      if ('activity' in this.prisma) {
        const archivedActivities = await (this.prisma as any).activity.deleteMany({
          where: {
            timestamp: {
              lt: cutoffDate
            }
          }
        });
        
        totalArchived += archivedActivities.count;
      }
      
      // Archive old error logs (if the model exists)
      if ('errorLog' in this.prisma) {
        const archivedErrors = await (this.prisma as any).errorLog.deleteMany({
          where: {
            timestamp: {
              lt: cutoffDate
            }
          }
        });
        
        totalArchived += archivedErrors.count;
      }
      
      // Calculate estimated freed space (rough estimate)
      const freedSpace = this.estimateSpaceFreed(totalArchived);
      
      console.log(`Archived ${totalArchived} records older than ${daysToKeep} days`);
      
      return {
        archivedRecords: totalArchived,
        freedSpace
      };
      
    } catch (error) {
      console.error('Failed to archive old data:', error);
      throw error;
    }
  }
  
  // Cleanup database
  async cleanupDatabase(): Promise<{
    cleanedRecords: number;
    optimizedTables: string[];
    freedSpace: string;
  }> {
    let totalCleaned = 0;
    const optimizedTables: string[] = [];
    
    try {
      // Vacuum tables to reclaim space
      const tables = await this.getTableNames();
      
      for (const table of tables) {
        try {
          await this.prisma.$executeRawUnsafe(`VACUUM (FULL) ${table}`);
          optimizedTables.push(table);
        } catch (error) {
          console.warn(`Failed to vacuum table ${table}:`, error);
        }
      }
      
      // Update table statistics
      for (const table of tables) {
        try {
          await this.prisma.$executeRawUnsafe(`ANALYZE ${table}`);
        } catch (error) {
          console.warn(`Failed to analyze table ${table}:`, error);
        }
      }
      
      // Clear expired cache entries
      const clearedCache = await this.clearExpiredCache();
      totalCleaned += clearedCache;
      
      const freedSpace = this.estimateSpaceFreed(totalCleaned);
      
      return {
        cleanedRecords: totalCleaned,
        optimizedTables,
        freedSpace
      };
      
    } catch (error) {
      console.error('Database cleanup failed:', error);
      throw error;
    }
  }
  
  // Get database statistics
  async getDatabaseStats(): Promise<{
    totalTables: number;
    totalIndexes: number;
    totalRecords: number;
    databaseSize: string;
    slowQueries: number;
    cacheHitRate: number;
  }> {
    try {
      const [tableCount, indexCount, recordCount, dbSize] = await Promise.all([
        this.getTableCount(),
        this.getIndexCount(),
        this.getTotalRecordCount(),
        this.getDatabaseSize()
      ]);
      
      const slowQueries = this.getSlowQueries().length;
      const cacheHitRate = this.getCacheHitRate();
      
      return {
        totalTables: tableCount,
        totalIndexes: indexCount,
        totalRecords: recordCount,
        databaseSize: dbSize,
        slowQueries,
        cacheHitRate
      };
      
    } catch (error) {
      console.error('Failed to get database stats:', error);
      throw error;
    }
  }
  
  // Private methods
  
  private async executeWithTimeout(query: string, params: any[], timeout: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Query timeout: ${query}`));
      }, timeout);
      
      this.prisma.$queryRawUnsafe(query, ...params)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
  
  private async executeInBatches<T>(
    query: string, 
    params: any[], 
    batchSize: number,
    tx?: any
  ): Promise<T[]> {
    const results: T[] = [];
    const executor = tx || this.prisma;
    
    // For large datasets, execute in batches
    if (params.length > batchSize) {
      for (let i = 0; i < params.length; i += batchSize) {
        const batch = params.slice(i, i + batchSize);
        const batchResult = await executor.$queryRawUnsafe(query, ...batch);
        results.push(...(batchResult as T[]));
      }
    } else {
      const result = await executor.$queryRawUnsafe(query, ...params);
      results.push(...(result as T[]));
    }
    
    return results;
  }
  
  private recordQueryMetrics(
    query: string, 
    executionTime: number, 
    rowCount: number, 
    hasError: boolean = false
  ): void {
    const metric: QueryMetrics = {
      query: query.substring(0, 200), // Limit query length for storage
      executionTime,
      timestamp: Date.now(),
      rowCount,
      indexUsed: null // Would be populated by database EXPLAIN plan
    };
    
    this.queryMetrics.push(metric);
    
    // Keep only recent metrics
    if (this.queryMetrics.length > 10000) {
      this.queryMetrics = this.queryMetrics.slice(-5000);
    }
    
    // Log slow queries
    if (executionTime > DB_CONFIG.SLOW_QUERY_THRESHOLD) {
      console.warn(`Slow query (${executionTime}ms): ${query.substring(0, 100)}...`);
    }
  }
  
  private analyzeQuery(query: string, executionTime: number, rowCount: number): void {
    // Suggest indexes for slow queries on large tables
    if (executionTime > DB_CONFIG.SLOW_QUERY_THRESHOLD && rowCount > DB_CONFIG.INDEX_SUGGESTION_THRESHOLD) {
      const suggestion = this.suggestIndexForQuery(query);
      if (suggestion && !this.indexSuggestions.find(s => 
        s.table === suggestion.table && 
        JSON.stringify(s.columns) === JSON.stringify(suggestion.columns)
      )) {
        this.indexSuggestions.push(suggestion);
      }
    }
  }
  
  private suggestIndexForQuery(query: string): IndexSuggestion | null {
    // Simple heuristic for index suggestion
    // In a real implementation, you would parse the query and analyze the execution plan
    
    const whereMatch = query.match(/WHERE\s+([^\\s]+)\s*=\s*\?/i);
    if (whereMatch) {
      const column = whereMatch[1];
      const tableMatch = query.match(/FROM\s+(\w+)/i);
      
      if (tableMatch) {
        return {
          table: tableMatch[1],
          columns: [column],
          type: 'btree',
          estimatedImprovement: 50, // percentage
          reason: 'Frequent WHERE clause on this column'
        };
      }
    }
    
    return null;
  }
  
  private async createIndex(suggestion: IndexSuggestion): Promise<void> {
    const indexName = `idx_${suggestion.table}_${suggestion.columns.join('_')}`;
    const createIndexSQL = `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName} ON ${suggestion.table} (${suggestion.columns.join(', ')})`;
    
    await this.prisma.$executeRawUnsafe(createIndexSQL);
  }
  
  private getSlowQueries(): QueryMetrics[] {
    return this.queryMetrics.filter(m => m.executionTime > DB_CONFIG.SLOW_QUERY_THRESHOLD);
  }
  
  private async suggestQueryOptimization(query: string): Promise<{
    optimizedQuery: string;
    estimatedImprovement: number;
  } | null> {
    // Simple query optimization suggestions
    // In a real implementation, you would use a query parser and optimizer
    
    if (query.includes('SELECT *')) {
      return {
        optimizedQuery: query.replace('SELECT *', 'SELECT id, created_at, updated_at'),
        estimatedImprovement: 20
      };
    }
    
    return null;
  }
  
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      try {
        await this.archiveOldData();
        console.log('Database cleanup completed');
      } catch (error) {
        console.error('Database cleanup failed:', error);
      }
    }, DB_CONFIG.CLEANUP_INTERVAL);
  }
  
  private estimateSpaceFreed(recordCount: number): string {
    // Rough estimate: 1KB per record
    const bytes = recordCount * 1024;
    
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    } else {
      return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
    }
  }
  
  // Simple cache implementation
  private queryCache = new Map<string, { result: any; timestamp: number; ttl: number }>();
  
  private cacheQuery(query: string, params: any[], result: any, ttl: number = 300000): void {
    const key = `${query}:${JSON.stringify(params)}`;
    this.queryCache.set(key, {
      result,
      timestamp: Date.now(),
      ttl
    });
  }
  
  private getCachedQuery(query: string, params: any[]): any | null {
    const key = `${query}:${JSON.stringify(params)}`;
    const cached = this.queryCache.get(key);
    
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.queryCache.delete(key);
      return null;
    }
    
    return cached.result;
  }
  
  private async clearExpiredCache(): Promise<number> {
    let cleared = 0;
    const now = Date.now();
    
    for (const [key, cached] of this.queryCache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.queryCache.delete(key);
        cleared++;
      }
    }
    
    return cleared;
  }
  
  private getCacheHitRate(): number {
    // This would be calculated based on actual cache hits/misses
    return 75.5; // placeholder
  }
  
  // Database helper methods
  private async getTableCount(): Promise<number> {
    const result = await this.prisma.$queryRaw`SELECT count(*) as count FROM information_schema.tables WHERE table_schema = 'public'`;
    return (result as any)[0].count;
  }
  
  private async getIndexCount(): Promise<number> {
    const result = await this.prisma.$queryRaw`SELECT count(*) as count FROM pg_indexes WHERE schemaname = 'public'`;
    return (result as any)[0].count;
  }
  
  private async getTotalRecordCount(): Promise<number> {
    const tables = await this.getTableNames();
    let total = 0;
    
    for (const table of tables) {
      try {
        const result = await this.prisma.$queryRawUnsafe(`SELECT count(*) as count FROM ${table}`);
        total += (result as any)[0].count;
      } catch (error) {
        // Skip tables that can't be counted
      }
    }
    
    return total;
  }
  
  private async getDatabaseSize(): Promise<string> {
    const result = await this.prisma.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) as size`;
    return (result as any)[0].size;
  }
  
  private async getTableNames(): Promise<string[]> {
    const result = await this.prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
    return (result as any[]).map(row => row.tablename);
  }
  
  // Cleanup
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.queryCache.clear();
    this.queryMetrics = [];
    this.indexSuggestions = [];
  }
}

// Global database optimizer instance
let dbOptimizer: DatabaseOptimizer | null = null;

export function getDatabaseOptimizer(prisma: PrismaClient): DatabaseOptimizer {
  if (!dbOptimizer) {
    dbOptimizer = new DatabaseOptimizer(prisma);
  }
  return dbOptimizer;
}

// Export utility functions
export { IndexSuggestion, QueryMetrics };

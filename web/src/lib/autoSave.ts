import { debounce, BatchProcessor } from './performance';
import React, { useState, useEffect } from 'react';

export interface AutoSaveConfig {
  delay: number;
  maxWait: number;
  batchSize: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface SaveOperation {
  id: string;
  fileId: number;
  content: string;
  timestamp: number;
  retryCount: number;
}

export class AutoSaveManager {
  private config: AutoSaveConfig;
  private pendingSaves: Map<string, SaveOperation> = new Map();
  private saveQueue: SaveOperation[] = [];
  private isProcessing = false;
  private batchProcessor: BatchProcessor<SaveOperation>;
  private debouncedSave: (operation: SaveOperation) => void;
  private saveCallbacks: Map<string, (success: boolean, error?: Error) => void> = new Map();
  private processedCount = 0;
  private totalTime = 0;
  
  constructor(config: Partial<AutoSaveConfig> = {}) {
    this.config = {
      delay: 2000,
      maxWait: 10000,
      batchSize: 5,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };
    
    this.batchProcessor = new BatchProcessor<SaveOperation>(
      this.config.batchSize,
      100
    );
    
    // Set up batch processing
    this.setupBatchProcessing();
    
    // Debounced save function
    this.debouncedSave = debounce(
      this.queueSave.bind(this),
      this.config.delay,
      false
    );
  }
  
  /**
   * Queue a save operation
   */
  async save(fileId: number, content: string): Promise<boolean> {
    const operationId = `save-${fileId}-${Date.now()}`;
    const operation: SaveOperation = {
      id: operationId,
      fileId,
      content,
      timestamp: Date.now(),
      retryCount: 0
    };
    
    return new Promise((resolve) => {
      // Store callback
      this.saveCallbacks.set(operationId, resolve);
      
      // Remove existing pending save for this file
      const existingKey = this.findExistingSaveKey(fileId);
      if (existingKey) {
        this.pendingSaves.delete(existingKey);
      }
      
      // Add new operation
      this.pendingSaves.set(`file-${fileId}`, operation);
      
      // Queue debounced save
      this.debouncedSave(operation);
      
      // Set timeout for max wait
      setTimeout(() => {
        if (this.pendingSaves.has(`file-${fileId}`)) {
          this.forceSave(fileId);
        }
      }, this.config.maxWait);
    });
  }
  
  /**
   * Force save a file immediately
   */
  async forceSave(fileId: number): Promise<boolean> {
    const key = `file-${fileId}`;
    const operation = this.pendingSaves.get(key);
    
    if (!operation) return true;
    
    this.pendingSaves.delete(key);
    this.saveQueue.push(operation);
    
    if (!this.isProcessing) {
      await this.processQueue();
    }
    
    return new Promise((resolve) => {
      this.saveCallbacks.set(operation.id, resolve);
    });
  }
  
  /**
   * Get pending save count
   */
  getPendingCount(): number {
    return this.pendingSaves.size + this.saveQueue.length;
  }
  
  /**
   * Check if file has pending save
   */
  hasPendingSave(fileId: number): boolean {
    return this.pendingSaves.has(`file-${fileId}`) || 
           this.saveQueue.some(op => op.fileId === fileId);
  }
  
  /**
   * Cancel pending save for a file
   */
  cancelSave(fileId: number): void {
    const key = `file-${fileId}`;
    const operation = this.pendingSaves.get(key);
    
    if (operation) {
      this.pendingSaves.delete(key);
      const callback = this.saveCallbacks.get(operation.id);
      if (callback) {
        this.saveCallbacks.delete(operation.id);
        callback(false);
      }
    }
    
    // Remove from queue
    this.saveQueue = this.saveQueue.filter(op => op.fileId !== fileId);
  }
  
  /**
   * Clear all pending saves
   */
  clearAll(): void {
    // Notify all pending callbacks
    for (const [key, operation] of this.pendingSaves) {
      const callback = this.saveCallbacks.get(operation.id);
      if (callback) {
        callback(false);
      }
    }
    
    for (const operation of this.saveQueue) {
      const callback = this.saveCallbacks.get(operation.id);
      if (callback) {
        callback(false);
      }
    }
    
    this.pendingSaves.clear();
    this.saveQueue = [];
    this.saveCallbacks.clear();
  }
  
  private setupBatchProcessing(): void {
    // Custom batch processing implementation
    setInterval(async () => {
      if (this.saveQueue.length > 0 && !this.isProcessing) {
        await this.processQueue();
      }
    }, 100);
  }
  
  /**
   * Get save statistics
   */
  getStats(): {
    pendingSaves: number;
    queuedSaves: number;
    totalProcessed: number;
    averageSaveTime: number;
  } {
    return {
      pendingSaves: this.pendingSaves.size,
      queuedSaves: this.saveQueue.length,
      totalProcessed: this.processedCount,
      averageSaveTime: this.processedCount > 0 ? this.totalTime / this.processedCount : 0
    };
  }
  
  private findExistingSaveKey(fileId: number): string | null {
    for (const [key, operation] of this.pendingSaves) {
      if (operation.fileId === fileId) {
        return key;
      }
    }
    return null;
  }
  
  private queueSave(operation: SaveOperation): void {
    const key = `file-${operation.fileId}`;
    const existingOperation = this.pendingSaves.get(key);
    
    if (existingOperation && existingOperation.id !== operation.id) {
      // Replace existing operation
      this.pendingSaves.set(key, operation);
    } else {
      // Add to queue
      this.pendingSaves.delete(key);
      this.saveQueue.push(operation);
    }
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  }
  
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.saveQueue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.saveQueue.length > 0) {
      const batch = this.saveQueue.splice(0, this.config.batchSize);
      
      try {
        await this.processBatch(batch);
      } catch (error) {
        console.error('Batch save error:', error);
        
        // Retry failed operations
        for (const operation of batch) {
          if (operation.retryCount < this.config.retryAttempts) {
            operation.retryCount++;
            operation.timestamp = Date.now();
            this.saveQueue.unshift(operation);
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
          } else {
            // Max retries reached, notify failure
            const callback = this.saveCallbacks.get(operation.id);
            if (callback) {
              this.saveCallbacks.delete(operation.id);
              callback(false, error as Error);
            }
          }
        }
      }
    }
    
    this.isProcessing = false;
  }
  
  private async processBatch(operations: SaveOperation[]): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Process saves in parallel within the batch
      await Promise.all(
        operations.map(operation => this.saveSingle(operation))
      );
      
      const duration = Date.now() - startTime;
      this.updateBatchStats(duration);
      
    } catch (error) {
      throw error;
    }
  }
  
  private async saveSingle(operation: SaveOperation): Promise<void> {
    try {
      // This would be replaced with actual API call
      const response = await fetch(`/api/files/${operation.fileId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: operation.content,
          timestamp: operation.timestamp
        })
      });
      
      if (!response.ok) {
        throw new Error(`Save failed: ${response.statusText}`);
      }
      
      // Notify success
      const callback = this.saveCallbacks.get(operation.id);
      if (callback) {
        this.saveCallbacks.delete(operation.id);
        callback(true);
      }
      
    } catch (error) {
      // Don't notify failure here, let the retry mechanism handle it
      throw error;
    }
  }
  
  private updateBatchStats(duration: number): void {
    // Update batch processor stats
    this.processedCount++;
    this.totalTime += duration;
  }
}

// Global auto-save manager instance
export const autoSaveManager = new AutoSaveManager();

// React hook for auto-save
export function useAutoSave(config?: Partial<AutoSaveConfig>) {
  const manager = new AutoSaveManager(config);
  
  return {
    save: manager.save.bind(manager),
    forceSave: manager.forceSave.bind(manager),
    cancelSave: manager.cancelSave.bind(manager),
    hasPendingSave: manager.hasPendingSave.bind(manager),
    getPendingCount: manager.getPendingCount.bind(manager),
    clearAll: manager.clearAll.bind(manager),
    getStats: manager.getStats.bind(manager)
  };
}

// Higher-order component for auto-save
export function withAutoSave<P extends { fileId: number; content: string; onSave?: (success: boolean) => void }>(
  Component: React.ComponentType<P>,
  config?: Partial<AutoSaveConfig>
): React.ComponentType<P> {
  return function AutoSaveComponent(props: P) {
    const { fileId, content, onSave, ...rest } = props;
    const [isSaving, setIsSaving] = React.useState(false);
    const [lastSaveTime, setLastSaveTime] = React.useState<Date | null>(null);
    const autoSave = useAutoSave(config);
    
    React.useEffect(() => {
      if (content && fileId) {
        setIsSaving(true);
        
        autoSave.save(fileId, content).then((success) => {
          setIsSaving(false);
          setLastSaveTime(new Date());
          onSave?.(success);
        });
      }
    }, [content, fileId]);
    
    return React.createElement(
      Component,
      {
        ...(rest as P),
        isSaving,
        lastSaveTime,
        forceSave: () => autoSave.forceSave(fileId)
      }
    );
  };
}

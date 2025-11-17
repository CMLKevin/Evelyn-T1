/**
 * LocalStorage Persistence Layer
 * Provides a comprehensive backup of all Evelyn data in browser storage
 */

interface StorageMetadata {
  version: string;
  lastSync: string;
  messageCount: number;
  memoryCount: number;
  searchResultCount: number;
  checksum: string;
}

interface LocalStorageData {
  metadata: StorageMetadata;
  messages: any[];
  searchResults: any[];
  personality: any;
  activities: any[];
  settings: any;
}

const STORAGE_KEY = 'evelyn_data_v1';
const METADATA_KEY = 'evelyn_metadata_v1';
const BACKUP_INTERVAL = 30000; // 30 seconds

class LocalStorageManager {
  private autoSaveTimer: NodeJS.Timeout | null = null;

  /**
   * Calculate a simple checksum for data integrity
   */
  private calculateChecksum(data: any): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Save all data to LocalStorage
   */
  saveAll(data: {
    messages: any[];
    searchResults: any[];
    personality: any;
    activities: any[];
    settings?: any;
  }): boolean {
    try {
      const storageData: LocalStorageData = {
        metadata: {
          version: '1.0',
          lastSync: new Date().toISOString(),
          messageCount: data.messages.length,
          memoryCount: 0, // We don't sync memories from frontend
          searchResultCount: data.searchResults.length,
          checksum: this.calculateChecksum(data)
        },
        messages: data.messages,
        searchResults: data.searchResults,
        personality: data.personality,
        activities: data.activities,
        settings: data.settings || {}
      };

      // Store data
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
      
      // Store metadata separately for quick access
      localStorage.setItem(METADATA_KEY, JSON.stringify(storageData.metadata));

      console.log(`[LocalStorage] Saved ${data.messages.length} messages, ${data.searchResults.length} search results`);
      return true;
    } catch (error) {
      console.error('[LocalStorage] Failed to save data:', error);
      
      // Handle quota exceeded error
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('[LocalStorage] Quota exceeded, attempting cleanup...');
        this.cleanup();
        return false;
      }
      return false;
    }
  }

  /**
   * Load all data from LocalStorage
   */
  loadAll(): LocalStorageData | null {
    try {
      const dataStr = localStorage.getItem(STORAGE_KEY);
      if (!dataStr) {
        console.log('[LocalStorage] No saved data found');
        return null;
      }

      const data = JSON.parse(dataStr) as LocalStorageData;
      
      // Verify checksum
      const expectedChecksum = this.calculateChecksum({
        messages: data.messages,
        searchResults: data.searchResults,
        personality: data.personality,
        activities: data.activities,
        settings: data.settings
      });

      if (expectedChecksum !== data.metadata.checksum) {
        console.warn('[LocalStorage] Checksum mismatch! Data may be corrupted.');
      }

      console.log(`[LocalStorage] Loaded ${data.messages.length} messages, ${data.searchResults.length} search results`);
      return data;
    } catch (error) {
      console.error('[LocalStorage] Failed to load data:', error);
      return null;
    }
  }

  /**
   * Get metadata without loading full data
   */
  getMetadata(): StorageMetadata | null {
    try {
      const metadataStr = localStorage.getItem(METADATA_KEY);
      if (!metadataStr) return null;
      return JSON.parse(metadataStr);
    } catch (error) {
      console.error('[LocalStorage] Failed to load metadata:', error);
      return null;
    }
  }

  /**
   * Clear all stored data
   */
  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(METADATA_KEY);
    console.log('[LocalStorage] Cleared all data');
  }

  /**
   * Cleanup old data to free space
   */
  private cleanup(): void {
    try {
      const data = this.loadAll();
      if (!data) return;

      // Keep only last 50 messages
      if (data.messages.length > 50) {
        data.messages = data.messages.slice(-50);
      }

      // Keep only last 20 search results
      if (data.searchResults.length > 20) {
        data.searchResults = data.searchResults.slice(-20);
      }

      // Keep only last 20 activities
      if (data.activities.length > 20) {
        data.activities = data.activities.slice(-20);
      }

      this.saveAll(data);
      console.log('[LocalStorage] Cleanup complete');
    } catch (error) {
      console.error('[LocalStorage] Cleanup failed:', error);
    }
  }

  /**
   * Start automatic backup
   */
  startAutoSave(getDataFn: () => any): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(() => {
      const data = getDataFn();
      this.saveAll(data);
    }, BACKUP_INTERVAL);

    console.log(`[LocalStorage] Auto-save started (every ${BACKUP_INTERVAL / 1000}s)`);
  }

  /**
   * Stop automatic backup
   */
  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
      console.log('[LocalStorage] Auto-save stopped');
    }
  }

  /**
   * Get storage usage info
   */
  getStorageInfo(): { used: number; total: number; percentage: number } {
    try {
      let totalSize = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalSize += localStorage[key].length + key.length;
        }
      }

      // Most browsers limit to ~5-10MB
      const estimatedTotal = 5 * 1024 * 1024; // 5MB
      return {
        used: totalSize,
        total: estimatedTotal,
        percentage: (totalSize / estimatedTotal) * 100
      };
    } catch (error) {
      return { used: 0, total: 0, percentage: 0 };
    }
  }
}

export const localStorageManager = new LocalStorageManager();


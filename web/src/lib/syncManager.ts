/**
 * Sync Manager
 * Handles conflict resolution between LocalStorage and Server database
 */

import { localStorageManager } from './localStorage';
import { useStore } from '../state/store';

interface SyncResult {
  source: 'localStorage' | 'server' | 'merged';
  messagesRestored: number;
  searchResultsRestored: number;
  conflicts: number;
  action: string;
}

class SyncManager {
  /**
   * Compare timestamps to determine which source is newer
   */
  private async getServerMetadata(): Promise<{
    lastMessageTime: string | null;
    lastSearchTime: string | null;
    messageCount: number;
    searchResultCount: number;
  }> {
    try {
      // Fetch latest message
      const messagesRes = await fetch('http://localhost:3001/api/messages?limit=1');
      const messages = messagesRes.ok ? await messagesRes.json() : [];
      
      // Fetch latest search result
      const searchRes = await fetch('http://localhost:3001/api/search-results?limit=1');
      const searches = searchRes.ok ? await searchRes.json() : [];

      // Get counts
      const messagesCountRes = await fetch('http://localhost:3001/api/messages?limit=1000');
      const allMessages = messagesCountRes.ok ? await messagesCountRes.json() : [];
      
      const searchCountRes = await fetch('http://localhost:3001/api/search-results?limit=100');
      const allSearches = searchCountRes.ok ? await searchCountRes.json() : [];

      return {
        lastMessageTime: messages.length > 0 ? messages[messages.length - 1].createdAt : null,
        lastSearchTime: searches.length > 0 ? searches[searches.length - 1].timestamp : null,
        messageCount: allMessages.length,
        searchResultCount: allSearches.length
      };
    } catch (error) {
      console.error('[Sync] Failed to get server metadata:', error);
      return {
        lastMessageTime: null,
        lastSearchTime: null,
        messageCount: 0,
        searchResultCount: 0
      };
    }
  }

  /**
   * Main sync function - compares LocalStorage and Server, resolves conflicts
   */
  async performSync(): Promise<SyncResult> {
    console.log('[Sync] Starting sync process...');

    // Load LocalStorage data
    const localData = localStorageManager.loadAll();
    const localMetadata = localStorageManager.getMetadata();

    // Get server metadata
    const serverMetadata = await this.getServerMetadata();

    // Case 1: No local data - just load from server
    if (!localData || !localMetadata) {
      console.log('[Sync] No local data found, loading from server');
      return {
        source: 'server',
        messagesRestored: serverMetadata.messageCount,
        searchResultsRestored: serverMetadata.searchResultCount,
        conflicts: 0,
        action: 'Loaded all data from server'
      };
    }

    // Case 2: No server data - restore from LocalStorage
    if (serverMetadata.messageCount === 0 && serverMetadata.searchResultCount === 0) {
      console.log('[Sync] No server data, restoring from LocalStorage');
      await this.restoreFromLocalStorage(localData);
      return {
        source: 'localStorage',
        messagesRestored: localData.messages.length,
        searchResultsRestored: localData.searchResults.length,
        conflicts: 0,
        action: 'Restored all data from LocalStorage to server'
      };
    }

    // Case 3: Both have data - compare timestamps
    const localLastSync = new Date(localMetadata.lastSync).getTime();
    const serverLastMessage = serverMetadata.lastMessageTime 
      ? new Date(serverMetadata.lastMessageTime).getTime() 
      : 0;

    console.log('[Sync] Comparing timestamps:');
    console.log(`  LocalStorage: ${new Date(localLastSync).toISOString()} (${localMetadata.messageCount} messages)`);
    console.log(`  Server: ${serverMetadata.lastMessageTime || 'none'} (${serverMetadata.messageCount} messages)`);

    // Determine which is newer
    if (localLastSync > serverLastMessage) {
      // LocalStorage is newer
      console.log('[Sync] LocalStorage is newer, syncing to server');
      await this.syncLocalToServer(localData, serverMetadata);
      return {
        source: 'localStorage',
        messagesRestored: localData.messages.length - serverMetadata.messageCount,
        searchResultsRestored: localData.searchResults.length - serverMetadata.searchResultCount,
        conflicts: 0,
        action: 'Synced newer LocalStorage data to server'
      };
    } else if (serverLastMessage > localLastSync) {
      // Server is newer
      console.log('[Sync] Server is newer, updating LocalStorage');
      return {
        source: 'server',
        messagesRestored: 0,
        searchResultsRestored: 0,
        conflicts: 0,
        action: 'Server data is newer, LocalStorage will be updated on next save'
      };
    } else {
      // Same timestamp - merge any differences
      console.log('[Sync] Timestamps match, checking for differences');
      const merged = await this.mergeData(localData, serverMetadata);
      return {
        source: 'merged',
        messagesRestored: merged.messagesAdded,
        searchResultsRestored: merged.searchesAdded,
        conflicts: merged.conflicts,
        action: 'Merged data from both sources'
      };
    }
  }

  /**
   * Restore data from LocalStorage to server
   */
  private async restoreFromLocalStorage(localData: any): Promise<void> {
    try {
      // Restore messages
      if (localData.messages && localData.messages.length > 0) {
        const response = await fetch('http://localhost:3001/api/messages/bulk-restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: localData.messages })
        });
        
        if (response.ok) {
          console.log(`[Sync] Restored ${localData.messages.length} messages to server`);
        }
      }

      // Restore search results
      if (localData.searchResults && localData.searchResults.length > 0) {
        const response = await fetch('http://localhost:3001/api/search-results/bulk-restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ searchResults: localData.searchResults })
        });
        
        if (response.ok) {
          console.log(`[Sync] Restored ${localData.searchResults.length} search results to server`);
        }
      }

      // Restore personality
      if (localData.personality) {
        await fetch('http://localhost:3001/api/personality/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(localData.personality)
        });
      }
    } catch (error) {
      console.error('[Sync] Failed to restore from LocalStorage:', error);
    }
  }

  /**
   * Sync newer LocalStorage data to server
   */
  private async syncLocalToServer(localData: any, serverMetadata: any): Promise<void> {
    try {
      // Find messages that exist in LocalStorage but not on server
      const localMessageIds = new Set(localData.messages.map((m: any) => m.id));
      
      // For simplicity, we'll restore all if there's a mismatch
      if (localData.messages.length > serverMetadata.messageCount) {
        await this.restoreFromLocalStorage(localData);
      }
    } catch (error) {
      console.error('[Sync] Failed to sync to server:', error);
    }
  }

  /**
   * Merge data from both sources
   */
  private async mergeData(localData: any, serverMetadata: any): Promise<{
    messagesAdded: number;
    searchesAdded: number;
    conflicts: number;
  }> {
    // For now, if counts match, we assume data is the same
    // In a production system, you'd do deep comparison by ID
    return {
      messagesAdded: 0,
      searchesAdded: 0,
      conflicts: 0
    };
  }

  /**
   * Export data for manual backup
   */
  exportData(): string {
    const localData = localStorageManager.loadAll();
    if (!localData) {
      return JSON.stringify({ error: 'No data to export' });
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      data: localData
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import data from manual backup
   */
  async importData(jsonStr: string): Promise<boolean> {
    try {
      const importData = JSON.parse(jsonStr);
      
      if (!importData.data) {
        throw new Error('Invalid export format');
      }

      // Restore to server
      await this.restoreFromLocalStorage(importData.data);
      
      // Save to LocalStorage
      localStorageManager.saveAll(importData.data);
      
      return true;
    } catch (error) {
      console.error('[Sync] Import failed:', error);
      return false;
    }
  }
}

export const syncManager = new SyncManager();


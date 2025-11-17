/**
 * Multi-Layer Database Backup System
 * Provides comprehensive backup and recovery capabilities
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { db } from './client.js';

const execAsync = promisify(exec);

const BACKUP_DIR = path.join(process.cwd(), 'prisma', 'backups');
const AUTO_BACKUP_DIR = path.join(BACKUP_DIR, 'auto');
const MANUAL_BACKUP_DIR = path.join(BACKUP_DIR, 'manual');
const HOURLY_BACKUP_DIR = path.join(BACKUP_DIR, 'hourly');
const DAILY_BACKUP_DIR = path.join(BACKUP_DIR, 'daily');
const WEEKLY_BACKUP_DIR = path.join(BACKUP_DIR, 'weekly');

// Retention policies (how many to keep)
const RETENTION = {
  auto: 10,            // Keep last 10 auto-backups
  hourly: 24,          // Keep last 24 hours
  daily: 7,            // Keep last 7 days
  weekly: 4,           // Keep last 4 weeks
  manual: 100,         // Keep last 100 manual backups
  'post-response': 20, // Keep last 20 post-response backups
  'pre-operation': 10  // Keep last 10 pre-operation backups
};

interface BackupMetadata {
  timestamp: string;
  filename: string;
  size: number;
  type: 'auto' | 'manual' | 'hourly' | 'daily' | 'weekly' | 'pre-operation' | 'post-response';
  checksum: string;
  dbVersion: string;
  recordCounts: {
    messages: number;
    memories: number;
    searchResults: number;
    moodStates: number;
    beliefs: number;
    goals: number;
    memoryLinks: number;
    relationships: number;
    evolutionEvents: number;
    toolActivities: number;
  };
}

class BackupManager {
  private backupTimer: NodeJS.Timeout | null = null;
  private hourlyTimer: NodeJS.Timeout | null = null;
  private dailyTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.ensureDirectories();
  }

  /**
   * Ensure all backup directories exist
   */
  private ensureDirectories(): void {
    const dirs = [
      BACKUP_DIR,
      AUTO_BACKUP_DIR,
      MANUAL_BACKUP_DIR,
      HOURLY_BACKUP_DIR,
      DAILY_BACKUP_DIR,
      WEEKLY_BACKUP_DIR
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[Backup] Created directory: ${dir}`);
      }
    }
  }

  /**
   * Calculate SHA256 checksum of a file
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    const crypto = await import('crypto');
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Get record counts from database - ALL tables
   */
  private async getRecordCounts(): Promise<BackupMetadata['recordCounts']> {
    const [
      messages,
      memories,
      searchResults,
      moodStates,
      beliefs,
      goals,
      memoryLinks,
      relationships,
      evolutionEvents,
      toolActivities
    ] = await Promise.all([
      db.message.count(),
      db.memory.count(),
      db.searchResult.count(),
      db.moodState.count(),
      db.personaBelief.count(),
      db.personaGoal.count(),
      db.memoryLink.count(),
      db.relationshipState.count(),
      db.personaEvolutionEvent.count(),
      db.toolActivity.count()
    ]);

    return {
      messages,
      memories,
      searchResults,
      moodStates,
      beliefs,
      goals,
      memoryLinks,
      relationships,
      evolutionEvents,
      toolActivities
    };
  }

  /**
   * Create a backup of the database
   */
  async createBackup(type: BackupMetadata['type'] = 'manual', label?: string): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = label 
        ? `backup-${type}-${label}-${timestamp}.db`
        : `backup-${type}-${timestamp}.db`;
      
      let targetDir: string;
      switch (type) {
        case 'hourly':
          targetDir = HOURLY_BACKUP_DIR;
          break;
        case 'daily':
          targetDir = DAILY_BACKUP_DIR;
          break;
        case 'weekly':
          targetDir = WEEKLY_BACKUP_DIR;
          break;
        case 'auto':
        case 'pre-operation':
        case 'post-response':
          targetDir = AUTO_BACKUP_DIR;
          break;
        default:
          targetDir = MANUAL_BACKUP_DIR;
      }

      const sourcePath = path.join(process.cwd(), 'prisma', 'dev.db');
      const backupPath = path.join(targetDir, filename);

      // Copy database file
      await fs.promises.copyFile(sourcePath, backupPath);

      // Get file size
      const stats = await fs.promises.stat(backupPath);
      const size = stats.size;

      // Calculate checksum
      const checksum = await this.calculateChecksum(backupPath);

      // Get record counts
      const recordCounts = await this.getRecordCounts();

      // Create metadata
      const metadata: BackupMetadata = {
        timestamp: new Date().toISOString(),
        filename,
        size,
        type,
        checksum,
        dbVersion: '1.0',
        recordCounts
      };

      // Save metadata
      const metadataPath = backupPath.replace('.db', '.json');
      await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      console.log(`[Backup] Created ${type} backup: ${filename} (${(size / 1024).toFixed(2)} KB)`);
      console.log(`[Backup] Records: ${recordCounts.messages} msgs, ${recordCounts.memories} memories, ${recordCounts.beliefs} beliefs, ${recordCounts.goals} goals`);

      // Apply retention policy
      await this.applyRetention(targetDir, type);

      return backupPath;
    } catch (error) {
      console.error('[Backup] Failed to create backup:', error);
      throw error;
    }
  }

  /**
   * Apply retention policy (delete old backups)
   */
  private async applyRetention(directory: string, type: BackupMetadata['type']): Promise<void> {
    try {
      const files = await fs.promises.readdir(directory);
      const dbFiles = files.filter(f => f.endsWith('.db')).sort().reverse();

      const retention = RETENTION[type] || 10;
      const filesToDelete = dbFiles.slice(retention);

      for (const file of filesToDelete) {
        const dbPath = path.join(directory, file);
        const metaPath = dbPath.replace('.db', '.json');

        await fs.promises.unlink(dbPath);
        if (fs.existsSync(metaPath)) {
          await fs.promises.unlink(metaPath);
        }

      }
    } catch (error) {
      console.error('[Backup] Failed to apply retention:', error);
    }
  }

  /**
   * Restore from a backup
   */
  async restoreBackup(backupPath: string): Promise<void> {
    try {
      // Create pre-restore backup
      await this.createBackup('pre-operation', 'pre-restore');

      const targetPath = path.join(process.cwd(), 'prisma', 'dev.db');

      // Verify backup integrity
      const metadataPath = backupPath.replace('.db', '.json');
      if (fs.existsSync(metadataPath)) {
        const metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf-8')) as BackupMetadata;
        const currentChecksum = await this.calculateChecksum(backupPath);

        if (currentChecksum !== metadata.checksum) {
          throw new Error('Backup file checksum mismatch! File may be corrupted.');
        }

        console.log(`[Backup] Restoring backup from ${metadata.timestamp}`);
        console.log(`[Backup] This backup contains: ${metadata.recordCounts.messages} messages, ${metadata.recordCounts.memories} memories`);
      }

      // Copy backup to main database location
      await fs.promises.copyFile(backupPath, targetPath);

      console.log(`[Backup] Successfully restored backup: ${path.basename(backupPath)}`);
    } catch (error) {
      console.error('[Backup] Failed to restore backup:', error);
      throw error;
    }
  }

  /**
   * List all available backups
   */
  async listBackups(): Promise<BackupMetadata[]> {
    const backups: BackupMetadata[] = [];

    const dirs = [
      AUTO_BACKUP_DIR,
      MANUAL_BACKUP_DIR,
      HOURLY_BACKUP_DIR,
      DAILY_BACKUP_DIR,
      WEEKLY_BACKUP_DIR
    ];

    for (const dir of dirs) {
      const files = await fs.promises.readdir(dir);
      const metaFiles = files.filter(f => f.endsWith('.json'));

      for (const metaFile of metaFiles) {
        try {
          const metaPath = path.join(dir, metaFile);
          const content = await fs.promises.readFile(metaPath, 'utf-8');
          const metadata = JSON.parse(content) as BackupMetadata;
          backups.push(metadata);
        } catch (error) {
          console.error(`[Backup] Failed to read metadata: ${metaFile}`, error);
        }
      }
    }

    return backups.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Start automatic backup system
   */
  startAutomaticBackups(): void {
    // Auto-backup every 15 minutes
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }
    this.backupTimer = setInterval(async () => {
      try {
        await this.createBackup('auto');
      } catch (error) {
        console.error('[Backup] Auto-backup failed:', error);
      }
    }, 15 * 60 * 1000); // 15 minutes

    // Hourly backup
    if (this.hourlyTimer) {
      clearInterval(this.hourlyTimer);
    }
    this.hourlyTimer = setInterval(async () => {
      try {
        await this.createBackup('hourly');
      } catch (error) {
        console.error('[Backup] Hourly backup failed:', error);
      }
    }, 60 * 60 * 1000); // 1 hour

    // Daily backup (runs at midnight)
    const scheduleDaily = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const timeUntilMidnight = tomorrow.getTime() - now.getTime();

      setTimeout(async () => {
        await this.createBackup('daily');
        
        // Check if it's Sunday (create weekly backup)
        if (new Date().getDay() === 0) {
          await this.createBackup('weekly');
        }

        // Schedule next daily backup
        scheduleDaily();
      }, timeUntilMidnight);
    };

    scheduleDaily();

    console.log('[Backup] Automatic backup system started');
    console.log('[Backup] - Auto: Every 15 minutes');
    console.log('[Backup] - Hourly: Every hour');
    console.log('[Backup] - Daily: Midnight');
    console.log('[Backup] - Weekly: Sunday midnight');
  }

  /**
   * Stop automatic backups
   */
  stopAutomaticBackups(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    }
    if (this.hourlyTimer) {
      clearInterval(this.hourlyTimer);
      this.hourlyTimer = null;
    }
    if (this.dailyTimer) {
      clearInterval(this.dailyTimer);
      this.dailyTimer = null;
    }
    console.log('[Backup] Automatic backup system stopped');
  }

  /**
   * Export database to JSON
   */
  async exportToJSON(): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `export-json-${timestamp}.json`;
      const exportPath = path.join(MANUAL_BACKUP_DIR, filename);

      const data = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        messages: await db.message.findMany(),
        memories: await db.memory.findMany(),
        searchResults: await db.searchResult.findMany(),
        moodStates: await db.moodState.findMany(),
        settings: await db.settings.findMany()
      };

      await fs.promises.writeFile(exportPath, JSON.stringify(data, null, 2));

      const stats = await fs.promises.stat(exportPath);
      console.log(`[Backup] Exported to JSON: ${filename} (${(stats.size / 1024).toFixed(2)} KB)`);

      return exportPath;
    } catch (error) {
      console.error('[Backup] JSON export failed:', error);
      throw error;
    }
  }

  /**
   * Get backup statistics
   */
  async getBackupStats(): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup: string | null;
    newestBackup: string | null;
    byType: Record<string, number>;
  }> {
    const backups = await this.listBackups();

    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
    const byType: Record<string, number> = {};

    for (const backup of backups) {
      byType[backup.type] = (byType[backup.type] || 0) + 1;
    }

    return {
      totalBackups: backups.length,
      totalSize,
      oldestBackup: backups.length > 0 ? backups[backups.length - 1].timestamp : null,
      newestBackup: backups.length > 0 ? backups[0].timestamp : null,
      byType
    };
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupPath: string): Promise<boolean> {
    try {
      const metadataPath = backupPath.replace('.db', '.json');
      
      if (!fs.existsSync(metadataPath)) {
        console.warn('[Backup] Metadata file not found');
        return false;
      }

      const metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf-8')) as BackupMetadata;
      const currentChecksum = await this.calculateChecksum(backupPath);

      if (currentChecksum !== metadata.checksum) {
        console.error('[Backup] Checksum mismatch!');
        return false;
      }

      console.log('[Backup] Backup integrity verified ✓');
      return true;
    } catch (error) {
      console.error('[Backup] Verification failed:', error);
      return false;
    }
  }

  /**
   * Create backup after response completion (optimized - no logging overhead)
   * Returns metadata for frontend notification
   */
  async createPostResponseBackup(): Promise<BackupMetadata | null> {
    try {
      const backupPath = await this.createBackup('post-response');
      
      // Read metadata to return to frontend
      const metadataPath = backupPath.replace('.db', '.json');
      const metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf-8')) as BackupMetadata;
      
      return metadata;
    } catch (error) {
      console.error('[Backup] Post-response backup failed:', error);
      return null;
    }
  }

  /**
   * Get latest backup metadata (for frontend sync)
   */
  async getLatestBackupMetadata(): Promise<BackupMetadata | null> {
    try {
      const backups = await this.listBackups();
      return backups.length > 0 ? backups[0] : null;
    } catch (error) {
      console.error('[Backup] Failed to get latest backup:', error);
      return null;
    }
  }
}

export const backupManager = new BackupManager();


/**
 * Backup Management API Endpoints
 */

import { Express } from 'express';
import { backupManager } from '../db/backup.js';

export function setupBackupRoutes(app: Express) {
  
  // Create manual backup
  app.post('/api/backup/create', async (req, res) => {
    try {
      const { label } = req.body;
      const backupPath = await backupManager.createBackup('manual', label);
      
      res.json({ 
        success: true, 
        backupPath,
        message: 'Backup created successfully'
      });
    } catch (error) {
      console.error('[API] Backup creation error:', error);
      res.status(500).json({ error: 'Failed to create backup' });
    }
  });

  // List all backups
  app.get('/api/backup/list', async (req, res) => {
    try {
      const backups = await backupManager.listBackups();
      res.json(backups);
    } catch (error) {
      console.error('[API] List backups error:', error);
      res.status(500).json({ error: 'Failed to list backups' });
    }
  });

  // Get backup statistics
  app.get('/api/backup/stats', async (req, res) => {
    try {
      const stats = await backupManager.getBackupStats();
      res.json(stats);
    } catch (error) {
      console.error('[API] Backup stats error:', error);
      res.status(500).json({ error: 'Failed to get backup stats' });
    }
  });

  // Restore from backup
  app.post('/api/backup/restore', async (req, res) => {
    try {
      const { backupPath } = req.body;
      
      if (!backupPath) {
        return res.status(400).json({ error: 'Backup path required' });
      }

      // Verify backup first
      const isValid = await backupManager.verifyBackup(backupPath);
      if (!isValid) {
        return res.status(400).json({ error: 'Backup file is corrupted or invalid' });
      }

      await backupManager.restoreBackup(backupPath);
      
      return res.json({ 
        success: true,
        message: 'Backup restored successfully. Please restart the server.'
      });
    } catch (error) {
      console.error('[API] Backup restore error:', error);
      return res.status(500).json({ error: 'Failed to restore backup' });
    }
  });

  // Verify backup integrity
  app.post('/api/backup/verify', async (req, res) => {
    try {
      const { backupPath } = req.body;
      
      if (!backupPath) {
        return res.status(400).json({ error: 'Backup path required' });
      }

      const isValid = await backupManager.verifyBackup(backupPath);
      
      return res.json({ 
        valid: isValid,
        message: isValid ? 'Backup is valid' : 'Backup is corrupted or invalid'
      });
    } catch (error) {
      console.error('[API] Backup verify error:', error);
      return res.status(500).json({ error: 'Failed to verify backup' });
    }
  });

  // Export to JSON
  app.get('/api/backup/export-json', async (req, res) => {
    try {
      const jsonPath = await backupManager.exportToJSON();
      res.json({ 
        success: true,
        exportPath: jsonPath,
        message: 'Database exported to JSON'
      });
    } catch (error) {
      console.error('[API] JSON export error:', error);
      res.status(500).json({ error: 'Failed to export to JSON' });
    }
  });

  // Start automatic backups
  app.post('/api/backup/auto-start', async (req, res) => {
    try {
      backupManager.startAutomaticBackups();
      res.json({ 
        success: true,
        message: 'Automatic backup system started'
      });
    } catch (error) {
      console.error('[API] Start auto-backup error:', error);
      res.status(500).json({ error: 'Failed to start automatic backups' });
    }
  });

  // Stop automatic backups
  app.post('/api/backup/auto-stop', async (req, res) => {
    try {
      backupManager.stopAutomaticBackups();
      res.json({ 
        success: true,
        message: 'Automatic backup system stopped'
      });
    } catch (error) {
      console.error('[API] Stop auto-backup error:', error);
      res.status(500).json({ error: 'Failed to stop automatic backups' });
    }
  });
}


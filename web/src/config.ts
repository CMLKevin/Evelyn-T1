/**
 * Centralized API configuration
 * 
 * This file provides a single source of truth for API endpoints and configuration.
 * Environment variables can be set in .env file (for Vite, prefix with VITE_)
 */

// Base API URL - defaults to localhost:3001 in development
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// WebSocket URL - defaults to localhost:3001 in development
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

// API Key for authentication (optional in development)
export const API_KEY = import.meta.env.VITE_API_KEY || '';

// API endpoints
export const API_ENDPOINTS = {
  // Health
  health: `${API_BASE_URL}/api/health`,
  
  // Messages
  messages: `${API_BASE_URL}/api/messages`,
  messageById: (id: number) => `${API_BASE_URL}/api/messages/${id}`,
  
  // Memories
  memories: `${API_BASE_URL}/api/memories`,
  memoryById: (id: number) => `${API_BASE_URL}/api/memories/${id}`,
  memoriesSearch: `${API_BASE_URL}/api/memories/search`,
  memoriesBulkDelete: `${API_BASE_URL}/api/memories/bulk-delete`,
  
  // Settings
  settings: `${API_BASE_URL}/api/settings`,
  
  // Backups
  backups: `${API_BASE_URL}/api/backups`,
  backupCreate: `${API_BASE_URL}/api/backups/create`,
  backupRestore: (filename: string) => `${API_BASE_URL}/api/backups/restore/${filename}`,
  backupDownload: (filename: string) => `${API_BASE_URL}/api/backups/download/${filename}`,
  backupDelete: (filename: string) => `${API_BASE_URL}/api/backups/${filename}`,
};

// Default fetch options with API key if available
export const getDefaultHeaders = (): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (API_KEY) {
    headers['x-api-key'] = API_KEY;
  }
  
  return headers;
};

// Helper function to create fetch options
export const createFetchOptions = (
  method: string = 'GET',
  body?: any,
  additionalHeaders?: HeadersInit
): RequestInit => {
  const options: RequestInit = {
    method,
    headers: {
      ...getDefaultHeaders(),
      ...additionalHeaders,
    },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  return options;
};

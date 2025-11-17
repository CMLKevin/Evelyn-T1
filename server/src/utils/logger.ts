import { Server } from 'socket.io';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
  source: string;
}

class Logger {
  private ring: LogEntry[] = [];
  private maxSize = 1000;
  private io: Server | null = null;
  private originalConsole: {
    log: typeof console.log;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
  };

  constructor() {
    // Save original console methods
    this.originalConsole = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    };
  }

  attachWebSocket(io: Server) {
    // Clear old logs from previous server session
    this.ring = [];
    
    this.io = io;
    this.interceptConsole();
    console.log('[Logger] WebSocket attached, console interception enabled');
    console.log('[Logger] Log buffer cleared - starting fresh session');
  }

  private interceptConsole() {
    const levels: Array<'log' | 'info' | 'warn' | 'error'> = ['log', 'info', 'warn', 'error'];
    
    levels.forEach((level) => {
      (console as any)[level] = (...args: any[]) => {
        // Call original console method first
        this.originalConsole[level](...args);
        
        // Push to ring buffer and broadcast
        this.push(level, args);
      };
    });
  }

  private push(level: 'log' | 'info' | 'warn' | 'error', args: any[]) {
    const message = args
      .map((arg) => {
        if (typeof arg === 'string') return arg;
        if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack}`;
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      })
      .join(' ');

    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      level,
      message,
      source: 'console',
    };

    // Add to ring buffer
    this.ring.push(entry);
    if (this.ring.length > this.maxSize) {
      this.ring.shift();
    }

    // Broadcast to subscribers
    if (this.io) {
      this.io.to('logs').emit('logs:line', entry);
    }
  }

  getRecent(limit: number = 200): LogEntry[] {
    return this.ring.slice(-limit);
  }

  getAll(): LogEntry[] {
    return [...this.ring];
  }

  clear() {
    this.ring = [];
  }
}

export const logger = new Logger();


import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PrismaClient } from '@prisma/client';

// Resolve server directory (parent of src)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverDir = join(__dirname, '..', '..');

// Load environment variables from server/.env
dotenv.config({ path: join(serverDir, '.env') });

// Ensure DATABASE_URL uses an absolute path for SQLite
if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('file:./')) {
  const dbPath = process.env.DATABASE_URL.replace('file:./', '');
  process.env.DATABASE_URL = `file:${join(serverDir, dbPath)}`;
}

export const db = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await db.$disconnect();
});


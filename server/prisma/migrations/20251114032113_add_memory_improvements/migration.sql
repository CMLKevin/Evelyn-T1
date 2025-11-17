-- CreateTable
CREATE TABLE "MemoryCluster" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "centroid" TEXT NOT NULL,
    "coherence" REAL NOT NULL DEFAULT 0.0,
    "importance" REAL NOT NULL DEFAULT 0.5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PendingMemory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "userMessage" TEXT NOT NULL,
    "assistantMessage" TEXT NOT NULL,
    "sourceMessageId" INTEGER NOT NULL,
    "privacy" TEXT NOT NULL DEFAULT 'public',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "thoughtGuidance" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextRetryAt" DATETIME
);

-- CreateTable
CREATE TABLE "_ClusterMemories" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_ClusterMemories_A_fkey" FOREIGN KEY ("A") REFERENCES "Memory" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ClusterMemories_B_fkey" FOREIGN KEY ("B") REFERENCES "MemoryCluster" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Memory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "importance" REAL NOT NULL,
    "embedding" TEXT NOT NULL,
    "embeddingDimension" INTEGER NOT NULL DEFAULT 3072,
    "embeddingModel" TEXT NOT NULL DEFAULT 'openai/text-embedding-3-large',
    "privacy" TEXT NOT NULL,
    "conversationTurnId" TEXT,
    "contextTags" TEXT NOT NULL DEFAULT '[]',
    "summary" TEXT,
    "accessFrequency" INTEGER NOT NULL DEFAULT 0,
    "avgRelevance" REAL NOT NULL DEFAULT 0.0,
    "isEvergreen" BOOLEAN NOT NULL DEFAULT false,
    "lastAccessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceMessageId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Memory_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "Message" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Memory" ("createdAt", "embedding", "id", "importance", "lastAccessedAt", "privacy", "sourceMessageId", "text", "type") SELECT "createdAt", "embedding", "id", "importance", "lastAccessedAt", "privacy", "sourceMessageId", "text", "type" FROM "Memory";
DROP TABLE "Memory";
ALTER TABLE "new_Memory" RENAME TO "Memory";
CREATE INDEX "Memory_importance_idx" ON "Memory"("importance");
CREATE INDEX "Memory_lastAccessedAt_idx" ON "Memory"("lastAccessedAt");
CREATE INDEX "Memory_conversationTurnId_idx" ON "Memory"("conversationTurnId");
CREATE INDEX "Memory_isEvergreen_idx" ON "Memory"("isEvergreen");
CREATE INDEX "Memory_accessFrequency_idx" ON "Memory"("accessFrequency");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "MemoryCluster_importance_idx" ON "MemoryCluster"("importance");

-- CreateIndex
CREATE INDEX "MemoryCluster_coherence_idx" ON "MemoryCluster"("coherence");

-- CreateIndex
CREATE INDEX "PendingMemory_status_nextRetryAt_idx" ON "PendingMemory"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "PendingMemory_createdAt_idx" ON "PendingMemory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "_ClusterMemories_AB_unique" ON "_ClusterMemories"("A", "B");

-- CreateIndex
CREATE INDEX "_ClusterMemories_B_index" ON "_ClusterMemories"("B");

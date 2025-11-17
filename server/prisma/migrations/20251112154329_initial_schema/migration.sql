-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "displayName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Message" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auxiliary" TEXT
);

-- CreateTable
CREATE TABLE "Memory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "importance" REAL NOT NULL,
    "embedding" TEXT NOT NULL,
    "privacy" TEXT NOT NULL,
    "lastAccessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceMessageId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Memory_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "Message" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MemoryLink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fromId" INTEGER NOT NULL,
    "toId" INTEGER NOT NULL,
    "relation" TEXT NOT NULL,
    "weight" REAL NOT NULL,
    CONSTRAINT "MemoryLink_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Memory" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MemoryLink_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Memory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MoodState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "valence" REAL NOT NULL,
    "arousal" REAL NOT NULL,
    "stance" TEXT NOT NULL,
    "decayHalfLifeMins" INTEGER NOT NULL DEFAULT 30,
    "lastUpdateAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "thoughtVerbosity" TEXT NOT NULL DEFAULT 'medium',
    "memoryPrivacyDefault" TEXT NOT NULL DEFAULT 'public',
    "dreamSchedule" TEXT,
    "enableDiagnostics" BOOLEAN NOT NULL DEFAULT true,
    "searchPreference" TEXT NOT NULL DEFAULT 'auto',
    "conversationsSinceReflection" INTEGER NOT NULL DEFAULT 0,
    "lastReflectionAt" DATETIME,
    "customSettings" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ToolActivity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tool" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "inputSummary" TEXT NOT NULL,
    "outputSummary" TEXT,
    "error" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "linkedMessageId" INTEGER
);

-- CreateTable
CREATE TABLE "SearchResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "query" TEXT NOT NULL,
    "originalQuery" TEXT,
    "answer" TEXT NOT NULL,
    "citations" TEXT NOT NULL,
    "synthesis" TEXT NOT NULL,
    "summary" TEXT,
    "model" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Job" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" TEXT,
    "result" TEXT,
    "nextRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DatabaseMetadata" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "appVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "lastMigration" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastBackup" DATETIME,
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "totalMemories" INTEGER NOT NULL DEFAULT 0,
    "customMetadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ServerLifecycle" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventType" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "systemTime" DATETIME NOT NULL,
    "uptimeSeconds" INTEGER,
    "downtimeSeconds" INTEGER,
    "metadata" TEXT
);

-- CreateTable
CREATE TABLE "ExtensionData" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "extensionId" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RelationshipState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "closeness" REAL NOT NULL DEFAULT 0.2,
    "trust" REAL NOT NULL DEFAULT 0.2,
    "flirtation" REAL NOT NULL DEFAULT 0.2,
    "boundaries" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'acquaintance',
    "lastUpdateAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PersonaBelief" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "subject" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "evidenceIds" TEXT NOT NULL,
    "lastUpdateAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PersonaGoal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "progress" REAL NOT NULL DEFAULT 0.0,
    "evidenceIds" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PersonaEvolutionEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "delta" REAL,
    "rationale" TEXT NOT NULL,
    "evidenceIds" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MoodHistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "valence" REAL NOT NULL,
    "arousal" REAL NOT NULL,
    "stance" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CodeCanvas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "codeType" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'javascript',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "userIntent" TEXT NOT NULL,
    "evelynStyle" TEXT NOT NULL DEFAULT 'personal',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastAccessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CodeFile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "canvasId" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CodeFile_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "CodeCanvas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CodeFileVersion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fileId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "changes" TEXT,
    "evelynComment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CodeFileVersion_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "CodeFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CodeSuggestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fileId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "code" TEXT,
    "lineStart" INTEGER,
    "lineEnd" INTEGER,
    "confidence" REAL NOT NULL DEFAULT 0.0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "evelynThought" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" DATETIME,
    CONSTRAINT "CodeSuggestion_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "CodeFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CodeTask" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "canvasId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "CodeTask_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "CodeCanvas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CodeSubtask" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "taskId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "code" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "dependencies" TEXT NOT NULL DEFAULT '[]',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "CodeSubtask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CodeTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CodeCollaboration" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "canvasId" INTEGER NOT NULL,
    "userMessage" TEXT NOT NULL,
    "evelynResponse" TEXT NOT NULL,
    "evelynThought" TEXT,
    "codeChanges" TEXT,
    "suggestionIds" TEXT NOT NULL DEFAULT '[]',
    "appliedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CodeCollaboration_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "CodeCanvas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CodingPreference" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "preferredLanguages" TEXT NOT NULL DEFAULT '[]',
    "preferredStyle" TEXT NOT NULL DEFAULT 'balanced',
    "commentDensity" TEXT NOT NULL DEFAULT 'medium',
    "namingStyle" TEXT NOT NULL DEFAULT 'camelCase',
    "technicalLevel" REAL NOT NULL DEFAULT 0.5,
    "customSettings" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX "Memory_importance_idx" ON "Memory"("importance");

-- CreateIndex
CREATE INDEX "Memory_lastAccessedAt_idx" ON "Memory"("lastAccessedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryLink_fromId_toId_relation_key" ON "MemoryLink"("fromId", "toId", "relation");

-- CreateIndex
CREATE INDEX "ToolActivity_createdAt_idx" ON "ToolActivity"("createdAt");

-- CreateIndex
CREATE INDEX "ToolActivity_tool_status_idx" ON "ToolActivity"("tool", "status");

-- CreateIndex
CREATE INDEX "SearchResult_createdAt_idx" ON "SearchResult"("createdAt");

-- CreateIndex
CREATE INDEX "SearchResult_model_idx" ON "SearchResult"("model");

-- CreateIndex
CREATE INDEX "Job_type_status_idx" ON "Job"("type", "status");

-- CreateIndex
CREATE INDEX "Job_nextRunAt_idx" ON "Job"("nextRunAt");

-- CreateIndex
CREATE INDEX "ServerLifecycle_eventType_timestamp_idx" ON "ServerLifecycle"("eventType", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ExtensionData_extensionId_key" ON "ExtensionData"("extensionId");

-- CreateIndex
CREATE INDEX "ExtensionData_extensionId_idx" ON "ExtensionData"("extensionId");

-- CreateIndex
CREATE INDEX "ExtensionData_dataType_idx" ON "ExtensionData"("dataType");

-- CreateIndex
CREATE INDEX "PersonaEvolutionEvent_createdAt_idx" ON "PersonaEvolutionEvent"("createdAt");

-- CreateIndex
CREATE INDEX "PersonaEvolutionEvent_type_idx" ON "PersonaEvolutionEvent"("type");

-- CreateIndex
CREATE INDEX "MoodHistory_createdAt_idx" ON "MoodHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CodeCanvas_sessionId_key" ON "CodeCanvas"("sessionId");

-- CreateIndex
CREATE INDEX "CodeCanvas_sessionId_idx" ON "CodeCanvas"("sessionId");

-- CreateIndex
CREATE INDEX "CodeCanvas_status_idx" ON "CodeCanvas"("status");

-- CreateIndex
CREATE INDEX "CodeCanvas_lastAccessedAt_idx" ON "CodeCanvas"("lastAccessedAt");

-- CreateIndex
CREATE INDEX "CodeFile_canvasId_filename_idx" ON "CodeFile"("canvasId", "filename");

-- CreateIndex
CREATE INDEX "CodeFile_canvasId_isActive_idx" ON "CodeFile"("canvasId", "isActive");

-- CreateIndex
CREATE INDEX "CodeFileVersion_fileId_version_idx" ON "CodeFileVersion"("fileId", "version");

-- CreateIndex
CREATE INDEX "CodeSuggestion_fileId_status_idx" ON "CodeSuggestion"("fileId", "status");

-- CreateIndex
CREATE INDEX "CodeTask_canvasId_status_idx" ON "CodeTask"("canvasId", "status");

-- CreateIndex
CREATE INDEX "CodeSubtask_taskId_order_idx" ON "CodeSubtask"("taskId", "order");

-- CreateIndex
CREATE INDEX "CodeCollaboration_canvasId_createdAt_idx" ON "CodeCollaboration"("canvasId", "createdAt");

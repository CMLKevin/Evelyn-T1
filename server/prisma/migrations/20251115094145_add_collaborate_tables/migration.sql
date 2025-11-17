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
    "operationType" TEXT,
    "diffMetadata" TEXT,
    "needsApproval" BOOLEAN NOT NULL DEFAULT true,
    "approvalStatus" TEXT,
    "userFeedback" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
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

-- CreateTable
CREATE TABLE "CollaborateDocument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "language" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastAccessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CollaborateVersion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "documentId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "description" TEXT,
    "evelynNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "CollaborateVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CollaborateDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CollaborateSuggestion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "documentId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "originalText" TEXT,
    "suggestedText" TEXT,
    "lineStart" INTEGER,
    "lineEnd" INTEGER,
    "charStart" INTEGER,
    "charEnd" INTEGER,
    "confidence" REAL NOT NULL DEFAULT 0.8,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "evelynThought" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" DATETIME,
    CONSTRAINT "CollaborateSuggestion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CollaborateDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CollaborateComment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "documentId" INTEGER NOT NULL,
    "author" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "lineStart" INTEGER,
    "lineEnd" INTEGER,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CollaborateComment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CollaborateDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CollaborateEdit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "documentId" INTEGER NOT NULL,
    "author" TEXT NOT NULL,
    "editType" TEXT NOT NULL,
    "beforeText" TEXT,
    "afterText" TEXT,
    "position" TEXT NOT NULL,
    "description" TEXT,
    "shortcutType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CollaborateEdit_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CollaborateDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "thoughtVerbosity" TEXT NOT NULL DEFAULT 'medium',
    "memoryPrivacyDefault" TEXT NOT NULL DEFAULT 'public',
    "dreamSchedule" TEXT,
    "enableDiagnostics" BOOLEAN NOT NULL DEFAULT true,
    "searchPreference" TEXT NOT NULL DEFAULT 'auto',
    "includeCodebaseContext" BOOLEAN NOT NULL DEFAULT false,
    "conversationsSinceReflection" INTEGER NOT NULL DEFAULT 0,
    "lastReflectionAt" DATETIME,
    "customSettings" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("conversationsSinceReflection", "customSettings", "dreamSchedule", "enableDiagnostics", "id", "lastReflectionAt", "memoryPrivacyDefault", "searchPreference", "thoughtVerbosity", "updatedAt", "version") SELECT "conversationsSinceReflection", "customSettings", "dreamSchedule", "enableDiagnostics", "id", "lastReflectionAt", "memoryPrivacyDefault", "searchPreference", "thoughtVerbosity", "updatedAt", "version" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

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
CREATE INDEX "CodeSubtask_approvalStatus_idx" ON "CodeSubtask"("approvalStatus");

-- CreateIndex
CREATE INDEX "CodeCollaboration_canvasId_createdAt_idx" ON "CodeCollaboration"("canvasId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CollaborateDocument_sessionId_key" ON "CollaborateDocument"("sessionId");

-- CreateIndex
CREATE INDEX "CollaborateDocument_sessionId_idx" ON "CollaborateDocument"("sessionId");

-- CreateIndex
CREATE INDEX "CollaborateDocument_status_idx" ON "CollaborateDocument"("status");

-- CreateIndex
CREATE INDEX "CollaborateDocument_lastAccessedAt_idx" ON "CollaborateDocument"("lastAccessedAt");

-- CreateIndex
CREATE INDEX "CollaborateVersion_documentId_version_idx" ON "CollaborateVersion"("documentId", "version");

-- CreateIndex
CREATE INDEX "CollaborateSuggestion_documentId_status_idx" ON "CollaborateSuggestion"("documentId", "status");

-- CreateIndex
CREATE INDEX "CollaborateSuggestion_type_idx" ON "CollaborateSuggestion"("type");

-- CreateIndex
CREATE INDEX "CollaborateComment_documentId_resolved_idx" ON "CollaborateComment"("documentId", "resolved");

-- CreateIndex
CREATE INDEX "CollaborateEdit_documentId_createdAt_idx" ON "CollaborateEdit"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "CollaborateEdit_author_idx" ON "CollaborateEdit"("author");

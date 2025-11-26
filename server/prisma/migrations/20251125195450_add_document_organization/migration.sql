/*
  Warnings:

  - You are about to drop the `CodeCanvas` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CodeCollaboration` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CodeFile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CodeFileVersion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CodeSubtask` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CodeSuggestion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CodeTask` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CodingPreference` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "CodeCanvas_lastAccessedAt_idx";

-- DropIndex
DROP INDEX "CodeCanvas_status_idx";

-- DropIndex
DROP INDEX "CodeCanvas_sessionId_idx";

-- DropIndex
DROP INDEX "CodeCanvas_sessionId_key";

-- DropIndex
DROP INDEX "CodeCollaboration_canvasId_createdAt_idx";

-- DropIndex
DROP INDEX "CodeFile_canvasId_isActive_idx";

-- DropIndex
DROP INDEX "CodeFile_canvasId_filename_idx";

-- DropIndex
DROP INDEX "CodeFileVersion_fileId_version_idx";

-- DropIndex
DROP INDEX "CodeSubtask_approvalStatus_idx";

-- DropIndex
DROP INDEX "CodeSubtask_taskId_order_idx";

-- DropIndex
DROP INDEX "CodeSuggestion_fileId_status_idx";

-- DropIndex
DROP INDEX "CodeTask_canvasId_status_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CodeCanvas";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CodeCollaboration";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CodeFile";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CodeFileVersion";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CodeSubtask";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CodeSuggestion";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CodeTask";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CodingPreference";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "CollaborateFolder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "parentId" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CollaborateFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CollaborateFolder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CollaborateDocument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "language" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "folderId" INTEGER,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastAccessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CollaborateDocument_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "CollaborateFolder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CollaborateDocument" ("contentType", "createdAt", "id", "language", "lastAccessedAt", "metadata", "sessionId", "status", "title", "updatedAt") SELECT "contentType", "createdAt", "id", "language", "lastAccessedAt", "metadata", "sessionId", "status", "title", "updatedAt" FROM "CollaborateDocument";
DROP TABLE "CollaborateDocument";
ALTER TABLE "new_CollaborateDocument" RENAME TO "CollaborateDocument";
CREATE UNIQUE INDEX "CollaborateDocument_sessionId_key" ON "CollaborateDocument"("sessionId");
CREATE INDEX "CollaborateDocument_sessionId_idx" ON "CollaborateDocument"("sessionId");
CREATE INDEX "CollaborateDocument_status_idx" ON "CollaborateDocument"("status");
CREATE INDEX "CollaborateDocument_lastAccessedAt_idx" ON "CollaborateDocument"("lastAccessedAt");
CREATE INDEX "CollaborateDocument_isFavorite_idx" ON "CollaborateDocument"("isFavorite");
CREATE INDEX "CollaborateDocument_folderId_idx" ON "CollaborateDocument"("folderId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CollaborateFolder_parentId_idx" ON "CollaborateFolder"("parentId");

-- CreateIndex
CREATE INDEX "CollaborateFolder_order_idx" ON "CollaborateFolder"("order");

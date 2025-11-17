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
  - You are about to drop the column `includeCodebaseContext` on the `Settings` table. All the data in the column will be lost.

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

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CodeSubtask" (
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
INSERT INTO "new_CodeSubtask" ("code", "completedAt", "createdAt", "dependencies", "description", "diffMetadata", "error", "id", "operationType", "order", "status", "taskId", "title") SELECT "code", "completedAt", "createdAt", "dependencies", "description", "diffMetadata", "error", "id", "operationType", "order", "status", "taskId", "title" FROM "CodeSubtask";
DROP TABLE "CodeSubtask";
ALTER TABLE "new_CodeSubtask" RENAME TO "CodeSubtask";
CREATE INDEX "CodeSubtask_taskId_order_idx" ON "CodeSubtask"("taskId", "order");
CREATE INDEX "CodeSubtask_approvalStatus_idx" ON "CodeSubtask"("approvalStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

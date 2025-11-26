-- CreateTable
CREATE TABLE "CollaborateTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "language" TEXT,
    "content" TEXT NOT NULL,
    "placeholders" TEXT NOT NULL DEFAULT '[]',
    "icon" TEXT,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "CollaborateTemplate_category_idx" ON "CollaborateTemplate"("category");

-- CreateIndex
CREATE INDEX "CollaborateTemplate_isBuiltIn_idx" ON "CollaborateTemplate"("isBuiltIn");

-- CreateIndex
CREATE INDEX "CollaborateTemplate_usageCount_idx" ON "CollaborateTemplate"("usageCount");

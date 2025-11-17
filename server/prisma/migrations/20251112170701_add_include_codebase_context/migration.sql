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

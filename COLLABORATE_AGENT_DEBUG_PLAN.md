# Evelyn Collaborate Agent - Debug & Improvement Plan

## Executive Summary

After comprehensive screening of the Collaborate agent codebase, this document outlines identified issues, bugs, and improvements organized by priority and component.

## ✅ Completed Fixes (Phase 1)

| Issue | Fix Applied |
|-------|-------------|
| Prisma Schema | Ran `prisma generate` and `db push` |
| Model Configuration | Created `COLLABORATE_CONFIG` in constants |
| WS Timeout Handling | Added timeout utilities in `ws.ts` |
| Task Tracking Race | Added Map with timestamps + cleanup interval |
| Error Boundaries | Created `CollaborateErrorBoundary` component |

---

## 🔴 Critical Issues (Fix Immediately)

### 1. Prisma Schema Not Regenerated
**Location:** `server/src/routes/collaborate.ts`
**Issue:** New models (`CollaborateTemplate`, `CollaborateFolder`) added to schema but `prisma generate` not run
**Symptoms:** TypeScript errors for `prisma.collaborateTemplate`, `prisma.collaborateFolder`
**Fix:**
```bash
cd server && npx prisma generate && npx prisma db push
```

### 2. Missing `currentContent` in Store
**Location:** `web/src/components/collaborate/VersionHistory.tsx:21`
**Issue:** `currentContent` destructured from `collaborateState` but may not exist
**Code:**
```typescript
const { activeDocument, versionHistory, currentContent } = collaborateState;
```
**Fix:** Add fallback or verify store has this property

### 3. Duplicate Intent Detection Systems
**Location:** Multiple files
**Issue:** Two separate intent detection systems exist:
- `determineCollaborateIntent()` in `collaborativeAssistant.ts`
- `detectEditIntentWithFullContext()` in `agenticCodeEditor.ts`
**Impact:** Confusion, potential double-processing, wasted tokens
**Fix:** Consolidate to single intent detection flow

### 4. Hardcoded Model Names
**Location:** Throughout agent files
**Issue:** `'moonshotai/kimi-k2-0905'` hardcoded everywhere
**Impact:** Can't easily switch models, no fallback
**Fix:** Create centralized model configuration

---

## 🟠 High Priority Issues

### 5. No Timeout Handling in WebSocket Events
**Location:** `web/src/lib/ws.ts`
**Issue:** WebSocket events like `collaborate:complete` may never fire if backend errors
**Impact:** UI stuck in "sending" state forever
**Fix:** Add timeout fallbacks for critical WS events

### 6. Race Condition in Active Task Tracking
**Location:** `server/src/ws/index.ts:17`
```typescript
const activeCollaborateTasks = new Set<number>();
```
**Issue:** Simple Set doesn't handle edge cases (server restart, zombie tasks)
**Impact:** Document locked if task crashes
**Fix:** Add timestamp + cleanup mechanism

### 7. Memory Leak in Cursor Presence
**Location:** `web/src/components/collaborate/EvelynCursor.tsx`
**Issue:** Monaco decorations may not be cleaned up on unmount
**Impact:** Memory growth over time
**Fix:** Ensure all decorations are disposed in cleanup

### 8. No Error Boundaries in Collaborate Components
**Location:** `web/src/components/collaborate/*.tsx`
**Issue:** Component errors crash entire panel
**Impact:** Poor UX, lost work
**Fix:** Add React error boundaries

### 9. Unbounded Chat History in Context
**Location:** `server/src/agent/agenticCodeEditor.ts:546`
```typescript
context.recentMessages.slice(-3).forEach(msg => {
```
**Issue:** Only last 3 messages used, may miss important context
**Impact:** Evelyn forgets conversation context
**Fix:** Dynamically size based on token budget

---

## 🟡 Medium Priority Issues

### 10. No Retry Logic for LLM Calls
**Location:** `server/src/agent/agenticCodeEditor.ts`, `collaborativeAssistant.ts`
**Issue:** Single LLM call failure = entire operation fails
**Fix:** Add exponential backoff retry wrapper

### 11. Version History Not Auto-Refreshed
**Location:** `web/src/components/collaborate/VersionHistory.tsx`
**Issue:** Version list may be stale after edits
**Fix:** Subscribe to version update events

### 12. Suggestion JSON Parsing Fragile
**Location:** `server/src/agent/collaborativeAssistant.ts:110-117`
```typescript
const jsonMatch = response.match(/\[[\s\S]*\]/);
if (jsonMatch) {
  suggestions = JSON.parse(jsonMatch[0]);
}
```
**Issue:** Assumes LLM returns perfect JSON
**Fix:** Add robust JSON extraction with fallback

### 13. No Debouncing on Auto-Save
**Location:** Auto-save feature
**Issue:** Rapid typing could trigger many saves
**Fix:** Debounce save calls (already implemented, verify working)

### 14. Template Placeholders Not Validated
**Location:** `web/src/components/collaborate/TemplateModal.tsx`
**Issue:** No validation that all placeholders are filled
**Fix:** Add validation before using template

### 15. Comparison Algorithm Inefficient for Large Docs
**Location:** `server/src/agent/documentComparison.ts`
**Issue:** LCS algorithm is O(n*m) - slow for large documents
**Fix:** Add early termination or chunked comparison

---

## 🔵 Code Quality Improvements

### 16. Inconsistent Error Logging
**Issue:** Mix of `console.log`, `console.error`, `logger`
**Fix:** Standardize on logger utility

### 17. Type Safety Gaps
**Locations:**
- `(doc?.versions[0] as any)?.content` - unsafe casting
- `toolResult: any` - no type narrowing
**Fix:** Define proper interfaces

### 18. Duplicate Code in Shortcut Handlers
**Location:** `server/src/agent/collaborativeAssistant.ts:125-184`
**Issue:** Each shortcut function has similar boilerplate
**Fix:** Create generic shortcut executor

### 19. Magic Numbers
**Examples:**
- `MAX_INTENT_CONTENT = 4000`
- `MAX_ITERATIONS = 10`
- `ITERATION_TIMEOUT_MS = 90000`
**Fix:** Move to constants file with documentation

### 20. Missing JSDoc Comments
**Issue:** Complex functions lack documentation
**Fix:** Add JSDoc for public APIs

---

## 🔧 Implementation Plan

### Phase 1: Critical Fixes (Day 1)
| Task | File | Est. Time |
|------|------|-----------|
| Run Prisma generate | schema.prisma | 5 min |
| Fix currentContent reference | VersionHistory.tsx | 15 min |
| Add model config | constants/index.ts | 30 min |
| Document intent detection consolidation | - | 1 hr |

### Phase 2: High Priority (Day 2-3)
| Task | File | Est. Time |
|------|------|-----------|
| Add WS timeout handling | ws.ts | 1 hr |
| Fix task tracking race condition | ws/index.ts | 1 hr |
| Add error boundaries | CollaboratePanel.tsx | 1 hr |
| Review cursor cleanup | EvelynCursor.tsx | 30 min |
| Fix chat history sizing | agenticCodeEditor.ts | 1 hr |

### Phase 3: Medium Priority (Day 4-5)
| Task | File | Est. Time |
|------|------|-----------|
| Add LLM retry logic | providers/openrouter.ts | 2 hr |
| Improve JSON parsing | collaborativeAssistant.ts | 1 hr |
| Validate template placeholders | TemplateModal.tsx | 30 min |
| Optimize comparison algo | documentComparison.ts | 2 hr |

### Phase 4: Code Quality (Ongoing)
| Task | Est. Time |
|------|-----------|
| Standardize logging | 2 hr |
| Add types | 3 hr |
| Extract constants | 1 hr |
| Add JSDoc | 2 hr |

---

## 🧪 Testing Strategy

### Unit Tests Needed
1. `detectEditIntentWithFullContext()` - various intent scenarios
2. `diffDocuments()` - edge cases (empty, identical, large)
3. `replace_in_file` tool - SEARCH/REPLACE parsing
4. Template placeholder extraction
5. Version comparison

### Integration Tests Needed
1. Full edit flow: chat → intent → edit → save
2. WebSocket reconnection handling
3. Concurrent document editing
4. Template creation and usage

### E2E Tests Needed
1. Create document → edit via chat → save version
2. Compare two versions
3. Use template to create document
4. Merge conflicts resolution

---

## 📊 Performance Improvements

### Current Bottlenecks
1. **Intent Detection**: 2-5s for each message
2. **Agentic Edit Loop**: Up to 5 minutes for complex edits
3. **Document Comparison**: Slow for >10k line docs

### Proposed Solutions
1. Cache intent detection for similar messages
2. Parallel tool execution where possible
3. Streaming comparison results
4. Client-side diffing for small changes

---

## 🔒 Security Review

### Issues Found
1. No rate limiting on collaborate endpoints
2. Document IDs are sequential (enumerable)
3. No input sanitization on template content
4. WebSocket events not authenticated

### Recommendations
1. Add rate limiting middleware
2. Use UUIDs for document IDs
3. Sanitize HTML in templates
4. Verify socket auth on sensitive events

---

## Next Steps

1. **Immediate**: Run `prisma generate` to fix type errors
2. **Today**: Fix critical issues #1-4
3. **This Week**: Complete Phase 1 & 2
4. **Next Sprint**: Phase 3 & 4

---

*Generated: ${new Date().toISOString()}*
*Last Updated: ${new Date().toISOString()}*

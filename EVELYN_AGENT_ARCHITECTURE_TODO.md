# Evelyn Agent Architecture Improvement TODO

> **Comprehensive review of the agent subsystem with prioritized improvements**
> **Created:** November 2025
> **Last Updated:** November 26, 2025
> **Scope:** `/server/src/agent/` and related files

---

## ✅ IMPLEMENTATION PROGRESS

### Completed Items (Phase 1 & 2)

| Item | Status | Files Created |
|------|--------|---------------|
| Centralized Prompts | ✅ Done | `/server/src/prompts/index.ts` |
| Constants & Types | ✅ Done | `/server/src/constants/index.ts` |
| Engine Interfaces | ✅ Done | `/server/src/agent/interfaces/index.ts` |
| Error Handling | ✅ Done | `/server/src/agent/errors/index.ts` |
| SearchPipeline | ✅ Done | `/server/src/agent/pipeline/SearchPipeline.ts` |
| MemoryPipeline | ✅ Done | `/server/src/agent/pipeline/MemoryPipeline.ts` |
| PostProcessPipeline | ✅ Done | `/server/src/agent/pipeline/PostProcessPipeline.ts` |
| **ResponsePipeline** | ✅ Done | `/server/src/agent/pipeline/ResponsePipeline.ts` |
| **AgenticEditPipeline** | ✅ Done | `/server/src/agent/pipeline/AgenticEditPipeline.ts` |
| **DI Container** | ✅ Done | `/server/src/agent/container.ts` |
| Orchestrator Integration | ✅ Done | Updated imports in `orchestrator.ts` |
| BrowserAgent Integration | ✅ Done | Updated imports in `browserAgent.ts` |

### New Architecture Overview

```
/server/src/
├── prompts/
│   └── index.ts              # All system prompts centralized
├── constants/
│   └── index.ts              # Models, events, types, configs
├── agent/
│   ├── interfaces/           # Engine interfaces for DI
│   ├── errors/               # AgentError hierarchy + retry
│   ├── pipeline/             # Extracted pipeline modules
│   │   ├── SearchPipeline.ts
│   │   ├── MemoryPipeline.ts
│   │   ├── PostProcessPipeline.ts
│   │   ├── ResponsePipeline.ts
│   │   └── AgenticEditPipeline.ts
│   └── container.ts          # Dependency injection container
```

---

## Executive Summary

The Evelyn agent is a sophisticated conversational AI with memory, personality, inner thoughts, and agentic code editing. However, the current architecture has accumulated technical debt that impacts maintainability, testability, and extensibility. This document outlines a prioritized improvement plan.

### Current Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR (God Class)                    │
│  • Message routing                                               │
│  • Search decision & execution                                   │
│  • Memory retrieval                                              │
│  • Personality fetching                                          │
│  • Agentic editing                                               │
│  • Inner thought generation                                      │
│  • Response streaming                                            │
│  • Post-processing (memory storage, mood updates)                │
└─────────────────────────────────────────────────────────────────┘
         │
         ├── Memory Engine (memory.ts)
         ├── Personality Engine (personality.ts)
         ├── Inner Thought Engine (innerThought.ts)
         ├── Agentic Code Editor (agenticCodeEditor.ts)
         ├── Collaborative Assistant (collaborativeAssistant.ts)
         ├── Browser Agent (browserAgent.ts)
         ├── Truncation Engine (truncation.ts)
         └── Error Handler (errorHandler.ts)
```

---

## Phase 1: Critical Structural Issues (High Priority)

### 1.1 Break Up the Orchestrator God Class
**File:** `orchestrator.ts` (1432+ lines)
**Severity:** 🔴 High

**Current Problems:**
- Single class handling 8+ distinct responsibilities
- 700+ lines in a single `handleMessage()` method
- Impossible to unit test individual components
- Changes in one area risk breaking others

**Proposed Solution:**
```
├── pipeline/
│   ├── MessagePipeline.ts        # Main orchestration
│   ├── SearchPipeline.ts         # Search decision + execution
│   ├── MemoryPipeline.ts         # Memory retrieval + scoring
│   ├── AgenticEditPipeline.ts    # Document editing flow
│   ├── ResponsePipeline.ts       # LLM response + streaming
│   └── PostProcessPipeline.ts    # Memory storage, mood updates
```

**Tasks:**
- [x] Extract search logic into `SearchPipeline.ts` ✅
- [x] Extract memory retrieval into `MemoryPipeline.ts` ✅
- [ ] Extract agentic editing orchestration into `AgenticEditPipeline.ts`
- [ ] Extract response building/streaming into `ResponsePipeline.ts`
- [x] Extract post-processing into `PostProcessPipeline.ts` ✅
- [x] Create `PipelineContext` interface for shared state ✅ (in interfaces/index.ts)
- [ ] Implement pipeline chaining with middleware pattern

---

### 1.2 Centralize System Prompts
**Files:** `orchestrator.ts`, `browserAgent.ts`, `agenticCodeEditor.ts`, `innerThought.ts`
**Severity:** 🔴 High

**Current Problems:**
- `EVELYN_SYSTEM_PROMPT` duplicated in multiple files
- Prompt fragments scattered across 10+ files
- No versioning or A/B testing capability
- Changes require editing multiple files

**Proposed Solution:**
```typescript
// prompts/index.ts
export const PROMPTS = {
  system: {
    core: loadPrompt('system/core.md'),
    collaborate: loadPrompt('system/collaborate.md'),
    browser: loadPrompt('system/browser.md'),
  },
  innerThought: {
    classify: loadPrompt('innerThought/classify.md'),
    generate: loadPrompt('innerThought/generate.md'),
  },
  memory: {
    classify: loadPrompt('memory/classify.md'),
    summarize: loadPrompt('memory/summarize.md'),
  },
  // ...
};
```

**Tasks:**
- [x] Create `/server/src/prompts/` directory structure ✅
- [x] Extract all prompts to centralized module ✅
- [x] Create prompt loader with variable substitution ✅ (`substituteVariables` function)
- [ ] Add prompt versioning metadata
- [x] Migrate all files to use centralized prompts ✅ (orchestrator.ts, browserAgent.ts)

---

### 1.3 Implement Dependency Injection
**All Agent Files**
**Severity:** 🟠 Medium-High

**Current Problems:**
- Singletons (`memoryEngine`, `personalityEngine`) tightly couple components
- Impossible to mock dependencies in tests
- No way to swap implementations

**Proposed Solution:**
```typescript
// container.ts
interface AgentContainer {
  memory: IMemoryEngine;
  personality: IPersonalityEngine;
  innerThought: IInnerThoughtEngine;
  llm: ILLMClient;
  db: IDatabase;
}

// Usage
class MessagePipeline {
  constructor(private container: AgentContainer) {}
}
```

**Tasks:**
- [x] Define interfaces for all engines (`IMemoryEngine`, `IPersonalityEngine`, etc.) ✅
- [ ] Create container/factory for dependency injection
- [ ] Refactor engines to implement interfaces
- [ ] Update all consumers to accept injected dependencies
- [ ] Create mock implementations for testing

---

## Phase 2: Code Quality & Maintainability (Medium Priority)

### 2.1 Standardize Error Handling
**All Agent Files**
**Severity:** 🟠 Medium

**Current Problems:**
- Inconsistent try/catch patterns
- Some errors swallowed silently
- `errorHandler.ts` exists but rarely used
- No retry logic for transient failures

**Proposed Solution:**
```typescript
// errors/AgentError.ts
export class AgentError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly retryable: boolean = false,
    public readonly context?: Record<string, any>
  ) {
    super(message);
  }
}

// With retry wrapper
async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T>;
```

**Tasks:**
- [x] Create `AgentError` hierarchy (LLMError, MemoryError, etc.) ✅
- [x] Implement retry wrapper for transient failures ✅ (`withRetry` function)
- [x] Add structured logging with correlation IDs ✅ (`generateCorrelationId`)
- [x] Create error recovery strategies per error type ✅
- [ ] Add error telemetry/monitoring hooks

---

### 2.2 Add Caching Layer for LLM Calls
**Files:** `openrouter.ts`, all engine files
**Severity:** 🟠 Medium

**Current Problems:**
- Same prompts re-sent to LLM frequently
- No caching for deterministic operations
- High latency for repeated patterns
- Unnecessary API costs

**Proposed Solution:**
```typescript
// cache/LLMCache.ts
interface LLMCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
}

// With content-addressable caching
function getCacheKey(prompt: string, model: string): string {
  return hash(`${model}:${prompt}`);
}
```

**Tasks:**
- [ ] Implement in-memory LRU cache for LLM responses
- [ ] Add Redis adapter for distributed caching (optional)
- [ ] Identify cacheable vs non-cacheable operations
- [ ] Add cache hit/miss metrics
- [ ] Implement cache invalidation strategies

---

### 2.3 Eliminate Magic Strings
**All Files**
**Severity:** 🟡 Medium-Low

**Current Problems:**
- Model names hardcoded: `'moonshotai/kimi-k2-0905'`
- Event names scattered: `'collaborate:token'`, `'subroutine:status'`
- Memory types: `'episodic'`, `'semantic'`, etc.
- No type safety for string constants

**Proposed Solution:**
```typescript
// constants/index.ts
export const MODELS = {
  CHAT: 'moonshotai/kimi-k2-0905',
  THINK: 'anthropic/claude-3-5-sonnet',
  EMBED: 'openai/text-embedding-3-small',
} as const;

export const EVENTS = {
  COLLABORATE: {
    TOKEN: 'collaborate:token',
    SPLIT: 'collaborate:split',
    COMPLETE: 'collaborate:complete',
  },
  // ...
} as const;

export const MEMORY_TYPES = ['episodic', 'semantic', 'preference', 'insight', 'plan', 'relational'] as const;
type MemoryType = typeof MEMORY_TYPES[number];
```

**Tasks:**
- [x] Create constants file with all string literals ✅
- [x] Add TypeScript enums or const assertions ✅
- [ ] Replace all magic strings with constants (partially done)
- [x] Add compile-time type checking ✅

---

## Phase 3: Performance & Scalability (Lower Priority)

### 3.1 Implement Request Rate Limiting
**File:** `openrouter.ts`
**Severity:** 🟡 Low-Medium

**Current Problems:**
- No rate limiting for LLM API calls
- Risk of API quota exhaustion
- No backoff for rate limit errors

**Tasks:**
- [ ] Add token bucket rate limiter
- [ ] Implement exponential backoff for 429 errors
- [ ] Add request queuing during rate limiting
- [ ] Add rate limit monitoring/alerting

---

### 3.2 Add Telemetry & Observability
**All Agent Files**
**Severity:** 🟡 Low-Medium

**Current Problems:**
- Console.log scattered everywhere
- No structured logging
- No performance metrics
- Difficult to debug production issues

**Proposed Solution:**
```typescript
// telemetry/index.ts
interface Telemetry {
  trace(name: string): Span;
  metric(name: string, value: number, tags?: Record<string, string>): void;
  log(level: LogLevel, message: string, context?: Record<string, any>): void;
}
```

**Tasks:**
- [ ] Implement structured logging with levels
- [ ] Add timing metrics for pipeline stages
- [ ] Create tracing spans for request flows
- [ ] Add memory/personality state metrics
- [ ] Integrate with monitoring system (optional)

---

### 3.3 Parallelize Independent Operations
**File:** `orchestrator.ts`
**Severity:** 🟢 Low

**Current Problems:**
- Sequential operations that could be parallel
- Memory retrieval waits for search to complete
- Personality fetch blocks on memory

**Tasks:**
- [ ] Identify parallelizable operations
- [ ] Use `Promise.all` for independent fetches
- [ ] Add timeout handling for parallel operations
- [ ] Measure latency improvements

---

## Phase 4: Testing & Documentation

### 4.1 Unit Test Coverage
**Severity:** 🟠 Medium

**Current State:**
- Minimal test coverage in `__tests__/`
- No mocks for external dependencies
- Integration tests missing

**Tasks:**
- [ ] Create mock implementations for all engines
- [ ] Add unit tests for memory scoring/retrieval
- [ ] Add unit tests for personality updates
- [ ] Add unit tests for inner thought generation
- [ ] Add integration tests for full pipeline
- [ ] Set up test coverage reporting

---

### 4.2 Architecture Documentation
**Severity:** 🟡 Low-Medium

**Tasks:**
- [ ] Document pipeline flow with diagrams
- [ ] Document each engine's responsibilities
- [ ] Document prompt engineering guidelines
- [ ] Create onboarding guide for contributors
- [ ] Add JSDoc comments to public APIs

---

## Specific File Improvements

### `memory.ts` (1409 lines)
- [ ] Extract embedding logic into separate module
- [ ] Create proper Memory interface
- [ ] Add memory compression/archival
- [ ] Implement memory clustering for similar memories
- [ ] Add memory importance decay recalculation

### `personality.ts` (1153 lines)
- [ ] Separate mood, relationship, beliefs, goals into sub-modules
- [ ] Add personality state snapshots for debugging
- [ ] Implement personality rollback capability
- [ ] Add belief/goal conflict detection

### `innerThought.ts` (446 lines)
- [ ] Extract context classification into own module
- [ ] Add thought caching for similar inputs
- [ ] Implement thought quality scoring
- [ ] Add fallback for LLM failures

### `agenticCodeEditor.ts` (918 lines)
- [ ] Extract tool execution into separate handlers
- [ ] Add edit preview/dry-run mode
- [ ] Implement edit undo capability
- [ ] Add edit conflict detection

### `browserAgent.ts` (1176 lines)
- [ ] Extract URL validation into utility
- [ ] Add page content caching
- [ ] Implement crawl rate limiting
- [ ] Add screenshot capture for debugging

---

## Implementation Order

### Sprint 1 (Week 1-2): Foundation
1. Centralize system prompts (1.2)
2. Create constants file (2.3)
3. Define engine interfaces (1.3)

### Sprint 2 (Week 3-4): Core Refactoring
1. Break up orchestrator - extract SearchPipeline (1.1)
2. Break up orchestrator - extract MemoryPipeline (1.1)
3. Standardize error handling (2.1)

### Sprint 3 (Week 5-6): Pipeline Completion
1. Break up orchestrator - extract remaining pipelines (1.1)
2. Implement dependency injection (1.3)
3. Add caching layer (2.2)

### Sprint 4 (Week 7-8): Quality & Testing
1. Add unit tests (4.1)
2. Add telemetry (3.2)
3. Documentation (4.2)

---

## Risk Mitigation

1. **Regression Risk**: Each refactoring step should be followed by manual testing of core flows
2. **Performance Risk**: Add benchmarks before/after major changes
3. **Breaking Changes**: Keep old interfaces as facades during transition
4. **Scope Creep**: Stick to defined phases, don't mix concerns

---

## Success Metrics

- [ ] Orchestrator reduced from 1432 to <300 lines
- [ ] All prompts in centralized location
- [ ] Unit test coverage >60%
- [ ] No singleton imports in new code
- [ ] All magic strings replaced with constants
- [ ] Pipeline latency tracking in place

---

## Notes

- **Model Selection**: Currently hardcoded to `moonshotai/kimi-k2-0905`. Consider making this configurable.
- **Temporal Engine**: Well-designed centralized clock - use as template for other refactoring
- **Memory Engine**: Solid retrieval logic but needs interface extraction
- **Browser Agent**: Good URL validation - extract to shared utility

---

*Last Updated: November 2025*

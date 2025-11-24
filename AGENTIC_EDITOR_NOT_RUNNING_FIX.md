# Agentic Editor Not Running - Root Cause & Fix

## 🐛 Problem

When asking Evelyn to edit code, the **new agentic editor was never triggered**. No progress was shown in the UI, and no actual editing happened.

## 🔍 Root Cause

There were **TWO conflicting intent detection systems** running:

### 1. OLD System (collaborativeAssistant.ts)
- Located in `server/src/agent/collaborativeAssistant.ts`
- Function: `determineCollaborateIntent()`
- Called from `ws/index.ts` line 453
- Logs: `[CollaborateAI] Intent detected: edit_document (85%)`
- Would then call `runCollaborateAgentTask()` which used the OLD editing logic
- This was **blocking** the new agentic editor from running

### 2. NEW System (agenticCodeEditor.ts)
- Located in `server/src/agent/agenticCodeEditor.ts`  
- Function: `detectEditIntentWithFullContext()`
- Should be called from `orchestrator.ts` line 321
- Logs: `[Pipeline] 🤖 Checking for agentic edit intent...`
- Uses the NEW agentic editing loop with think→tool call cycles
- **Was never reached** because old system ran first

## 📊 What Was Happening

```
User: "edit this file"
     ↓
ws/index.ts (line 453)
     ↓
determineCollaborateIntent() ← OLD SYSTEM
     ↓
Sets intentContext with shouldRunEdit = true
     ↓
runCollaborateAgentTask() ← OLD EDITING LOGIC
     ↓
✗ NEW agentic editor never reached
```

## ✅ The Fix

**Disabled the entire OLD intent detection system** by commenting out the code in `ws/index.ts`:

### Before (ws/index.ts)
```typescript
const intentResult = await determineCollaborateIntent(data.message, {
  title: resolvedTitle,
  content: resolvedContent,
  contentType: resolvedContentType,
  language: resolvedLanguage
});

await orchestrator.handleMessage(socket, {
  content: data.message,
  privacy: 'public',
  source: 'collaborate',
  collaborateDocumentContext: { ... },
  intentContext: intentResult  // OLD SYSTEM
});

if (intentResult && intentResult.shouldRunEdit) {
  runCollaborateAgentTask(...);  // OLD EDITING
}
```

### After (ws/index.ts)
```typescript
// DISABLED: Old intent detection system
// const intentResult = await determineCollaborateIntent(...);

await orchestrator.handleMessage(socket, {
  content: data.message,
  privacy: 'public',
  source: 'collaborate',
  collaborateDocumentContext: { ... }
  // intentContext removed - using new agentic editor
});

// DISABLED: Old auto-edit system
// if (intentResult && intentResult.shouldRunEdit) {
//   runCollaborateAgentTask(...);
// }
```

### Cleanup (orchestrator.ts)
- Removed `intentContext` from `OrchestratorMessageData` interface
- Removed `intentContext` from `ChatContext` interface  
- Removed `intentContext` parameter from `buildMessages()`
- Removed `intentContext` destructuring in `handleMessage()`
- Removed code that used `intentContext.shouldRunEdit`

## 🎯 How It Works Now

```
User: "edit this file"
     ↓
ws/index.ts
     ↓
DIRECTLY to orchestrator.handleMessage()
     ↓
orchestrator.ts line 321
     ↓
NEW detectEditIntentWithFullContext() ← NEW SYSTEM
     ↓
executeAgenticEditingLoop() ← NEW EDITING LOGIC
     ↓
✓ Agentic editor runs!
✓ Progress shown in UI!
✓ Proper think→tool call cycles!
```

## 📝 Files Modified

### 1. ws/index.ts
- **Line 453-462**: Commented out `determineCollaborateIntent()` call
- **Line 475**: Removed `intentContext` from orchestrator call
- **Line 478-506**: Commented out old intent detection payload and auto-edit logic

### 2. orchestrator.ts
- **Line 12**: Commented out `CollaborateIntentResult` import
- **Line 80**: Removed `intentContext` from `ChatContext` interface
- **Line 96**: Removed `intentContext` from `OrchestratorMessageData` interface
- **Line 143**: Removed `intentContext` from destructuring
- **Line 715**: Removed `intentContext` parameter from `buildMessages()`
- **Line 717**: Removed `intentContext` from destructuring
- **Line 549**: Removed `intentContext` from `buildMessages()` call
- **Line 929**: Removed code that used `intentContext.shouldRunEdit`

## 🧪 Expected Behavior Now

### Terminal Logs (Old)
```bash
[WebSocket] collaborate:chat received for document 2
[CollaborateAI] Intent detected: edit_document (85%)  ← OLD SYSTEM
[Pipeline] 💬 Message received [Collaborate]
[Memory] Returning 18 memories
# Then nothing... frozen
```

### Terminal Logs (New)
```bash
[WebSocket] collaborate:chat received for document 2
[Pipeline] 💬 Message received [Collaborate] | docId: 2
[Pipeline] 🔍 Fetching personality snapshot...
[Pipeline] ✅ Personality snapshot retrieved
[Pipeline] 🧠 Context ready | memories: 18
[Pipeline] 🔎 Checking conditions: source=collaborate, hasDocContext=true, hasContent=true
[Pipeline] 🤖 Checking for agentic edit intent...
[Pipeline] Document: "main.py" (1523 chars)
[AgenticEditor] 🔍 Detecting intent with FULL context
[AgenticEditor] 🤔 Waiting for intent detection LLM response...
[AgenticEditor] ✅ Intent response received
[AgenticEditor] Intent: EDIT (85% confident)
[AgenticEditor] 🔄 Starting agentic editing loop
[AgenticEditor] 📝 Iteration 1/10 (elapsed: 0s)
...
```

## ✅ Status

**Issue**: New agentic editor not running  
**Root Cause**: Old intent detection system blocking new system  
**Fix**: Disabled old system completely  
**Status**: 🟢 **FIXED**

The new agentic code editor will now run properly, with:
- ✅ Progress shown in UI
- ✅ Think→Tool call cycles visible
- ✅ Real-time iteration updates
- ✅ Proper timeout handling
- ✅ Temperature 0.4 for deterministic code editing

---

*Fix applied: Nov 23, 2025*  
*Files modified*: 2 (`ws/index.ts`, `orchestrator.ts`)

# Memories Moved from System Prompt to User Messages

**Date**: Nov 23, 2025  
**Change**: Moved memory retrieval from system prompt to user message context

---

## 🎯 What Changed

### Before:
```
System Prompt:
├── Evelyn's personality
├── Current mood & relationship
├── Beliefs & goals
├── 🧠 Memories (here)        ← In system prompt
├── Web search results
└── Inner thought guidance

User Messages:
├── Conversation history
├── [Document context if present]
└── Current user message
```

### After:
```
System Prompt:
├── Evelyn's personality
├── Current mood & relationship
├── Beliefs & goals
├── Web search results
└── Inner thought guidance
    (memories removed from here)

User Messages:
├── Conversation history
├── 🧠 Memories (moved here)   ← Now as user message
├── [Document context if present]
└── Current user message
```

---

## 🔧 Implementation

### Changes Made to `orchestrator.ts`:

#### 1. Removed Memories from System Prompt Context Sections
**Line ~877**:
```typescript
const contextSections = [];
if (personalityText) contextSections.push(personalityText);
// memoriesText removed from system prompt - will be added as user message instead
if (searchText) contextSections.push(searchText);
if (thoughtText) contextSections.push(thoughtText);
```

#### 2. Added Memories as User Message
**Line ~916**:
```typescript
// Add memories as a user message (moved from system prompt for better context)
if (memoriesText) {
  messages.push({
    role: 'user',
    content: `[CONTEXT: ${memoriesText}]`
  });
  console.log(`[Pipeline] 🧠 Memories injected as user message (${memories.length} memories)`);
}
```

#### 3. Updated Message Order Logging
**Line ~954**:
```typescript
console.log(`[Pipeline] 📝 Message order: System → History (${history.length} msgs) → ${memories.length > 0 ? 'Memories → ' : ''}${documentContext ? 'Doc Context → ' : ''}Current User Msg`);
```

#### 4. Updated Rolling Window Notification Text
**Line ~886**:
```typescript
systemPrompt += `\n\n---\n\nIMPORTANT CONTEXT WINDOW: You are receiving the most recent ${ROLLING_WINDOW_SIZE} messages from the conversation history (user + assistant messages combined). Older messages beyond this window are not included in this context, but important information from them has been preserved in your memories (provided as context messages). This rolling window ensures optimal response quality and prevents token overflow.`;
```

---

## 📊 Message Flow Example

### Complete Message Structure:

```json
[
  {
    "role": "system",
    "content": "You are Evelyn...\n\n---\n\nYour Current State:\nMood: thoughtful...\n\n---\n\nPrevious Web Searches...\n\n---\n\nResponse Guidance..."
  },
  {
    "role": "user",
    "content": "previous user message 1"
  },
  {
    "role": "assistant",
    "content": "evelyn's previous response 1"
  },
  {
    "role": "user",
    "content": "previous user message 2"
  },
  {
    "role": "assistant",
    "content": "evelyn's previous response 2"
  },
  {
    "role": "user",
    "content": "[CONTEXT: Relevant Memories:\n[123] (episodic, importance: 0.85): User mentioned they like Python...\n\n[124] (semantic, importance: 0.90): User is working on a game project...]"
  },
  {
    "role": "user",
    "content": "[DOCUMENT CONTEXT]\n\nDocument: \"game.py\"\nType: code\n\n=== DOCUMENT CONTENT ===\n..."
  },
  {
    "role": "user",
    "content": "fix the bug in the move function"
  }
]
```

---

## 💡 Why This Change?

### Benefits:

1. **Cleaner System Prompt**
   - System prompt focuses on personality, mood, and guidance
   - Less cluttered, more focused instructions
   - Easier to maintain and debug

2. **Better Contextual Relevance**
   - Memories appear closer to the current question
   - LLM can better associate memories with the current context
   - More natural flow: history → memories → document → question

3. **More Flexible**
   - Easier to adjust memory placement in the future
   - Can conditionally include memories based on relevance
   - Separates persistent state (system) from contextual data (user)

4. **Token Efficiency**
   - Memories that aren't needed don't take up system prompt space
   - Can potentially cache system prompt better (though depends on provider)
   - Clearer separation of concerns

5. **Better Logging**
   - Explicit log when memories are injected
   - Can track memory count separately
   - Easier to debug memory-related issues

---

## 🔍 Expected Behavior

### Terminal Logs:

**Before**:
```bash
[Pipeline] 📝 Message order: System → History (23 msgs) → Doc Context → Current User Msg
```

**After**:
```bash
[Pipeline] 🧠 Memories injected as user message (18 memories)
[Pipeline] 📄 Document context injected before user message (12217 chars)
[Pipeline] 📝 Message order: System → History (23 msgs) → Memories → Doc Context → Current User Msg
```

### What Evelyn Sees:

The memories will appear as a context message labeled `[CONTEXT: Relevant Memories:]` just before any document context and the current user message. This makes it clear that these are retrieved memories providing background information, not part of the actual conversation.

---

## ✅ Testing

### Verify:
1. **Memories are injected** - Check logs for "🧠 Memories injected as user message"
2. **Correct order** - Logs show: History → Memories → Doc Context → Current
3. **Evelyn can access memories** - She should still reference past conversations correctly
4. **No duplicate info** - Memories only in message array, not in system prompt

### Test Cases:
- Chat with Evelyn and verify she remembers past conversations
- Ask about something from a previous session
- Check that memories appear in the correct position
- Verify system prompt is cleaner (no memories section)

---

## 📁 Files Modified

1. **`server/src/agent/orchestrator.ts`**
   - Line ~877: Removed `memoriesText` from `contextSections`
   - Line ~886: Updated rolling window notification text
   - Line ~916: Added memories as user message injection
   - Line ~954: Updated message order logging

---

## 🎯 Impact

### Minimal Disruption:
- ✅ Evelyn still has access to all memories
- ✅ Memory retrieval logic unchanged
- ✅ Only the placement in the message array changed
- ✅ Backward compatible

### Improved Architecture:
- ✅ System prompt = instructions + personality
- ✅ User messages = context + history + current question
- ✅ Clear separation of concerns
- ✅ More maintainable codebase

---

**Status**: ✅ **COMPLETE**

Memories have been successfully moved from the system prompt to user message context. The change maintains all functionality while improving code organization and contextual relevance.

---

*Change applied: Nov 23, 2025*  
*File modified: `server/src/agent/orchestrator.ts`*  
*Lines changed: 4 sections (~20 lines)*

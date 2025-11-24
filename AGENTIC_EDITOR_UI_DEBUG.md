# Agentic Code Editor UI Not Showing - Debugging Guide

**Date**: Nov 24, 2025  
**Issue**: Agentic code editor progress UI not displaying in Collaborate chat  
**Status**: Debug logging added, awaiting test

---

## 🔍 Investigation Summary

### What Should Happen:

1. **User sends message in Collaborate tab** with document open
2. **Backend detects edit intent** via `executeAgenticEdit`
3. **Backend emits** `subroutine:status` events with `tool: 'code_edit'`
4. **Frontend WebSocket** receives events, updates store
5. **CollaborateChat component** filters for `code_edit` activities
6. **AgenticEditProgress component** renders the UI

### Code Flow Verified:

✅ **Backend emits correctly** (`orchestrator.ts` line 351, 419):
```typescript
socket.emit('subroutine:status', {
  id: agenticEditActivityId,
  tool: 'code_edit',
  status: 'running',
  summary: 'Checking if document edit is needed...'
});
```

✅ **Agentic editor emits progress** (`agenticCodeEditor.ts` line 570, 748):
```typescript
socket.emit('subroutine:status', {
  id: activityId,
  tool: 'code_edit',
  status: 'running',
  summary: goal.goal,
  metadata: {
    currentIteration: iteration + 1,
    goal: goal.goal,
    agenticProgress: {
      iterations: iterations.slice(0, iterations.length),
      currentStep: iteration + 1,
      totalSteps: MAX_ITERATIONS,
      goal: goal.goal
    }
  }
});
```

✅ **WebSocket client listens** (`ws.ts` line 146):
```typescript
this.socket.on('subroutine:status', (data: any) => {
  useStore.getState().updateActivity(data);
});
```

✅ **Store updates activities** (`store.ts` line 793):
```typescript
updateActivity: (activity) => set((state) => {
  const existing = state.activities.findIndex(a => a.id === activity.id);
  if (existing >= 0) {
    const newActivities = [...state.activities];
    newActivities[existing] = {
      ...newActivities[existing],
      ...activity,
      metadata: activity.metadata ? {
        ...newActivities[existing].metadata,
        ...activity.metadata
      } : newActivities[existing].metadata
    };
    return { activities: newActivities };
  }
  return { activities: [...state.activities, activity] };
}),
```

✅ **CollaborateChat filters activities** (`CollaborateChat.tsx` line 189):
```typescript
const codeEditActivities = activities.filter(a => 
  a.tool === 'code_edit' && 
  (a.status === 'running' || a.status === 'done' || a.status === 'error')
);
```

✅ **AgenticEditProgress component exists** and properly structured

---

## 🐛 Possible Issues

### Issue 1: Activities Not Being Received
**Symptom**: WebSocket events not reaching frontend  
**Check**: Browser console should show `[WS] subroutine:status received:` logs  
**Debug**: Added logging to `ws.ts` line 147

### Issue 2: Activities Not Being Stored
**Symptom**: Events received but not stored in state  
**Check**: `activities` array in store should contain code_edit entries  
**Debug**: Added logging to `CollaborateChat.tsx` line 197-201

### Issue 3: Wrong Activity Tool Name
**Symptom**: Activities stored with different tool name  
**Check**: Activities might be named something other than `'code_edit'`  
**Debug**: Console logs will show all activities and their tool names

### Issue 4: Component Not Rendering
**Symptom**: Activities found but component not shown  
**Check**: `AgenticEditProgress` should receive activity prop  
**Debug**: Added logging to `AgenticEditProgress.tsx` line 47-48

### Issue 5: UI Rendering Off-Screen
**Symptom**: Component renders but not visible  
**Check**: CSS positioning or z-index issues  
**Debug**: Inspect element in browser dev tools

---

## 🔧 Debug Logging Added

### 1. WebSocket Event Logging (`ws.ts`)

**Location**: Line 147  
**Purpose**: Verify events are being received

```typescript
this.socket.on('subroutine:status', (data: any) => {
  console.log('[WS] subroutine:status received:', data);
  useStore.getState().updateActivity(data);
});
```

**Expected Output**:
```
[WS] subroutine:status received: {
  id: 123,
  tool: 'code_edit',
  status: 'running',
  summary: 'Checking if document edit is needed...'
}
```

### 2. Activity Filtering Logging (`CollaborateChat.tsx`)

**Location**: Line 197-201  
**Purpose**: Verify activities are being filtered correctly

```typescript
console.log('[CollaborateChat] All activities:', activities.length);
console.log('[CollaborateChat] Code edit activities:', codeEditActivities.length);
if (codeEditActivity) {
  console.log('[CollaborateChat] Rendering agentic editor:', codeEditActivity);
}
```

**Expected Output**:
```
[CollaborateChat] All activities: 5
[CollaborateChat] Code edit activities: 1
[CollaborateChat] Rendering agentic editor: {
  id: 123,
  tool: 'code_edit',
  status: 'running',
  metadata: { agenticProgress: {...} }
}
```

### 3. Component Rendering Logging (`AgenticEditProgress.tsx`)

**Location**: Line 47-48  
**Purpose**: Verify component receives data and renders

```typescript
console.log('[AgenticEditProgress] Rendering with activity:', activity);
console.log('[AgenticEditProgress] Progress data:', progress);
```

**Expected Output**:
```
[AgenticEditProgress] Rendering with activity: { id: 123, tool: 'code_edit', ... }
[AgenticEditProgress] Progress data: {
  iterations: [...],
  currentStep: 1,
  totalSteps: 10,
  goal: "Fix bug in function"
}
```

---

## 🧪 Testing Steps

### Step 1: Restart Frontend
```bash
cd web
npm run dev
```

### Step 2: Open Browser Console
- Open DevTools (F12 or Cmd+Opt+I)
- Go to Console tab
- Clear console for clean output

### Step 3: Test Agentic Editor
1. Open Collaborate tab
2. Create or open a document
3. Send a message requesting an edit (e.g., "add a comment to this function")
4. Watch console for logs

### Step 4: Analyze Logs

**If you see**: `[WS] subroutine:status received:` with `tool: 'code_edit'`
- ✅ Events are being received
- ➡️ Check next step

**If you DON'T see** WebSocket logs:
- ❌ Problem: Backend not emitting or WebSocket disconnected
- 🔧 Check: Server logs, WebSocket connection status

**If you see**: `[CollaborateChat] Code edit activities: 0`
- ❌ Problem: Activities not stored correctly or wrong tool name
- 🔧 Check: Store state, activity structure

**If you see**: `[CollaborateChat] Code edit activities: 1` but no component render
- ❌ Problem: Component not rendering despite data
- 🔧 Check: React component tree, conditional rendering

**If you see**: `[AgenticEditProgress] Rendering with activity:`
- ✅ Component is rendering!
- ➡️ Check if it's visible on screen (inspect element)

---

## 🔍 Common Problems & Solutions

### Problem 1: WebSocket Not Connected
**Symptom**: No `[WS]` logs at all  
**Solution**: Check server is running, verify WebSocket connection in Network tab

### Problem 2: Wrong Source Context
**Symptom**: Events received but not showing in Collaborate  
**Solution**: Verify `source: 'collaborate'` is being passed correctly

### Problem 3: Activities Array Empty
**Symptom**: `All activities: 0`  
**Solution**: Check store initialization, verify `updateActivity` is being called

### Problem 4: Wrong Activity Structure
**Symptom**: Activities exist but `code_edit` filter returns empty  
**Solution**: Check actual `tool` property value in activities

### Problem 5: Component Renders But Invisible
**Symptom**: Component logs show but UI not visible  
**Solution**: 
- Check CSS styling (border colors, background)
- Verify z-index and positioning
- Check if scrolled off-screen
- Inspect element in DevTools

---

## 📊 Expected Full Console Output

When working correctly, you should see this sequence:

```
[WS] subroutine:status received: {id: 45, tool: "code_edit", status: "running", summary: "Checking if document edit is needed..."}
[CollaborateChat] All activities: 1
[CollaborateChat] Code edit activities: 1
[CollaborateChat] Rendering agentic editor: {id: 45, tool: "code_edit", status: "running", ...}
[AgenticEditProgress] Rendering with activity: {id: 45, tool: "code_edit", ...}
[AgenticEditProgress] Progress data: undefined

[WS] subroutine:status received: {id: 45, tool: "code_edit", status: "running", metadata: {agenticProgress: {...}}}
[CollaborateChat] All activities: 1
[CollaborateChat] Code edit activities: 1
[CollaborateChat] Rendering agentic editor: {id: 45, tool: "code_edit", ...}
[AgenticEditProgress] Rendering with activity: {id: 45, tool: "code_edit", ...}
[AgenticEditProgress] Progress data: {iterations: Array(1), currentStep: 1, totalSteps: 10, goal: "..."}

[WS] subroutine:status received: {id: 45, tool: "code_edit", status: "running", metadata: {agenticProgress: {...}}}
[CollaborateChat] All activities: 1
[CollaborateChat] Code edit activities: 1
[CollaborateChat] Rendering agentic editor: {id: 45, tool: "code_edit", ...}
[AgenticEditProgress] Rendering with activity: {id: 45, tool: "code_edit", ...}
[AgenticEditProgress] Progress data: {iterations: Array(2), currentStep: 2, totalSteps: 10, goal: "..."}

...

[WS] subroutine:status received: {id: 45, tool: "code_edit", status: "done", summary: "Applied 3 changes", metadata: {changes: 3, iterations: 5}}
[CollaborateChat] All activities: 1
[CollaborateChat] Code edit activities: 1
[CollaborateChat] Rendering agentic editor: {id: 45, tool: "code_edit", status: "done", ...}
[AgenticEditProgress] Rendering with activity: {id: 45, tool: "code_edit", status: "done", ...}
[AgenticEditProgress] Progress data: {iterations: Array(5), currentStep: 5, totalSteps: 10, goal: "..."}
```

---

## 📁 Files Modified

1. **`web/src/lib/ws.ts`**
   - Added logging to `subroutine:status` handler (line 147)

2. **`web/src/components/collaborate/CollaborateChat.tsx`**
   - Added activity filtering debug logs (lines 197-201)

3. **`web/src/components/collaborate/AgenticEditProgress.tsx`**
   - Added component rendering debug logs (lines 47-48)

---

## 🎯 Next Steps

1. **Restart the frontend** with the debug logging
2. **Open browser console** and keep it visible
3. **Test agentic editing** by sending an edit request in Collaborate tab
4. **Share the console output** to identify where the issue is

The debug logs will pinpoint exactly where the UI rendering is breaking down, whether it's:
- WebSocket not receiving events
- Activities not being stored
- Activities being filtered out
- Component not rendering
- UI rendering but not visible

---

**Status**: ⏳ **Awaiting Test Results**

Once you test with the debug logging, we can identify the exact issue and apply the appropriate fix.

---

*Debug logging added: Nov 24, 2025*  
*Files modified: 3 (ws.ts, CollaborateChat.tsx, AgenticEditProgress.tsx)*  
*Total changes: ~10 lines of logging*

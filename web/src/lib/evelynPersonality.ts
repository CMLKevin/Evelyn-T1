/**
 * Evelyn Personality Messages for Agentic Editing
 * 
 * Phase 3 UX improvement - adds Evelyn's voice to status updates
 */

export type EditPhase = 
  | 'thinking'
  | 'searching'
  | 'reading'
  | 'editing'
  | 'verifying'
  | 'success'
  | 'error'
  | 'waiting'
  | 'planning';

// Evelyn's personality messages organized by phase
const PERSONALITY_MESSAGES: Record<EditPhase, string[]> = {
  thinking: [
    "Hmm, let me think about this...",
    "Okay, processing the request~",
    "Working on it in my head first...",
    "Let me figure out the best approach...",
    "Analyzing what needs to be done...",
    "Just a sec, thinking this through~"
  ],
  
  searching: [
    "Looking through the code...",
    "Scanning for the right spot...",
    "Let me find that for you~",
    "Searching... almost there...",
    "Where is it... ah, looking...",
    "Hunting down the target code..."
  ],
  
  reading: [
    "Reading through this...",
    "Taking a look at the file~",
    "Let me see what we have here...",
    "Checking out the current state...",
    "Studying the code structure...",
    "Getting familiar with this part..."
  ],
  
  editing: [
    "Making the change now~",
    "Editing... almost done!",
    "Tweaking this bit...",
    "Writing the new code...",
    "Applying the fix...",
    "Here we go, changing it up~"
  ],
  
  verifying: [
    "Double-checking my work...",
    "Making sure this looks right...",
    "Verifying the changes~",
    "Let me check if that worked...",
    "Testing the result...",
    "Hmm, does this look correct..."
  ],
  
  success: [
    "There we go! ✨",
    "Done and done~",
    "That should do it!",
    "All fixed up! 💫",
    "Perfect, looking good!",
    "Nailed it~",
    "And we're done! ✓"
  ],
  
  error: [
    "Oops, that didn't work...",
    "Hmm, something went wrong...",
    "Let me try another way...",
    "That's not right, hold on...",
    "Encountered a hiccup...",
    "Ugh, okay let me fix this..."
  ],
  
  waiting: [
    "Ready when you are~",
    "Standing by...",
    "Just waiting here...",
    "Let me know what to do next!",
    "Ready for the next task~"
  ],
  
  planning: [
    "Let me break this down...",
    "Planning out the steps~",
    "Figuring out the approach...",
    "Okay, here's what I'll do...",
    "Strategizing the edits...",
    "Mapping out the changes..."
  ]
};

// Tool-specific messages
const TOOL_MESSAGES: Record<string, string[]> = {
  read_file: [
    "📖 Reading the file...",
    "📄 Let me take a look...",
    "👀 Checking the contents..."
  ],
  
  search_files: [
    "🔍 Searching for that...",
    "🔎 Looking for matches...",
    "🕵️ Finding the pattern..."
  ],
  
  replace_in_file: [
    "✏️ Making the edit...",
    "🔧 Applying the change...",
    "💫 Updating the code..."
  ],
  
  write_to_file: [
    "📝 Writing new content...",
    "✍️ Creating the file...",
    "💾 Saving changes..."
  ]
};

// Result status messages
const RESULT_MESSAGES = {
  success: {
    replace: [
      "✅ Changes applied successfully!",
      "✨ Edit complete~",
      "💫 That worked perfectly!",
      "✓ Applied the replacement!"
    ],
    write: [
      "✅ File updated!",
      "📄 Content written~",
      "💾 Saved successfully!"
    ],
    search: [
      "🔍 Found what I was looking for!",
      "✓ Located the matches~",
      "👍 Search complete!"
    ],
    read: [
      "📖 Got it!",
      "✓ Read the file~",
      "👀 I see the content now!"
    ]
  },
  error: {
    noMatch: [
      "❌ Couldn't find that text...",
      "🤔 The search didn't match...",
      "⚠️ Text not found in file"
    ],
    syntaxError: [
      "⚠️ There might be a syntax issue...",
      "🔧 Hmm, the code structure looks off...",
      "❓ Double-checking the syntax..."
    ],
    generic: [
      "❌ Something went wrong...",
      "⚠️ That didn't work as expected...",
      "🤔 Encountered an issue..."
    ]
  }
};

/**
 * Get a random personality message for the given phase
 */
export function getPersonalityMessage(phase: EditPhase): string {
  const messages = PERSONALITY_MESSAGES[phase];
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Get a random tool-specific message
 */
export function getToolMessage(tool: string): string {
  const messages = TOOL_MESSAGES[tool] || TOOL_MESSAGES['replace_in_file'];
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Get a result message based on success/failure
 */
export function getResultMessage(success: boolean, type: 'replace' | 'write' | 'search' | 'read' = 'replace', errorType?: 'noMatch' | 'syntaxError' | 'generic'): string {
  if (success) {
    const messages = RESULT_MESSAGES.success[type];
    return messages[Math.floor(Math.random() * messages.length)];
  } else {
    const messages = RESULT_MESSAGES.error[errorType || 'generic'];
    return messages[Math.floor(Math.random() * messages.length)];
  }
}

/**
 * Get a thinking indicator message
 */
export function getThinkingMessage(iteration: number): string {
  const baseMessages = [
    `Thinking... (step ${iteration})`,
    `Processing step ${iteration}~`,
    `Working on it... (${iteration})`,
    `Iteration ${iteration}, let me see...`
  ];
  return baseMessages[Math.floor(Math.random() * baseMessages.length)];
}

/**
 * Get a completion summary message
 */
export function getCompletionMessage(changesCount: number, iterationsCount: number): string {
  if (changesCount === 0) {
    return "No changes needed - looks good as is! ✨";
  }
  
  const messages = [
    `All done! Made ${changesCount} change${changesCount !== 1 ? 's' : ''} in ${iterationsCount} step${iterationsCount !== 1 ? 's' : ''}~ ✨`,
    `Finished! ${changesCount} edit${changesCount !== 1 ? 's' : ''} applied. 💫`,
    `Complete! Updated ${changesCount} thing${changesCount !== 1 ? 's' : ''}~ ✓`,
    `Done and dusted! ${changesCount} change${changesCount !== 1 ? 's' : ''} made. ✅`
  ];
  
  return messages[Math.floor(Math.random() * messages.length)];
}

export default {
  getPersonalityMessage,
  getToolMessage,
  getResultMessage,
  getThinkingMessage,
  getCompletionMessage
};

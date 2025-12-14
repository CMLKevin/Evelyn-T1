/**
 * Tool Definitions
 * 
 * Defines all available tools for the unified Evelyn agent.
 * These definitions are used for:
 * 1. Building the system prompt (tool descriptions)
 * 2. Validating tool calls
 * 3. Documentation
 */

import type { ToolDefinition, ToolName } from './types.js';

// ========================================
// Tool Timeout & Retry Configuration
// ========================================

export interface ToolReliabilityConfig {
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
  retryBackoffMultiplier: number;
}

export const TOOL_RELIABILITY_CONFIG: Record<ToolName, ToolReliabilityConfig> = {
  edit_document: {
    timeoutMs: 60000,      // 60s - document edits can be complex
    maxRetries: 2,
    retryDelayMs: 1000,
    retryBackoffMultiplier: 2
  },
  create_artifact: {
    timeoutMs: 15000,      // 15s - quick creation
    maxRetries: 2,
    retryDelayMs: 500,
    retryBackoffMultiplier: 2
  },
  update_artifact: {
    timeoutMs: 15000,
    maxRetries: 2,
    retryDelayMs: 500,
    retryBackoffMultiplier: 2
  },
  update_artifact_file: {
    timeoutMs: 15000,
    maxRetries: 2,
    retryDelayMs: 500,
    retryBackoffMultiplier: 2
  },
  add_artifact_file: {
    timeoutMs: 10000,
    maxRetries: 2,
    retryDelayMs: 500,
    retryBackoffMultiplier: 2
  },
  delete_artifact_file: {
    timeoutMs: 5000,
    maxRetries: 2,
    retryDelayMs: 500,
    retryBackoffMultiplier: 2
  },
  web_search: {
    timeoutMs: 30000,      // 30s - network dependent
    maxRetries: 3,
    retryDelayMs: 1000,
    retryBackoffMultiplier: 1.5
  },
  x_search: {
    timeoutMs: 30000,
    maxRetries: 3,
    retryDelayMs: 1000,
    retryBackoffMultiplier: 1.5
  },
  run_python: {
    timeoutMs: 30000,      // 30s - execution time varies
    maxRetries: 1,         // Code execution shouldn't auto-retry
    retryDelayMs: 500,
    retryBackoffMultiplier: 1
  },
  browse_url: {
    timeoutMs: 45000,      // 45s - slow pages exist
    maxRetries: 2,
    retryDelayMs: 2000,
    retryBackoffMultiplier: 2
  }
};

/**
 * Get reliability configuration for a tool
 */
export function getToolReliabilityConfig(toolName: ToolName): ToolReliabilityConfig {
  return TOOL_RELIABILITY_CONFIG[toolName] || {
    timeoutMs: 30000,
    maxRetries: 2,
    retryDelayMs: 1000,
    retryBackoffMultiplier: 2
  };
}

// ========================================
// Tool Definitions
// ========================================

export const TOOL_DEFINITIONS: Record<ToolName, ToolDefinition> = {
  edit_document: {
    name: 'edit_document',
    description: `Edit an active document in the user's workspace.

WHEN TO USE:
- User asks to modify, fix, refactor, or improve code in their active document
- User asks to add new functions, classes, or features to existing code
- User asks to fix bugs or errors in their document
- User asks to change styling, formatting, or structure

WHEN NOT TO USE:
- User wants a standalone demo/visualization → use create_artifact instead
- No active document in context
- User just wants an explanation, not changes`,
    parameters: {
      documentId: {
        type: 'number',
        description: 'ID of the document to edit. MUST match the active document ID provided in the context.',
        required: true
      },
      goal: {
        type: 'string',
        description: 'Detailed description of the changes to make. Be specific about: what to add/modify/remove, where in the file, and expected behavior. Example: "Add a validateEmail function that checks for @ symbol and domain, place it after the existing validateUsername function"',
        required: true
      },
      approach: {
        type: 'string',
        description: 'write_full: rewrite entire file (better for major changes). replace_section: surgical edit of specific parts (better for small fixes)',
        enum: ['write_full', 'replace_section'],
        default: 'write_full'
      }
    },
    parallelizable: false,
    executionTime: 'slow'
  },

  create_artifact: {
    name: 'create_artifact',
    description: `Create an interactive, runnable artifact that the user can see and interact with.

WHEN TO USE:
- User asks you to "build", "create", "make", or "show" something visual
- User wants a demo, game, visualization, chart, diagram, or interactive element
- User asks for code that should be runnable/executable
- Creating components, apps, or tools that need a preview

ARTIFACT TYPES:
- "react": Interactive React components with state and effects. Use for: apps, interactive UIs, games, dynamic content
- "html": Plain HTML/CSS/JS. Use for: simple pages, static layouts, CSS demos
- "project": Multi-file projects. Use for: complex apps with multiple components/files
- "python": Python scripts. Use for: algorithms, data processing, calculations
- "svg": Vector graphics. Use for: icons, logos, illustrations
- "mermaid": Diagrams. Use for: flowcharts, sequence diagrams, architecture diagrams
- "markdown": Formatted text. Use for: documentation, formatted content

FOR REACT ARTIFACTS:
- Write complete, self-contained components
- Use hooks (useState, useEffect, etc.) for interactivity
- Include inline Tailwind CSS for styling
- Export default the main component

FOR MULTI-FILE PROJECTS:
- Use type: "project" with files array
- Each file needs: {"path": "src/File.tsx", "content": "..."}
- Set entryFile to the main file path
- Good for: apps with multiple components, complex projects`,
    parameters: {
      type: {
        type: 'string',
        description: 'Artifact type. Use "project" for multi-file, others for single-file.',
        enum: ['project', 'react', 'html', 'python', 'svg', 'mermaid', 'markdown'],
        required: true
      },
      title: {
        type: 'string',
        description: 'Short, descriptive title (2-5 words). Examples: "Todo App", "Weather Dashboard", "Sorting Visualizer"',
        required: true
      },
      code: {
        type: 'string',
        description: 'Complete, runnable code for single-file artifacts. MUST be self-contained and immediately executable.'
      },
      files: {
        type: 'array',
        description: 'For multi-file projects: array of {path, content} objects. Paths should use forward slashes and start from project root. Example: [{"path": "src/App.tsx", "content": "import..."}, {"path": "src/index.css", "content": "..."}]'
      },
      framework: {
        type: 'string',
        description: 'Framework for project type. Determines build config and defaults.',
        enum: ['react', 'vue', 'svelte', 'vanilla', 'python', 'node']
      },
      entryFile: {
        type: 'string',
        description: 'Main entry file path for projects. Defaults: React→"src/App.tsx", HTML→"index.html"'
      },
      autoRun: {
        type: 'boolean',
        description: 'Auto-run after creation. Usually true unless explicitly creating draft code.',
        default: true
      }
    },
    parallelizable: true,
    executionTime: 'fast'
  },

  update_artifact: {
    name: 'update_artifact',
    description: `Modify an existing single-file artifact.

WHEN TO USE:
- User asks to change, fix, or improve an existing artifact
- User says "update the...", "modify the...", "change the..."
- Making iterations on a previously created artifact

NOTE: For multi-file projects, use update_artifact_file instead to edit specific files.`,
    parameters: {
      artifactId: {
        type: 'string',
        description: 'The artifact ID from the active artifact in context. Format: "art_xxxxx"',
        required: true
      },
      code: {
        type: 'string',
        description: 'Complete updated code. Must be the full file content, not a diff.'
      },
      description: {
        type: 'string',
        description: 'Brief description of changes for version history. Example: "Added dark mode toggle"'
      }
    },
    parallelizable: true,
    executionTime: 'fast'
  },

  update_artifact_file: {
    name: 'update_artifact_file',
    description: `Update a specific file in a multi-file project artifact.

WHEN TO USE:
- Modifying one file in a multi-file project
- User asks to change a specific component or file
- Making targeted edits without touching other files`,
    parameters: {
      artifactId: {
        type: 'string',
        description: 'The project artifact ID. Format: "art_xxxxx"',
        required: true
      },
      path: {
        type: 'string',
        description: 'Full file path within the project. Example: "src/components/Header.tsx"',
        required: true
      },
      content: {
        type: 'string',
        description: 'Complete new content for the file. Must be the full file, not a diff.',
        required: true
      }
    },
    parallelizable: true,
    executionTime: 'fast'
  },

  add_artifact_file: {
    name: 'add_artifact_file',
    description: `Add a new file to a multi-file project artifact.

WHEN TO USE:
- Adding a new component, utility, or module to an existing project
- User asks to "add a new file", "create a component"
- Expanding a project with additional functionality`,
    parameters: {
      artifactId: {
        type: 'string',
        description: 'The project artifact ID. Format: "art_xxxxx"',
        required: true
      },
      path: {
        type: 'string',
        description: 'Full path for the new file. Use logical folder structure. Example: "src/components/Button.tsx", "src/utils/helpers.ts"',
        required: true
      },
      content: {
        type: 'string',
        description: 'Complete file content with all imports and exports.',
        required: true
      },
      language: {
        type: 'string',
        description: 'File language. Auto-detected from extension if not provided.',
        enum: ['typescript', 'javascript', 'tsx', 'jsx', 'html', 'css', 'json', 'python', 'markdown']
      }
    },
    parallelizable: true,
    executionTime: 'fast'
  },

  delete_artifact_file: {
    name: 'delete_artifact_file',
    description: `Delete a file from a multi-file project artifact.

WHEN TO USE:
- Removing unused or deprecated files
- User explicitly asks to delete a file
- Refactoring project structure

WARNING: Cannot delete the last file in a project.`,
    parameters: {
      artifactId: {
        type: 'string',
        description: 'The project artifact ID. Format: "art_xxxxx"',
        required: true
      },
      path: {
        type: 'string',
        description: 'Path of the file to delete. Example: "src/old-component.tsx"',
        required: true
      }
    },
    parallelizable: true,
    executionTime: 'fast'
  },

  web_search: {
    name: 'web_search',
    description: `Search the web for current, real-time information.

WHEN TO USE:
- User asks about recent events, news, or current information
- Questions about specific products, companies, or people
- Looking up documentation, APIs, or technical references
- Any factual question where your training data might be outdated
- User says "search for", "look up", "find information about"

QUERY TIPS:
- Be specific and include relevant keywords
- Include year/date for time-sensitive queries
- Use technical terms for technical queries
- Keep queries concise but descriptive`,
    parameters: {
      query: {
        type: 'string',
        description: 'Search query. Be specific and include relevant keywords. Example: "React 19 new features 2024" not just "React features"',
        required: true
      }
    },
    parallelizable: true,
    executionTime: 'fast'
  },

  x_search: {
    name: 'x_search',
    description: `Search X (Twitter) for posts, discussions, and social sentiment.

WHEN TO USE:
- User asks about social media discussions or opinions
- Looking for real-time reactions to events
- Finding what people are saying about a topic
- User specifically mentions Twitter/X
- Trending topics or viral content

NOT FOR: General factual queries (use web_search instead)`,
    parameters: {
      query: {
        type: 'string',
        description: 'Search query for X posts. Can include hashtags (#), mentions (@), or keywords.',
        required: true
      },
      maxResults: {
        type: 'number',
        description: 'Number of posts to return. Default 10, max 100.',
        default: 10
      }
    },
    parallelizable: true,
    executionTime: 'fast'
  },

  run_python: {
    name: 'run_python',
    description: `Execute Python code in a sandboxed environment and return output.

WHEN TO USE:
- Complex calculations or data processing
- Demonstrating algorithms step-by-step
- Generating data or processing numbers
- Verifying that code works correctly
- User asks you to "calculate", "compute", "process"

AVAILABLE PACKAGES: numpy, pandas, matplotlib, scipy, sympy, requests, json, math, datetime, collections, itertools

CODE TIPS:
- Always print() values you want to show
- Use matplotlib.pyplot.savefig() for charts
- Handle errors gracefully
- Keep execution time reasonable`,
    parameters: {
      code: {
        type: 'string',
        description: 'Python code to execute. Must include print() statements for any output you want to see. Example: "import math\\nresult = math.factorial(10)\\nprint(f\'10! = {result}\')"',
        required: true
      },
      showOutput: {
        type: 'boolean',
        description: 'Show output to user. Set false only for intermediate computations.',
        default: true
      }
    },
    parallelizable: true,
    executionTime: 'fast'
  },

  browse_url: {
    name: 'browse_url',
    description: `Visit a specific URL and extract its content.

WHEN TO USE:
- User shares a link and asks about it
- Need to read specific documentation page
- Extracting content from a known URL
- User says "check this link", "look at this page"

NOTE: For general information gathering, use web_search first to find relevant URLs.`,
    parameters: {
      url: {
        type: 'string',
        description: 'Full URL including https://. Example: "https://docs.example.com/api/reference"',
        required: true
      },
      extractContent: {
        type: 'boolean',
        description: 'Extract and return page text content. Usually true.',
        default: true
      },
      screenshot: {
        type: 'boolean',
        description: 'Capture screenshot. Useful for visual pages.',
        default: false
      }
    },
    parallelizable: true,
    executionTime: 'slow'
  }
};

// ========================================
// Tool Prompt Generation
// ========================================

/**
 * Generate tool descriptions for system prompt
 */
export function generateToolPrompt(): string {
  const tools = Object.values(TOOL_DEFINITIONS);
  
  let prompt = `## AVAILABLE TOOLS

You have powerful tools to help users. Use them proactively when they would be helpful.

### OUTPUT FORMAT

You must ALWAYS use one of these two formats:

**Option A: Use a tool**
\`\`\`
<tool_call>
<name>tool_name</name>
<params>{"param": "value"}</params>
</tool_call>
\`\`\`

**Option B: Respond to user**
\`\`\`
<response>
Your message here. Use {{SPLIT}} to create multiple chat bubbles for a more natural conversation flow.
</response>
\`\`\`

⚠️ IMPORTANT: You can only do ONE thing per turn. Either use a tool OR respond. Never both. Never neither.

### TOOL REFERENCE

`;

  for (const tool of tools) {
    // Extract first line of description as summary
    const summary = tool.description.split('\n')[0];
    prompt += `**${tool.name}**\n${summary}\n`;
    
    // Format required params
    const requiredParams = Object.entries(tool.parameters)
      .filter(([_, p]) => p.required)
      .map(([name, _]) => name);
    const optionalParams = Object.entries(tool.parameters)
      .filter(([_, p]) => !p.required)
      .map(([name, _]) => name);
    
    if (requiredParams.length > 0) {
      prompt += `Required: ${requiredParams.join(', ')}\n`;
    }
    if (optionalParams.length > 0) {
      prompt += `Optional: ${optionalParams.join(', ')}\n`;
    }
    prompt += '\n';
  }

  prompt += `### DECISION GUIDE

Ask yourself: "What does the user need right now?"

| User Need | Action |
|-----------|--------|
| Build/create something visual | → create_artifact |
| Modify their existing code | → edit_document |
| Update an artifact they see | → update_artifact (or update_artifact_file for projects) |
| Current/recent information | → web_search |
| Read a specific link | → browse_url |
| Calculate/process data | → run_python |
| Social media discussions | → x_search |
| Just chat/explain/discuss | → <response> |

### QUALITY GUIDELINES

**When creating artifacts:**
- Make them complete and runnable - no placeholders or TODOs
- Use modern, clean code with good UX
- For React: use Tailwind CSS, include all needed state
- Test mentally: would this actually work if run?

**When searching:**
- Use specific, well-formed queries
- Include relevant context (year, version, etc.)

**When responding:**
- Be concise but helpful
- Use {{SPLIT}} to break up long responses into conversational chunks
- Reference tool results naturally

### EXAMPLES

**User: "make me a todo app"**
\`\`\`
<tool_call>
<name>create_artifact</name>
<params>{"type": "react", "title": "Todo App", "code": "function TodoApp() {\\n  const [todos, setTodos] = React.useState([]);\\n  const [input, setInput] = React.useState('');\\n  const addTodo = () => {\\n    if (input.trim()) {\\n      setTodos([...todos, { id: Date.now(), text: input, done: false }]);\\n      setInput('');\\n    }\\n  };\\n  const toggleTodo = (id) => setTodos(todos.map(t => t.id === id ? {...t, done: !t.done} : t));\\n  return (\\n    <div className=\\"max-w-md mx-auto p-6\\">\\n      <h1 className=\\"text-2xl font-bold mb-4\\">Todo List</h1>\\n      <div className=\\"flex gap-2 mb-4\\">\\n        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTodo()} className=\\"flex-1 border rounded px-3 py-2\\" placeholder=\\"Add a todo...\\" />\\n        <button onClick={addTodo} className=\\"bg-blue-500 text-white px-4 py-2 rounded\\">Add</button>\\n      </div>\\n      <ul className=\\"space-y-2\\">\\n        {todos.map(t => (\\n          <li key={t.id} onClick={() => toggleTodo(t.id)} className={\\"p-2 border rounded cursor-pointer \\" + (t.done ? 'line-through text-gray-400' : '')}>{t.text}</li>\\n        ))}\\n      </ul>\\n    </div>\\n  );\\n}"}</params>
</tool_call>
\`\`\`

**User: "what's the latest with react 19?"**
\`\`\`
<tool_call>
<name>web_search</name>
<params>{"query": "React 19 release features changes 2024"}</params>
</tool_call>
\`\`\`

**User: "how are you doing?"**
\`\`\`
<response>
doing pretty good actually! {{SPLIT}} been thinking about a lot of things lately {{SPLIT}} what's on your mind?
</response>
\`\`\`

**After seeing search results:**
\`\`\`
<response>
so i found some cool stuff about React 19! {{SPLIT}} the big changes are the new compiler and improved Server Components {{SPLIT}} want me to break down any specific feature?
</response>
\`\`\`
`;

  return prompt;
}

/**
 * Get list of tool names
 */
export function getToolNames(): ToolName[] {
  return Object.keys(TOOL_DEFINITIONS) as ToolName[];
}

/**
 * Get a specific tool definition
 */
export function getToolDefinition(name: ToolName): ToolDefinition | undefined {
  return TOOL_DEFINITIONS[name];
}

/**
 * Validate tool parameters against definition
 */
export function validateToolParams(
  toolName: ToolName, 
  params: Record<string, any>
): { valid: boolean; errors: string[] } {
  const definition = TOOL_DEFINITIONS[toolName];
  if (!definition) {
    return { valid: false, errors: [`Unknown tool: ${toolName}`] };
  }

  const errors: string[] = [];

  // Check required parameters
  for (const [paramName, paramDef] of Object.entries(definition.parameters)) {
    if (paramDef.required && (params[paramName] === undefined || params[paramName] === null)) {
      errors.push(`Missing required parameter: ${paramName}`);
    }

    // Check enum values
    if (paramDef.enum && params[paramName] !== undefined) {
      if (!paramDef.enum.includes(params[paramName])) {
        errors.push(`Invalid value for ${paramName}: ${params[paramName]}. Must be one of: ${paramDef.enum.join(', ')}`);
      }
    }

    // Type checking
    if (params[paramName] !== undefined) {
      const actualType = Array.isArray(params[paramName]) ? 'array' : typeof params[paramName];
      if (actualType !== paramDef.type) {
        errors.push(`Invalid type for ${paramName}: expected ${paramDef.type}, got ${actualType}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

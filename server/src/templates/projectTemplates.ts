/**
 * Project Templates
 * 
 * Pre-built project structures for common frameworks.
 * Used when creating multi-file artifacts.
 */

export interface ProjectTemplate {
  name: string;
  framework: 'react' | 'vue' | 'svelte' | 'vanilla' | 'python' | 'node';
  description: string;
  entryFile: string;
  files: Array<{ path: string; content: string }>;
}

export const PROJECT_TEMPLATES: Record<string, ProjectTemplate> = {
  'react-tailwind': {
    name: 'React + Tailwind',
    framework: 'react',
    description: 'Modern React app with Tailwind CSS',
    entryFile: 'src/App.tsx',
    files: [
      {
        path: 'src/App.tsx',
        content: `import React, { useState } from 'react';
import './index.css';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center">
      <div className="text-center p-8">
        <h1 className="text-5xl font-bold text-white mb-4">
          Hello, World!
        </h1>
        <p className="text-gray-300 mb-8">
          Built with React + Tailwind CSS
        </p>
        <div className="space-y-4">
          <p className="text-3xl font-mono text-orange-400">
            Count: {count}
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => setCount(c => c - 1)}
              className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              Decrease
            </button>
            <button
              onClick={() => setCount(c => c + 1)}
              className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
            >
              Increase
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
`
      },
      {
        path: 'src/index.css',
        content: `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
`
      },
      {
        path: 'package.json',
        content: `{
  "name": "react-tailwind-app",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.0",
    "typescript": "^5.0.0"
  }
}
`
      }
    ]
  },

  'vanilla-js': {
    name: 'Vanilla HTML/CSS/JS',
    framework: 'vanilla',
    description: 'Simple HTML, CSS, and JavaScript project',
    entryFile: 'index.html',
    files: [
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My App</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="container">
    <h1>Hello, World!</h1>
    <p>A simple vanilla JavaScript app</p>
    <div class="counter">
      <span id="count">0</span>
      <div class="buttons">
        <button id="decrease">-</button>
        <button id="increase">+</button>
      </div>
    </div>
  </div>
  <script src="script.js"></script>
</body>
</html>
`
      },
      {
        path: 'styles.css',
        content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.container {
  text-align: center;
  padding: 2rem;
}

h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
}

p {
  color: #a0a0a0;
  margin-bottom: 2rem;
}

.counter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

#count {
  font-size: 4rem;
  font-family: monospace;
  color: #f97316;
}

.buttons {
  display: flex;
  gap: 1rem;
}

button {
  padding: 0.75rem 1.5rem;
  font-size: 1.25rem;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

#decrease {
  background: #ef4444;
  color: white;
}

#decrease:hover {
  background: #dc2626;
}

#increase {
  background: #22c55e;
  color: white;
}

#increase:hover {
  background: #16a34a;
}
`
      },
      {
        path: 'script.js',
        content: `// Counter state
let count = 0;

// DOM elements
const countDisplay = document.getElementById('count');
const decreaseBtn = document.getElementById('decrease');
const increaseBtn = document.getElementById('increase');

// Update display
function updateDisplay() {
  countDisplay.textContent = count;
}

// Event listeners
decreaseBtn.addEventListener('click', () => {
  count--;
  updateDisplay();
});

increaseBtn.addEventListener('click', () => {
  count++;
  updateDisplay();
});

// Initialize
updateDisplay();
console.log('App initialized!');
`
      }
    ]
  },

  'python-app': {
    name: 'Python Application',
    framework: 'python',
    description: 'Simple Python project structure',
    entryFile: 'main.py',
    files: [
      {
        path: 'main.py',
        content: `"""
Main application entry point
"""

from app import run

if __name__ == "__main__":
    run()
`
      },
      {
        path: 'app.py',
        content: `"""
Application logic
"""

def greet(name: str) -> str:
    """Return a greeting message."""
    return f"Hello, {name}!"

def calculate(a: int, b: int, operation: str = "add") -> int:
    """Perform a calculation."""
    operations = {
        "add": a + b,
        "subtract": a - b,
        "multiply": a * b,
        "divide": a // b if b != 0 else 0
    }
    return operations.get(operation, 0)

def run():
    """Run the application."""
    print(greet("World"))
    print(f"2 + 3 = {calculate(2, 3, 'add')}")
    print(f"10 - 4 = {calculate(10, 4, 'subtract')}")
    print(f"5 * 6 = {calculate(5, 6, 'multiply')}")
`
      },
      {
        path: 'requirements.txt',
        content: `# Python dependencies
# Add your dependencies here
`
      },
      {
        path: 'README.md',
        content: `# Python Application

A simple Python project template.

## Usage

\`\`\`bash
python main.py
\`\`\`

## Structure

- \`main.py\` - Entry point
- \`app.py\` - Application logic
- \`requirements.txt\` - Dependencies
`
      }
    ]
  }
};

/**
 * Get a project template by name
 */
export function getTemplate(name: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES[name];
}

/**
 * List available templates
 */
export function listTemplates(): string[] {
  return Object.keys(PROJECT_TEMPLATES);
}

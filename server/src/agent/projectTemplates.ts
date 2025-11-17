export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  language: string;
  framework?: string;
  files: TemplateFile[];
  dependencies: string[];
  scripts: Record<string, string>;
}

export interface TemplateFile {
  path: string;
  content: string;
  type: 'source' | 'config' | 'doc' | 'test';
  language: string;
  isMain: boolean;
}

export const TEMPLATES: ProjectTemplate[] = [
  {
    id: 'react-typescript',
    name: 'React TypeScript App',
    description: 'A modern React application with TypeScript',
    category: 'web',
    language: 'typescript',
    framework: 'react',
    files: [
      {
        path: 'src/App.tsx',
        content: `import React from 'react';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Welcome to React TypeScript</h1>
      </header>
    </div>
  );
}

export default App;`,
        type: 'source',
        language: 'typescript',
        isMain: true
      },
      {
        path: 'src/index.tsx',
        content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
        type: 'source',
        language: 'typescript',
        isMain: false
      },
      {
        path: 'package.json',
        content: `{
  "name": "react-ts-app",
  "version": "0.1.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^4.9.5"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test"
  }
}`,
        type: 'config',
        language: 'json',
        isMain: false
      }
    ],
    dependencies: ['react', 'react-dom', 'typescript'],
    scripts: {
      start: 'react-scripts start',
      build: 'react-scripts build',
      test: 'react-scripts test'
    }
  },
  {
    id: 'node-express',
    name: 'Node.js Express Server',
    description: 'A basic Express.js server with TypeScript',
    category: 'backend',
    language: 'typescript',
    framework: 'express',
    files: [
      {
        path: 'src/server.ts',
        content: `import express from 'express';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Express!' });
});

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});`,
        type: 'source',
        language: 'typescript',
        isMain: true
      },
      {
        path: 'package.json',
        content: `{
  "name": "express-server",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "typescript": "^4.9.5",
    "@types/express": "^4.17.17"
  },
  "scripts": {
    "start": "node dist/server.js",
    "dev": "ts-node src/server.ts",
    "build": "tsc"
  }
}`,
        type: 'config',
        language: 'json',
        isMain: false
      }
    ],
    dependencies: ['express', 'typescript', '@types/express'],
    scripts: {
      start: 'node dist/server.js',
      dev: 'ts-node src/server.ts',
      build: 'tsc'
    }
  },
  {
    id: 'python-flask',
    name: 'Python Flask App',
    description: 'A simple Flask web application',
    category: 'backend',
    language: 'python',
    framework: 'flask',
    files: [
      {
        path: 'app.py',
        content: `from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/')
def hello():
    return jsonify({"message": "Hello from Flask!"})

@app.route('/api/health')
def health():
    return jsonify({"status": "healthy"})

if __name__ == '__main__':
    app.run(debug=True)`,
        type: 'source',
        language: 'python',
        isMain: true
      },
      {
        path: 'requirements.txt',
        content: `Flask==2.3.3
Werkzeug==2.3.7`,
        type: 'config',
        language: 'text',
        isMain: false
      }
    ],
    dependencies: ['Flask==2.3.3'],
    scripts: {
      start: 'python app.py',
      install: 'pip install -r requirements.txt'
    }
  }
];

export function getTemplate(id: string): ProjectTemplate | undefined {
  return TEMPLATES.find(template => template.id === id);
}

export function getAllTemplates(): ProjectTemplate[] {
  return TEMPLATES;
}

export function getTemplatesByLanguage(language: string): ProjectTemplate[] {
  return TEMPLATES.filter(template => template.language === language);
}

export function getTemplatesByCategory(category: string): ProjectTemplate[] {
  return TEMPLATES.filter(template => 
    template.name.toLowerCase().includes(category.toLowerCase()) ||
    template.description.toLowerCase().includes(category.toLowerCase())
  );
}

export function getTemplateById(id: string): ProjectTemplate | undefined {
  return getTemplate(id);
}

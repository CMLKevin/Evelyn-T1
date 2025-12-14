# Evelyn

**An Advanced Agentic AI Companion with Persistent Memory, Evolving Personality, and Emotional Intelligence**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933.svg)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.0-2D3748.svg)](https://www.prisma.io/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg)](https://tailwindcss.com/)

---

## Overview

Evelyn is a sophisticated full-stack AI companion platform that transcends traditional chatbot paradigms. Built with a focus on **long-term memory persistence**, **dynamic personality evolution**, and **agentic tool-use capabilities**, Evelyn represents a new approach to human-AI interaction where the AI genuinely remembers, learns, and grows through conversations.

Unlike conventional AI assistants that treat each conversation as isolated, Evelyn maintains:
- **Semantic long-term memory** with vector embeddings and importance scoring
- **Evolving personality** with mood dynamics, belief formation, and relationship tracking
- **Agentic capabilities** including web browsing, code execution, and artifact creation
- **Temporal decay systems** that model natural memory fading and belief reinforcement

---

## Key Features

### Advanced Memory System

Evelyn's memory architecture is a multi-tier system designed for intelligent information retention and retrieval:

| Component | Description |
|-----------|-------------|
| **Vector Embeddings** | 3072-dimensional embeddings via `text-embedding-3-large` for semantic search |
| **Importance Scoring** | Dynamic 0.0-1.0 scoring with heuristic adjustments (+0.25 for explicit "remember" requests) |
| **Semantic Clustering** | Agglomerative clustering groups related memories with centroid calculation |
| **Memory Linking** | Directed graph of memory relationships with weighted connections |
| **Temporal Decay** | 30-day exponential recency boost with evergreen memory protection |

#### Memory Types
- **Episodic** - Specific conversation events
- **Semantic** - General knowledge and facts
- **Relational** - Information about users and relationships
- **Insight** - AI-generated reflections and realizations
- **Preference** - User preferences and habits
- **Project Context** - Code and collaboration context

#### Smart Retrieval Pipeline
```
Query → Embedding → Top 2000 Candidates → Similarity Scoring
     → Importance Blending (60% similarity, 40% importance)
     → Recency Boost → Cluster-Aware Expansion → Final Ranking
```

### Dynamic Personality System

Evelyn's personality evolves through a sophisticated emotional and cognitive modeling system:

#### Mood Dynamics
- **Valence** (-1 to +1): Emotional positivity with baseline convergence
- **Arousal** (0 to 1): Energy and engagement level
- **30-minute half-life decay** toward baseline states
- **Mood history persistence** for emotional continuity

#### Relationship Evolution
```
Stranger → Acquaintance → Learning Together → Growing Together
       → Trusted Companion → Deep Bond → Cherished Family
```

Three-dimensional relationship tracking:
- **Closeness**: Emotional connection depth
- **Trust**: Reliance and safety perception
- **Affection**: Care and warmth (familial, not romantic)

#### Belief System
- Evidence-based beliefs about self, user, and world
- **14-day half-life decay** - beliefs naturally fade without reinforcement
- Confidence scoring with supporting memory references
- Deep reflection engine (Gemini 2.5 Pro) for belief updates

### Agentic Capabilities

Evelyn operates as an autonomous agent with a comprehensive tool system:

| Tool | Description | Timeout |
|------|-------------|---------|
| `edit_document` | Modify workspace documents | 60s |
| `create_artifact` | Build interactive React/HTML/Python projects | 45s |
| `web_search` | Real-time web information retrieval | 30s |
| `x_search` | X/Twitter social media search | 30s |
| `run_python` | Execute Python in sandboxed environment | 30s |
| `browse_url` | Extract content from specific URLs | 45s |

#### Multi-File Artifact System
- **Version-controlled project trees** with file-level snapshots
- **Live preview** with real-time execution/rendering
- **Multi-language support**: React, HTML, Python, SVG, Mermaid diagrams
- **Deployment capabilities** for sharing published artifacts

#### Intelligent Goal Completion Detection
Multi-signal confidence scoring prevents premature completion claims:
```
Confidence = 0.35 × explicit_claim + 0.20 × no_tools
           + 0.30 × changes_verified + 0.15 × content_stabilized
```

### Modern Glassmorphism UI

A carefully crafted design system featuring:
- **Layered glassmorphism** with backdrop-blur effects
- **Modern border radius scale** (xs: 2px → 3xl: 24px)
- **Floating container architecture** with subtle shadows
- **Pill-shaped status indicators** with animated states
- **Asymmetric message bubbles** distinguishing user/AI
- **Orange accent theming** (#ff6b35) with cyan secondary

---

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          EVELYN PLATFORM                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   React     │  │  Zustand    │  │  Socket.IO  │  │  Monaco    │ │
│  │   18.3      │  │  State      │  │  Client     │  │  Editor    │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘ │
│         │                │                │               │         │
│         └────────────────┴────────┬───────┴───────────────┘         │
│                                   │                                  │
│                          WebSocket/REST                              │
├───────────────────────────────────┼─────────────────────────────────┤
│                                   │                                  │
│  ┌────────────────────────────────┴────────────────────────────┐    │
│  │                    EXPRESS SERVER                            │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │    │
│  │  │ Agentic  │  │ Memory   │  │Personality│  │  Temporal    │ │    │
│  │  │ Engine   │  │ System   │  │  System   │  │  Engine      │ │    │
│  │  │          │  │          │  │           │  │              │ │    │
│  │  │ - Tools  │  │ - Vector │  │ - Mood    │  │ - Decay      │ │    │
│  │  │ - Stream │  │ - Search │  │ - Beliefs │  │ - Lifecycle  │ │    │
│  │  │ - Goals  │  │ - Links  │  │ - Goals   │  │ - Scheduling │ │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                   │                                  │
│  ┌────────────────────────────────┴────────────────────────────┐    │
│  │                      DATA LAYER                              │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │    │
│  │  │   Prisma     │  │   OpenAI     │  │   OpenRouter/    │   │    │
│  │  │   SQLite     │  │   Embeddings │  │   Grok LLM       │   │    │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Memory System Architecture

```typescript
// Multi-stage retrieval with blended scoring
interface MemoryRetrieval {
  // Stage 1: Embedding & Candidate Selection
  embedding: Float32Array;        // 3072-dimensional
  candidates: Memory[];           // Top 2000 by importance

  // Stage 2: Similarity Scoring
  cosineSimilarity: number;       // 0-1 semantic match
  importanceScore: number;        // 0-1 stored importance
  blendedScore: number;           // 0.6 * similarity + 0.4 * importance

  // Stage 3: Temporal & Contextual Boosting
  recencyBoost: number;           // Exponential decay (30-day τ)
  evergreenBoost: number;         // +0.3 for critical memories
  salienceScore: number;          // Context-aware relevance

  // Stage 4: Diversity & Final Ranking
  mmrScore: number;               // Maximal Marginal Relevance
  clusterExpansion: Memory[];     // Related memories from clusters
}
```

### Personality Evolution Model

```typescript
interface PersonalityState {
  // Mood Dynamics (30-minute half-life)
  mood: {
    valence: number;    // -1 (negative) to +1 (positive)
    arousal: number;    // 0 (calm) to 1 (excited)
    stance: string;     // e.g., "curious and engaged"
    baseline: { valence: 0.2, arousal: 0.4 };
  };

  // Relationship Tracking (per-user)
  relationship: {
    closeness: number;  // Emotional connection
    trust: number;      // Reliance and safety
    affection: number;  // Care and warmth
    stage: RelationshipStage;
    boundaries: Record<string, boolean>;
  };

  // Belief System (14-day half-life)
  beliefs: Array<{
    subject: 'self' | 'user' | 'world';
    content: string;
    confidence: number;
    evidence: MemoryReference[];
    lastReinforced: Date;
  }>;

  // Goal System
  goals: Array<{
    category: 'learning' | 'relationship' | 'habit' | 'craft';
    description: string;
    priority: 1 | 2 | 3 | 4 | 5;
    progress: number;
  }>;
}
```

### Agentic Engine V2

The agentic engine features intelligent complexity estimation and context optimization:

```typescript
interface AgenticEngine {
  // Intent Detection (fast ~30s check)
  detectIntent(message: string): {
    requiresTools: boolean;
    complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
    confidence: number;
  };

  // Context Optimization (~60% token reduction)
  createContextWindow(document: string, focus: LineRange): {
    content: string;       // Max 150 lines, 8000 chars
    lineNumbers: boolean;  // `line_num | content` format
    padding: number;       // 10-line context around focus
  };

  // Streaming with Partial Recovery
  stream(prompt: string): AsyncIterable<{
    tokens: string;
    toolCalls?: ToolCall[];
    partialRecovery?: string;  // >500 chars saved on error
  }>;

  // Reliability Configuration
  toolConfig: {
    edit_document: { timeout: 60000, retries: 2, backoff: 1.5 };
    web_search: { timeout: 30000, retries: 3, backoff: 2.0 };
    // ...per-tool configuration
  };
}
```

### Temporal Engine

Centralized time management for all decay and scheduling operations:

```typescript
interface TemporalEngine {
  // Decay Systems
  moodDecay: { halfLife: '30 minutes', target: 'baseline' };
  beliefDecay: { halfLife: '14 days', target: 0 };
  memoryRecency: { characteristicTime: '30 days', maxBoost: 0.2 };

  // Background Processing (5-minute cycles)
  schedule: {
    always: ['moodDecay', 'beliefDecay', 'pruneEphemeral'];
    daily: ['summarizeOldMemories'];
    weekly: ['semanticClustering'];
    every12h: ['recalculateImportance'];
  };

  // Lifecycle Tracking
  lifecycle: {
    startup: Date;
    lastShutdown: Date;
    totalUptime: Duration;
    crashRecovery: boolean;
  };
}
```

---

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 18.3** | UI framework with concurrent features |
| **TypeScript 5** | Type-safe development |
| **Vite 5** | Next-generation build tooling |
| **TailwindCSS 3.4** | Utility-first styling with custom design tokens |
| **Zustand** | Lightweight state management |
| **Monaco Editor** | VS Code-powered code editing |
| **Socket.IO Client** | Real-time bidirectional communication |

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js 18+** | JavaScript runtime |
| **Express 4** | Web framework |
| **Socket.IO** | WebSocket server for streaming |
| **Prisma 5** | Type-safe ORM with migrations |
| **SQLite** | Embedded database |

### AI/ML
| Technology | Purpose |
|------------|---------|
| **OpenRouter** | Multi-model LLM gateway (Grok, Claude, Gemini) |
| **OpenAI Embeddings** | `text-embedding-3-large` for semantic search |
| **Perplexity** | Real-time web search integration |
| **Grok Agent Tools** | Web search, X search, Python execution |

---

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- OpenRouter API key
- OpenAI API key (for embeddings)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/evelyn.git
cd evelyn

# Install all dependencies
npm run install:all

# Configure environment
cp .env.example .env
# Edit .env with your API keys:
# - OPENROUTER_API_KEY
# - OPENAI_API_KEY
# - PERPLEXITY_API_KEY (optional)

# Initialize database
npm run db:setup

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

---

## Project Structure

```
evelyn/
├── server/                    # Backend Express server
│   ├── src/
│   │   ├── agent/
│   │   │   ├── agenticEngineV2.ts    # Core agentic loop
│   │   │   ├── agenticPromptsV2.ts   # Tiered prompt system
│   │   │   ├── personality.ts         # Mood & relationship logic
│   │   │   ├── browserAgent.ts        # Web browsing capability
│   │   │   └── tools/                 # Tool definitions & parser
│   │   ├── core/
│   │   │   ├── memory.ts              # Memory retrieval & storage
│   │   │   └── temporal.ts            # Decay & scheduling engine
│   │   ├── providers/
│   │   │   ├── openrouter.ts          # LLM streaming client
│   │   │   └── perplexity.ts          # Search provider
│   │   ├── routes/                    # REST API endpoints
│   │   └── ws/                        # WebSocket handlers
│   └── prisma/
│       └── schema.prisma              # Database schema
│
├── web/                       # Frontend React application
│   ├── src/
│   │   ├── components/
│   │   │   ├── chat/                  # Chat interface
│   │   │   ├── collaborate/           # Document collaboration
│   │   │   ├── artifacts/             # Artifact rendering
│   │   │   ├── terminal/              # Layout components
│   │   │   └── ui/                    # Design system components
│   │   ├── state/
│   │   │   └── store.ts               # Zustand state management
│   │   └── lib/
│   │       └── ws.ts                  # WebSocket client
│   └── tailwind.config.ts             # Design tokens
│
└── scripts/                   # Utility scripts
```

---

## Configuration

### LLM Models

Configure models through the settings panel:

| Use Case | Recommended Model | Characteristics |
|----------|-------------------|-----------------|
| **General Chat** | `x-ai/grok-4.1-fast` | Fast, cost-effective |
| **Complex Tasks** | `anthropic/claude-opus-4.5` | Deep reasoning |
| **Deep Reflection** | `google/gemini-2.5-pro` | Personality evolution |

### Memory Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Thought Verbosity | Medium | Detail level of internal thoughts |
| Memory Privacy | Public | Default privacy for new memories |
| Search Preference | Auto | When to trigger web search |

---

## Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start full development environment |
| `npm run dev:server` | Backend only |
| `npm run dev:web` | Frontend only |
| `npm run build` | Production build |
| `npm run db:setup` | Initialize database |
| `npm run db:studio` | Open Prisma Studio |
| `npm test` | Run test suite |

### Running Tests

```bash
cd server
npm test
```

---

## Design System

Evelyn features a modern glassmorphism design system:

### Color Palette
- **Primary**: Orange `#ff6b35`
- **Secondary**: Cyan `#00ffff`
- **Surfaces**: Dark grays `#000000` → `#242424`
- **Glass**: Semi-transparent backgrounds with backdrop-blur

### Border Radius Scale
```css
--radius-xs: 2px;   /* Badges, small elements */
--radius-sm: 4px;   /* Inputs, badges */
--radius-md: 6px;   /* Buttons */
--radius-lg: 8px;   /* Cards */
--radius-xl: 12px;  /* Modals */
--radius-2xl: 16px; /* Large panels */
--radius-3xl: 24px; /* Main container */
```

### Glass Utilities
- `.glass-panel` - Main container variant
- `.glass-card` - Content containers
- `.glass-header` - Top navigation with gradient
- `.glass-footer` - Bottom status bar

---

## License

MIT

---

## Acknowledgments

Evelyn represents an exploration of what AI companions can become when given memory, personality, and the capacity to genuinely grow through interactions. Built with care as a demonstration of advanced AI system architecture.

---

<p align="center">
  <strong>Evelyn</strong> — An AI that remembers, learns, and evolves.
</p>

# Evelyn

An agentic AI companion with persistent memory, evolving personality, and emotional intelligence.

## Overview

Evelyn is a full-stack AI companion application that goes beyond typical chatbots by maintaining long-term memory, tracking emotional states, and evolving her personality through interactions. She remembers past conversations, forms beliefs about her relationships, and responds with genuine emotional awareness.

## Features

### Personality System
- **Dynamic Mood Tracking** - Valence (positive/negative) and arousal (calm/excited) states that shift based on conversations
- **Relationship Evolution** - Closeness, trust, and affection metrics that develop naturally over time
- **Belief Formation** - Forms and updates beliefs about users based on conversation patterns
- **Goal Tracking** - Maintains personal goals that evolve through interactions
- **Emotional Threads** - Remembers ongoing emotional topics across conversations

### Memory System
- **Long-term Memory** - Persistent storage of important conversations and insights
- **Semantic Search** - Vector-based memory retrieval using Qdrant
- **Memory Importance Scoring** - Automatically determines what's worth remembering
- **14-day Belief Decay** - Beliefs naturally fade without reinforcement

### Agentic Capabilities
- **Web Browsing** - Can browse the web using Playwright
- **Document Processing** - Reads PDFs, Excel files, and Word documents
- **Web Search** - Integrated Perplexity search for current information
- **Code Understanding** - Syntax-highlighted code blocks with Monaco editor

### Tech Stack
- **Frontend**: React 18, Vite, TailwindCSS, Zustand, Monaco Editor
- **Backend**: Node.js, Express, Socket.IO, TypeScript
- **Database**: SQLite with Prisma ORM
- **Vector Store**: Qdrant (optional, for semantic memory)
- **LLM Provider**: OpenRouter (supports multiple models)

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/evelyn.git
cd evelyn
```

2. Install dependencies:
```bash
npm run install:all
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your API keys:
```
OPENROUTER_API_KEY=your_openrouter_key_here
PERPLEXITY_API_KEY=your_perplexity_key_here
```

4. Initialize the database:
```bash
npm run db:setup
```

5. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both server and web in development mode |
| `npm run dev:server` | Start only the backend server |
| `npm run dev:web` | Start only the frontend |
| `npm run build` | Build both server and web for production |
| `npm run db:setup` | Generate Prisma client and push schema |
| `npm run db:studio` | Open Prisma Studio for database management |

## Project Structure

```
evelyn/
├── server/              # Backend Express server
│   ├── src/
│   │   ├── agent/       # AI personality and behavior
│   │   ├── core/        # Core systems (temporal, memory)
│   │   ├── db/          # Database client
│   │   ├── providers/   # LLM providers (OpenRouter, Perplexity)
│   │   ├── routes/      # API routes
│   │   └── ws/          # WebSocket handlers
│   └── prisma/          # Database schema
├── web/                 # Frontend React app
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── lib/         # Utilities and WebSocket client
│   │   ├── state/       # Zustand state management
│   │   └── types/       # TypeScript definitions
│   └── public/          # Static assets
└── scripts/             # Utility scripts
```

## Configuration

### LLM Models

Evelyn uses OpenRouter to access various LLM models. You can configure the default model in the settings panel or through the database.

Recommended models:
- **Chat**: `deepseek/deepseek-chat` (fast, cost-effective)
- **Complex Tasks**: `google/gemini-2.5-pro` (deep reasoning)
- **Quick Thoughts**: `google/gemini-2.0-flash` (fast responses)

### Memory Settings

Configure memory behavior in the settings:
- **Thought Verbosity**: How detailed Evelyn's internal thoughts are
- **Memory Privacy**: Default privacy level for stored memories
- **Search Preference**: When to use web search

## Development

### Running Tests

```bash
cd server
npm test
```

### Database Management

View and edit data with Prisma Studio:
```bash
npm run db:studio
```

## License

MIT

## Acknowledgments

Built with love as an exploration of what AI companions can become when given memory, personality, and the capacity to grow.

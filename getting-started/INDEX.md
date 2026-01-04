# 📚 NLAP Getting Started - Complete Index

Welcome to the NLAP Getting Started guide! This folder contains everything you need to go from zero to a working NLAP application.

## 📖 Start Here

**New to NLAP?** Read these in order:

1. **[QUICKSTART.md](./QUICKSTART.md)** ⚡ (2 minutes)
   - Fastest path to seeing NLAP work
   - Run your first example immediately
   - Perfect if you want to see results NOW

2. **[GETTING_STARTED.md](./GETTING_STARTED.md)** 📖 (15 minutes)
   - Complete step-by-step tutorial
   - Detailed explanations of concepts
   - Working examples with code breakdown
   - Your main learning resource

3. **[README.md](./README.md)** 📋 (5 minutes)
   - Overview of all examples
   - File structure explanation
   - Quick reference guide

## 📂 Folder Structure

```
getting-started/
│
├── 📖 Documentation
│   ├── INDEX.md                    ← You are here!
│   ├── QUICKSTART.md              ← 2-minute quick start
│   ├── GETTING_STARTED.md         ← Main tutorial (start here!)
│   └── README.md                  ← Overview
│
├── ⚙️ Configuration
│   ├── package.json               ← Dependencies
│   ├── tsconfig.json              ← TypeScript config
│   ├── .env.example               ← Environment template
│   └── .gitignore                 ← Git ignore rules
│
├── 💡 Examples (Ordered by Complexity)
│   ├── minimal-example.ts         ← Simplest possible (40 lines)
│   ├── simple-task-example.ts     ← Task manager (120 lines)
│   └── complete-example/          ← Production-ready API
│       ├── index.ts              ← Express server
│       ├── actions.ts            ← Action definitions
│       ├── package.json          ← Dependencies
│       ├── tsconfig.json         ← TypeScript config
│       ├── .env.example          ← Environment template
│       └── README.md             ← Complete example docs
│
└── 🔧 Tools
    └── test-examples.sh           ← Test runner script
```

## 🎯 Examples Overview

### 1. Minimal Example (`minimal-example.ts`)

**What it does:** The absolute simplest NLAP setup

**Features:**
- Single action (greet user)
- Basic engine configuration
- ~40 lines of code

**Use when:** You want to understand core NLAP concepts

**Run it:**
```bash
npm run minimal
```

**Example input:** "Say hello to Alice"
**Example output:**
```json
{
  "actionId": "greet",
  "args": { "name": "Alice" }
}
```

---

### 2. Simple Task Example (`simple-task-example.ts`)

**What it does:** Complete task management application

**Features:**
- Create, list, and complete tasks
- In-memory storage
- Multiple actions
- ~120 lines of code

**Use when:** You want to build a real application

**Run it:**
```bash
npm run simple
```

**Example commands:**
- "Create a task to review budget by Friday"
- "Show me all my tasks"
- "Mark the budget task as done"

---

### 3. Complete Example (`complete-example/`)

**What it does:** Production-ready REST API

**Features:**
- Express.js server
- Full CRUD operations
- Multi-turn conversations
- Error handling
- Database-ready architecture
- ~250 lines of code

**Use when:** You're ready to deploy to production

**Run it:**
```bash
cd complete-example
npm install
npm start
```

**Try it:**
```bash
curl -X POST http://localhost:3000/api/nlap \
  -H "Content-Type: application/json" \
  -d '{"input": "Create a task to review budget", "userId": "user_123"}'
```

## 🚀 Quick Start Commands

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Run examples
npm run minimal          # Simplest example
npm run simple           # Task manager
npm run complete         # API server (in complete-example/)

# Test all examples
./test-examples.sh
```

## 📚 Learning Path

We recommend this order:

### Step 1: Quick Start (5 minutes)
- Read [QUICKSTART.md](./QUICKSTART.md)
- Run `npm run minimal`
- See NLAP in action

### Step 2: Learn Concepts (20 minutes)
- Read [GETTING_STARTED.md](./GETTING_STARTED.md)
- Understand the architecture
- Follow the tutorial

### Step 3: Build Something (30 minutes)
- Run `npm run simple`
- Study the code
- Modify it for your use case

### Step 4: Deploy (60 minutes)
- Explore `complete-example/`
- Add your domain logic
- Deploy to production

## 🎓 What You'll Learn

By completing these examples, you'll know how to:

- ✅ Install and configure NLAP
- ✅ Create action registries
- ✅ Define actions with Zod schemas
- ✅ Set up the NLAP engine
- ✅ Process natural language input
- ✅ Execute actions and handle results
- ✅ Build production-ready APIs
- ✅ Handle multi-turn conversations
- ✅ Implement error handling
- ✅ Deploy NLAP applications

## 🔍 Finding What You Need

### I want to...

**...see NLAP work in 2 minutes**
→ [QUICKSTART.md](./QUICKSTART.md)

**...understand how NLAP works**
→ [GETTING_STARTED.md](./GETTING_STARTED.md)

**...build a simple app**
→ [simple-task-example.ts](./simple-task-example.ts)

**...build a production API**
→ [complete-example/](./complete-example/)

**...understand the code**
→ [GETTING_STARTED.md - Understanding the Code](./GETTING_STARTED.md#understanding-the-code)

**...troubleshoot issues**
→ [GETTING_STARTED.md - Common Issues](./GETTING_STARTED.md#common-issues)

**...see API examples**
→ [complete-example/README.md](./complete-example/README.md)

**...add more actions**
→ [GETTING_STARTED.md - Next Steps](./GETTING_STARTED.md#next-steps)

## 🛠️ Prerequisites

Before starting, ensure you have:

- ✅ **Node.js 18+** - [Download](https://nodejs.org/)
- ✅ **npm or yarn** - Comes with Node.js
- ✅ **Anthropic API Key** - [Get one](https://console.anthropic.com/)
- ✅ **20 minutes** - To follow along

### Verify Installation

```bash
node --version    # Should show v18.0.0 or higher
npm --version     # Should show 8.0.0 or higher
```

## 📦 What's Installed

When you run `npm install`, you get:

- **@nlap/core** - Main NLAP engine
- **@nlap/providers** - LLM providers (Claude, OpenAI, Ollama)
- **@nlap/routers** - Action routing (Keyword, Embedding, Hybrid)
- **zod** - Schema validation
- **dotenv** - Environment variable management
- **tsx** - TypeScript execution
- **typescript** - TypeScript compiler

## 🎯 Success Criteria

You'll know you're successful when:

1. ✅ `npm run minimal` executes without errors
2. ✅ You see a structured action plan returned
3. ✅ You understand what each part does
4. ✅ You can modify an example for your use case

## 🆘 Getting Help

### Common Issues

**"API key not set"**
- Create `.env` file from `.env.example`
- Add your actual API key

**"Module not found"**
- Run `npm install` in the correct directory
- Check `node_modules` exists

**"TypeScript errors"**
- Run `npm run typecheck` to see details
- Ensure TypeScript is installed

**"Slow responses"**
- Normal for first request (model loading)
- Subsequent requests should be faster

### Resources

- 📖 [Main README](../README.md)
- 🏗️ [Architecture Guide](../docs/NLAP_Architecture_Complete.md)
- 📝 [More Examples](../docs/examples/)
- 🐛 [Report Issues](https://github.com/yourusername/nlap-typescript-library/issues)

## 🚦 Next Steps After Completion

Once you've completed all examples:

1. **Customize for Your Domain**
   - Define your own actions
   - Create your context type
   - Add validation schemas

2. **Add Advanced Features**
   - Multi-turn conversations
   - Action dependencies
   - Dynamic schemas
   - Custom routers

3. **Integrate with Your Stack**
   - Connect to your database
   - Add authentication
   - Implement webhooks
   - Add monitoring

4. **Deploy to Production**
   - Set up CI/CD
   - Add error tracking
   - Implement rate limiting
   - Scale with load balancers

## 📊 Time Estimates

| Activity | Time | File |
|----------|------|------|
| Quick Start | 2 min | QUICKSTART.md |
| Read Tutorial | 15 min | GETTING_STARTED.md |
| Run Minimal Example | 2 min | minimal-example.ts |
| Run Task Example | 3 min | simple-task-example.ts |
| Study Code | 20 min | All examples |
| Run Complete Example | 5 min | complete-example/ |
| Customize for Your Use | 60 min | Your code |
| **Total** | **~2 hours** | **From zero to deployed** |

## 🎉 You're Ready!

Pick your starting point:

- **⚡ Fastest path:** [QUICKSTART.md](./QUICKSTART.md)
- **📖 Complete guide:** [GETTING_STARTED.md](./GETTING_STARTED.md)
- **💡 Jump to code:** [minimal-example.ts](./minimal-example.ts)

**Happy building!** 🚀

---

*Last updated: 2026-01-04*
*NLAP Version: 0.4.0*

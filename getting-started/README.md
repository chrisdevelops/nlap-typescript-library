# NLAP Getting Started Examples

This folder contains everything you need to get started with NLAP, from installation to your first working application.

## Quick Links

- **[📖 Complete Getting Started Guide](./GETTING_STARTED.md)** - Start here!
- **[⚡ Minimal Example](./minimal-example.ts)** - Simplest possible NLAP setup
- **[📝 Task Manager Example](./simple-task-example.ts)** - Working task management app
- **[🚀 Complete Example](./complete-example/)** - Production-ready application

## Files in This Folder

```
getting-started/
├── GETTING_STARTED.md          # 📖 Main guide - read this first
├── README.md                   # 👈 You are here
├── minimal-example.ts          # Simplest example (5 lines of setup)
├── simple-task-example.ts      # Working task manager
├── complete-example/           # Full application
│   ├── index.ts               # Express server
│   ├── actions.ts             # Action definitions
│   └── README.md              # Setup instructions
├── package.json                # Dependencies
├── tsconfig.json              # TypeScript config
└── .env.example               # Environment variables template
```

## Quick Start (2 minutes)

If you just want to see NLAP in action RIGHT NOW:

```bash
# 1. Clone/navigate to this folder
cd getting-started

# 2. Install dependencies
npm install

# 3. Set up your API key
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# 4. Run the minimal example
npm run minimal
```

## What's Inside

### 1. Minimal Example (`minimal-example.ts`)

The absolute simplest NLAP setup - just 40 lines of code:
- 1 action (greet user)
- Basic engine setup
- Single natural language request

**Perfect for:** Understanding core concepts

```bash
npm run minimal
```

### 2. Simple Task Example (`simple-task-example.ts`)

A working task management application:
- Create, list, and complete tasks
- In-memory storage
- Multiple natural language commands
- ~120 lines of code

**Perfect for:** Building your first real application

```bash
npm run simple
```

### 3. Complete Example (`complete-example/`)

Production-ready application with:
- Express.js REST API
- Database integration
- Error handling
- Multi-turn conversations
- Full CRUD operations

**Perfect for:** Real-world deployment

```bash
npm run complete
```

## Learning Path

We recommend following this order:

1. **Read**: [GETTING_STARTED.md](./GETTING_STARTED.md) (15 minutes)
2. **Run**: `minimal-example.ts` (2 minutes)
3. **Study**: `simple-task-example.ts` (10 minutes)
4. **Experiment**: Modify the examples (30 minutes)
5. **Build**: Use the complete example as a template (ongoing)

## Prerequisites

Before starting, make sure you have:

- ✅ Node.js 18+ installed
- ✅ npm or yarn
- ✅ Anthropic API key ([Get one here](https://console.anthropic.com/))
- ✅ 20 minutes to follow along

## Installation

From this directory:

```bash
# Install all dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env and add your API key
nano .env  # or use your favorite editor
```

## Running Examples

```bash
# Minimal example (fastest)
npm run minimal

# Task manager example
npm run simple

# Complete application
npm run complete
```

## Troubleshooting

### "API Key Not Set" Error

Make sure you:
1. Created a `.env` file (copy from `.env.example`)
2. Added your API key: `ANTHROPIC_API_KEY=sk-ant-...`
3. The `.env` file is in the same directory as the script

### Module Not Found Errors

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors

Make sure `tsconfig.json` is present and run:

```bash
npx tsc --noEmit  # Check for type errors
```

## Next Steps

After completing these examples:

1. **Customize**: Modify the actions to fit your domain
2. **Expand**: Add more actions to the registry
3. **Integrate**: Connect to your database
4. **Deploy**: Use the complete example as a template
5. **Learn More**: Check out the [main docs](../docs/)

## Support

- 📖 [Main Documentation](../README.md)
- 🐛 [Report Issues](https://github.com/yourusername/nlap-typescript-library/issues)
- 💡 [Architecture Guide](../docs/NLAP_Architecture_Complete.md)
- 📝 [More Examples](../docs/examples/)

## What You'll Learn

By completing these examples, you'll know how to:

- ✅ Install and configure NLAP
- ✅ Create action registries
- ✅ Define actions with Zod schemas
- ✅ Set up the NLAP engine
- ✅ Process natural language input
- ✅ Execute actions and handle results
- ✅ Build production-ready applications

**Happy building!** 🚀

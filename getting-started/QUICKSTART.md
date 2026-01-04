# NLAP Quick Start (2 Minutes)

Want to see NLAP in action immediately? Follow these steps:

## Prerequisites

- Node.js 18+ installed
- Anthropic API key ([Get one free](https://console.anthropic.com/))

## Steps

### 1. Navigate to this folder

```bash
cd getting-started
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up your API key

```bash
# Copy the example env file
cp .env.example .env

# Edit .env and add your API key
# Change: ANTHROPIC_API_KEY=your_api_key_here
# To: ANTHROPIC_API_KEY=sk-ant-your-actual-key
```

### 4. Run the minimal example

```bash
npm run minimal
```

**Expected output:**
```
Input: "Say hello to Alice"

Planned Actions:
[
  {
    "actionId": "greet",
    "args": {
      "name": "Alice"
    },
    "confidence": 0.95
  }
]

Duration: 1234 ms
```

## 🎉 Success!

You just processed your first natural language request with NLAP!

## What Just Happened?

1. You sent: `"Say hello to Alice"`
2. NLAP parsed it and identified the action: `greet`
3. NLAP extracted the argument: `name: "Alice"`
4. NLAP returned a structured plan ready to execute

## Next Steps

### Try the Task Manager Example

```bash
npm run simple
```

This runs a more complete example with task creation, listing, and completion.

### Try the Complete API Server

```bash
cd complete-example
npm install
npm start
```

Then in another terminal:

```bash
curl -X POST http://localhost:3000/api/nlap \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Create a task to review budget",
    "userId": "user_123"
  }'
```

### Read the Full Guide

For a comprehensive walkthrough, read [GETTING_STARTED.md](./GETTING_STARTED.md)

## Troubleshooting

### "API key not set" error

Make sure:
1. You created the `.env` file
2. You added your actual API key (starts with `sk-ant-`)
3. The `.env` file is in the `getting-started` folder

### "Module not found" errors

```bash
# Delete and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Still having issues?

Check the [full troubleshooting guide](./GETTING_STARTED.md#common-issues) in GETTING_STARTED.md

---

**Time to completion: ~2 minutes** ⏱️

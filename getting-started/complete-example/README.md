# Complete NLAP Example - Task Manager API

A production-ready NLAP application with Express.js REST API, complete CRUD operations, and multi-turn conversation support.

## Features

- ✅ **REST API** - Express.js server with proper routing
- ✅ **Full CRUD** - Create, Read, Update, Delete tasks
- ✅ **Multi-Turn Memory** - Conversations remember context
- ✅ **Error Handling** - Comprehensive error handling
- ✅ **Hybrid Router** - Fast keyword + embedding routing
- ✅ **Auto Repair** - Automatic validation error fixes
- ✅ **Database Ready** - Easy to swap in real database

## Quick Start

### 1. Install Dependencies

```bash
cd complete-example
npm install
```

### 2. Configure Environment

```bash
# Create .env file
cp ../.env.example .env

# Edit .env and add your API key
nano .env
```

Your `.env` should contain:
```
ANTHROPIC_API_KEY=your_api_key_here
```

### 3. Start the Server

```bash
npm start
```

You should see:
```
🚀 Initializing NLAP engine...
✓ NLAP engine ready
✓ Registered 5 actions

============================================================
🚀 NLAP Task Manager API running on port 3000
============================================================

Endpoints:
  POST   http://localhost:3000/api/nlap
  GET    http://localhost:3000/api/actions
  GET    http://localhost:3000/api/tasks/:userId
  GET    http://localhost:3000/health
```

## API Endpoints

### POST /api/nlap

Process natural language input.

**Request:**
```json
{
  "input": "Create a task to review budget by Friday",
  "userId": "user_123",
  "conversationId": "optional_conv_id"
}
```

**Response:**
```json
{
  "type": "success",
  "plan": [
    {
      "action": "tasks.create",
      "args": {
        "title": "Review budget",
        "dueDate": "2026-01-10T17:00:00Z"
      },
      "confidence": 0.95
    }
  ],
  "execution": {
    "succeeded": 1,
    "failed": 0,
    "results": [
      {
        "callId": "call_abc123",
        "success": true,
        "data": {
          "id": "task_123",
          "title": "Review budget",
          "status": "todo",
          "dueDate": "2026-01-10T17:00:00.000Z"
        }
      }
    ]
  },
  "conversationId": "optional_conv_id",
  "duration": 1245
}
```

### GET /api/actions

List all available actions.

**Response:**
```json
{
  "actions": [
    {
      "id": "tasks.create",
      "description": "Create a new task...",
      "tags": ["tasks", "create"]
    }
  ],
  "count": 5
}
```

### GET /api/tasks/:userId

Get all tasks for a user.

**Response:**
```json
{
  "tasks": [
    {
      "id": "task_123",
      "title": "Review budget",
      "status": "todo",
      "userId": "user_123",
      "createdAt": "2026-01-04T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "nlap-task-manager",
  "timestamp": "2026-01-04T10:00:00.000Z"
}
```

## Usage Examples

### Using curl

```bash
# Create a task
curl -X POST http://localhost:3000/api/nlap \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Create a task to review the budget by Friday",
    "userId": "user_123"
  }'

# List tasks
curl -X POST http://localhost:3000/api/nlap \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Show me all my tasks",
    "userId": "user_123"
  }'

# Complete a task
curl -X POST http://localhost:3000/api/nlap \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Mark the budget task as done",
    "userId": "user_123"
  }'

# Update a task
curl -X POST http://localhost:3000/api/nlap \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Change the budget task due date to next Monday",
    "userId": "user_123"
  }'

# Delete a task
curl -X POST http://localhost:3000/api/nlap \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Delete the budget task",
    "userId": "user_123"
  }'
```

### Using JavaScript/fetch

```javascript
async function sendCommand(input, userId) {
  const response = await fetch('http://localhost:3000/api/nlap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, userId }),
  });

  return await response.json();
}

// Example usage
const result = await sendCommand(
  'Create a task to call John tomorrow',
  'user_123'
);

console.log(result);
```

### Multi-Turn Conversations

```bash
# Turn 1: Start a conversation
curl -X POST http://localhost:3000/api/nlap \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Create a task",
    "userId": "user_123",
    "conversationId": "conv_1"
  }'

# Response: { "type": "clarification", "question": "What should the task be?" }

# Turn 2: Continue the conversation
curl -X POST http://localhost:3000/api/nlap \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Call the client tomorrow at 2pm",
    "userId": "user_123",
    "conversationId": "conv_1"
  }'

# Response: Task created with title and due date
```

## Available Actions

The API supports these natural language operations:

### Create Tasks
- "Create a task to review the budget"
- "Add a task to call John tomorrow"
- "Remind me to send the report by Friday at 5pm"

### List Tasks
- "Show me all my tasks"
- "List my todo tasks"
- "What tasks are done?"

### Update Tasks
- "Mark the budget task as done"
- "Change the client call to Wednesday"
- "Update the report task description to include Q4 data"

### Delete Tasks
- "Delete the budget task"
- "Remove the task about calling John"

### Complete Tasks
- "Mark the budget review as complete"
- "I finished the report task"

## Project Structure

```
complete-example/
├── index.ts       # Express server and API routes
├── actions.ts     # Action definitions and database
├── package.json   # Dependencies
└── README.md      # This file
```

## Customization

### Add a Real Database

Replace the in-memory database in `actions.ts`:

```typescript
import { Pool } from 'pg';

export function createPostgresDatabase(pool: Pool): Database {
  return {
    tasks: {
      async create(data: Partial<Task>): Promise<Task> {
        const result = await pool.query(
          'INSERT INTO tasks (title, description, user_id) VALUES ($1, $2, $3) RETURNING *',
          [data.title, data.description, data.userId]
        );
        return result.rows[0];
      },
      // ... implement other methods
    },
  };
}
```

### Add Authentication

```typescript
import jwt from 'jsonwebtoken';

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/api/nlap', authMiddleware, async (req, res) => {
  // Use req.userId instead of req.body.userId
});
```

### Add More Actions

In `actions.ts`:

```typescript
// Add project management
registry.register({
  id: 'projects.create',
  description: 'Create a new project',
  argsSchema: z.object({
    name: z.string(),
    description: z.string().optional(),
  }),
  handler: async (args, ctx) => {
    // Implementation
  },
  tags: ['projects', 'create'],
});
```

### Add Webhooks

```typescript
// After successful execution
if (result.execution?.succeeded) {
  await fetch(webhookUrl, {
    method: 'POST',
    body: JSON.stringify({
      event: 'task.created',
      data: result.execution.results,
    }),
  });
}
```

## Development

### Watch Mode

Auto-restart on file changes:

```bash
npm run dev
```

### Type Checking

```bash
npm run typecheck
```

### Build for Production

```bash
npm run build
node dist/index.js
```

## Deployment

### Using Docker

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

Build and run:

```bash
docker build -t nlap-api .
docker run -p 3000:3000 -e ANTHROPIC_API_KEY=your_key nlap-api
```

### Using Environment Variables

For production, use environment variables:

```bash
export ANTHROPIC_API_KEY=your_key
export PORT=8080
export NODE_ENV=production
npm start
```

## Troubleshooting

### Server Won't Start

- Check that port 3000 is available: `lsof -i :3000`
- Verify API key is set: `echo $ANTHROPIC_API_KEY`
- Check for TypeScript errors: `npm run typecheck`

### Slow Response Times

- Use HybridRouter (already configured)
- Reduce `maxCandidates` in engine options
- Enable response caching
- Use a faster LLM model

### Memory Issues

- Reduce `workingMemoryTurns` (default: 5)
- Implement conversation cleanup
- Use Redis for conversation storage

## Next Steps

- ✅ Add authentication
- ✅ Connect to a real database
- ✅ Implement rate limiting
- ✅ Add request logging
- ✅ Set up monitoring
- ✅ Write integration tests
- ✅ Deploy to production

## Support

- Main Documentation: [../GETTING_STARTED.md](../GETTING_STARTED.md)
- Examples: [../../docs/examples/](../../docs/examples/)
- Issues: [GitHub Issues](https://github.com/yourusername/nlap-typescript-library/issues)

---

**Built with NLAP** 🚀

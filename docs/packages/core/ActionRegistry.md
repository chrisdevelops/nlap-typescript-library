# ActionRegistry

Central registry for managing all available actions in your NLAP application.

## Class: `ActionRegistry<TContext>`

```typescript
class ActionRegistry<TContext extends BaseContext = BaseContext>
```

## Constructor

```typescript
new ActionRegistry<TContext>()
```

**Parameters:** None

**Example:**
```typescript
interface AppContext extends BaseContext {
  db: Database;
  userId: string;
}

const registry = new ActionRegistry<AppContext>();
```

## Methods

### `register()`

Register a new action in the registry.

```typescript
register<TName extends string, TInput, TOutput>(
  action: ActionDefinition<TName, TInput, TOutput, TContext>
): this
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action.id` | `string` | ✅ Required | Unique action identifier (e.g., 'tasks.create') |
| `action.description` | `string` | ✅ Required | Human-readable description for LLM |
| `action.argsSchema` | `ZodType<TInput>` or `(ctx) => ZodType<TInput>` | ✅ Required | Zod schema for input validation (static or dynamic) |
| `action.handler` | `(args, ctx) => Promise<TOutput>` | ❌ Optional | Async function to execute the action |
| `action.tags` | `string[]` | ❌ Optional | Tags for categorization (e.g., ['tasks', 'create']) |
| `action.dependencies` | `string[]` | ❌ Optional | Action IDs that must execute before this one |
| `action.priority` | `number` | ❌ Optional | Execution priority (0-100, higher = earlier) |
| `action.compensate` | `(args, result, ctx) => Promise<void>` | ❌ Optional | Rollback function for failed transactions |
| `action.retry` | `RetryConfig` | ❌ Optional | Retry configuration for failed executions |
| `action.risk` | `'low' \| 'medium' \| 'high'` | ❌ Optional | Risk level for confirmation prompts |
| `action.examples` | `Array<{input: string, args: TInput}>` | ❌ Optional | Few-shot examples for LLM |

**Returns:** `this` (for chaining)

**Errors:**
- Throws if action ID is missing or invalid
- Throws if action ID already registered
- Throws if description or schema is missing
- Throws if dependencies reference unregistered actions
- Throws if circular dependencies are detected

**Basic Example:**
```typescript
registry.register({
  id: 'tasks.create',
  description: 'Create a new task with a title and optional due date',
  argsSchema: z.object({
    title: z.string().describe('Task title'),
    dueDate: z.string().datetime().optional().describe('ISO 8601 due date'),
  }),
  handler: async (args, ctx) => {
    const task = await ctx.appContext.db.tasks.create({
      title: args.title,
      dueDate: args.dueDate,
      userId: ctx.appContext.userId,
    });
    return task;
  },
  tags: ['tasks', 'create'],
});
```

**Dynamic Schema Example:**
```typescript
registry.register({
  id: 'tasks.assign',
  description: 'Assign a task to a project',
  // Schema depends on runtime context
  argsSchema: async (ctx) => {
    const validProjects = await ctx.db.projects.listIds(ctx.tenantId);
    return z.object({
      taskId: z.string(),
      projectId: z.enum(validProjects), // Validated at runtime!
    });
  },
  handler: async (args, ctx) => {
    return await ctx.appContext.db.tasks.update(args.taskId, {
      projectId: args.projectId,
    });
  },
});
```

**With Dependencies Example:**
```typescript
// First action
registry.register({
  id: 'character.create',
  description: 'Create a character',
  argsSchema: z.object({ name: z.string() }),
  handler: async (args) => {
    return { id: generateId(), name: args.name };
  },
});

// Dependent action
registry.register({
  id: 'character.place',
  description: 'Place a character at a location',
  dependencies: ['character.create'], // Must run after character.create
  argsSchema: z.object({
    characterName: z.string(),
    locationId: z.string(),
  }),
  handler: async (args, ctx) => {
    // Access previous results
    const char = ctx.previousResults.get('character.create')?.result;
    return await ctx.appContext.db.placements.create({
      characterId: char.id,
      locationId: args.locationId,
    });
  },
});
```

**With Compensation Example:**
```typescript
registry.register({
  id: 'payment.charge',
  description: 'Charge a credit card',
  argsSchema: z.object({
    amount: z.number(),
    cardToken: z.string(),
  }),
  handler: async (args) => {
    const charge = await stripe.charges.create({
      amount: args.amount,
      source: args.cardToken,
    });
    return { chargeId: charge.id };
  },
  // Rollback if later actions fail
  compensate: async (args, result, ctx) => {
    await stripe.refunds.create({ charge: result.chargeId });
  },
});
```

**With Retry Example:**
```typescript
registry.register({
  id: 'email.send',
  description: 'Send an email',
  argsSchema: z.object({
    to: z.string().email(),
    subject: z.string(),
    body: z.string(),
  }),
  handler: async (args) => {
    return await emailService.send(args);
  },
  retry: {
    maxAttempts: 3,
    backoff: 'exponential',
    delayMs: 1000, // 1s, 2s, 4s
  },
});
```

### `get()`

Retrieve an action by ID.

```typescript
get(actionId: string): ActionDefinition | undefined
```

**Parameters:**
- `actionId: string` - Action identifier

**Returns:** `ActionDefinition` or `undefined` if not found

**Example:**
```typescript
const action = registry.get('tasks.create');
if (action) {
  console.log(action.description);
}
```

### `list()`

Get all registered actions.

```typescript
list(): ActionDefinition[]
```

**Returns:** Array of all registered actions

**Example:**
```typescript
const allActions = registry.list();
console.log(`Total actions: ${allActions.length}`);
```

### `getByTag()`

Get actions with a specific tag.

```typescript
getByTag(tag: string): ActionDefinition[]
```

**Parameters:**
- `tag: string` - Tag to filter by

**Returns:** Array of actions with the tag

**Example:**
```typescript
const taskActions = registry.getByTag('tasks');
console.log(`Task actions: ${taskActions.map(a => a.id).join(', ')}`);
```

### `getByTags()`

Get actions that have ALL specified tags (intersection).

```typescript
getByTags(tags: string[]): ActionDefinition[]
```

**Parameters:**
- `tags: string[]` - Tags to filter by (AND operation)

**Returns:** Array of actions with all tags

**Example:**
```typescript
const createActions = registry.getByTags(['tasks', 'create']);
// Returns only actions with both 'tasks' AND 'create' tags
```

### `getDependents()`

Get actions that depend on a given action.

```typescript
getDependents(actionId: string): string[]
```

**Parameters:**
- `actionId: string` - Action ID to find dependents for

**Returns:** Array of action IDs that depend on this action

**Example:**
```typescript
const dependents = registry.getDependents('character.create');
// ['character.place', 'relationship.create']
```

### `lock()`

Lock the registry to prevent further registrations.

```typescript
lock(): void
```

**Use Case:** Lock after initial setup to prevent runtime modifications

**Example:**
```typescript
// Register all actions
registry.register({/* ... */});
registry.register({/* ... */});

// Lock to prevent changes
registry.lock();

// This will now throw an error
registry.register({/* ... */}); // Error!
```

### `isLocked()`

Check if the registry is locked.

```typescript
isLocked(): boolean
```

**Returns:** `true` if locked, `false` otherwise

**Example:**
```typescript
if (!registry.isLocked()) {
  registry.register({/* ... */});
}
```

## Type Definitions

### `ActionDefinition<TName, TInput, TOutput, TContext>`

```typescript
interface ActionDefinition<
  TName extends string,
  TInput,
  TOutput,
  TContext extends BaseContext
> {
  id: TName;
  description: string;
  argsSchema: ZodType<TInput> | ((ctx: TContext) => ZodType<TInput> | Promise<ZodType<TInput>>);
  handler?: (args: TInput, ctx: ExecutionContext<TContext>) => Promise<TOutput>;
  tags?: string[];
  dependencies?: TName[];
  priority?: number;
  compensate?: (args: TInput, result: TOutput, ctx: ExecutionContext<TContext>) => Promise<void>;
  retry?: RetryConfig;
  risk?: 'low' | 'medium' | 'high';
  examples?: Array<{ input: string; args: TInput }>;
}
```

### `RetryConfig`

```typescript
interface RetryConfig {
  maxAttempts: number;         // How many times to retry
  backoff: 'linear' | 'exponential';  // Backoff strategy
  delayMs: number;             // Base delay in milliseconds
}
```

## Best Practices

1. **Use Descriptive IDs**: Use dot notation for namespacing (`tasks.create`, `users.invite`)
2. **Write Clear Descriptions**: LLM uses these to understand when to use the action
3. **Add Schema Descriptions**: Use `.describe()` on Zod fields for better LLM guidance
4. **Tag Consistently**: Use consistent tag names across related actions
5. **Handle Errors**: Add retry config for network-dependent operations
6. **Document Dependencies**: Clearly document why dependencies are needed
7. **Test Edge Cases**: Validate circular dependencies don't creep in

## Common Patterns

### Conditional Actions

```typescript
// Only register if feature enabled
if (features.enablePayments) {
  registry.register({
    id: 'payment.process',
    // ...
  });
}
```

### Bulk Registration

```typescript
const actions = [
  { id: 'tasks.create', description: '...', argsSchema: z.object({}) },
  { id: 'tasks.list', description: '...', argsSchema: z.object({}) },
  { id: 'tasks.update', description: '...', argsSchema: z.object({}) },
];

actions.forEach(action => registry.register(action));
```

### Type-Safe Registration

```typescript
// Define types for better type safety
type TaskCreateInput = {
  title: string;
  dueDate?: string;
};

type TaskCreateOutput = {
  id: string;
  title: string;
  createdAt: Date;
};

registry.register<'tasks.create', TaskCreateInput, TaskCreateOutput>({
  id: 'tasks.create',
  description: 'Create a task',
  argsSchema: z.object({
    title: z.string(),
    dueDate: z.string().datetime().optional(),
  }),
  handler: async (args, ctx): Promise<TaskCreateOutput> => {
    // args is typed as TaskCreateInput
    // return type is enforced as TaskCreateOutput
    return await ctx.appContext.db.tasks.create(args);
  },
});
```

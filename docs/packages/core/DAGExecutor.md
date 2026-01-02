# DAGExecutor

Executes action plans with dependency-ordered execution, parallel processing, retry logic, and compensation/rollback.

## Class: `DAGExecutor<TContext>`

```typescript
class DAGExecutor<TContext extends BaseContext = BaseContext> implements Executor<TContext>
```

## Constructor

```typescript
new DAGExecutor<TContext>(
  registry: ActionRegistry<TContext>,
  config?: DAGExecutorConfig
)
```

**Required Parameters:**
- `registry: ActionRegistry<TContext>` - Action registry to resolve handlers

**Optional Parameters:**
- `config?: DAGExecutorConfig` - Executor configuration

### DAGExecutorConfig

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enableCompensation` | `boolean` | `true` | Enable compensation/rollback on failure |
| `enableRetry` | `boolean` | `true` | Enable retry logic |
| `defaultRetry` | `RetryConfig` | `undefined` | Default retry config if action doesn't specify one |

**Example:**
```typescript
const executor = new DAGExecutor(registry, {
  enableCompensation: true,
  enableRetry: true,
  defaultRetry: {
    maxAttempts: 2,
    backoff: 'exponential',
    delayMs: 500,
  },
});
```

## Methods

### `execute()`

Execute a validated action plan.

```typescript
execute(
  plan: Plan,
  context: TContext
): Promise<ExecutionResult<TContext>>
```

**Parameters:**
- `plan: Plan` - Validated action plan from Pipeline
- `context: TContext` - Application context

**Returns:** `ExecutionResult<TContext>`

```typescript
interface ExecutionResult<TContext> {
  succeeded: number;              // Number of successful actions
  failed: number;                 // Number of failed actions
  results: Map<string, {          // Results keyed by call ID
    result: unknown;              // Action result (if succeeded)
    error?: Error;                // Error (if failed)
  }>;
}
```

**Example:**
```typescript
const result = await executor.execute(plan, {
  requestId: '123',
  db: myDatabase,
  userId: 'user_456',
});

console.log(`Succeeded: ${result.succeeded}, Failed: ${result.failed}`);

// Access individual results
for (const [callId, { result, error }] of result.results) {
  if (error) {
    console.error(`Action ${callId} failed:`, error);
  } else {
    console.log(`Action ${callId} result:`, result);
  }
}
```

## Features

### 1. Dependency-Ordered Execution

Actions with dependencies execute in the correct order automatically.

**Example:**
```typescript
// Action definitions
registry.register({
  id: 'user.create',
  argsSchema: z.object({ email: z.string().email() }),
  handler: async (args) => ({ id: '123', email: args.email }),
});

registry.register({
  id: 'subscription.create',
  dependencies: ['user.create'], // Runs after user.create
  argsSchema: z.object({ plan: z.string() }),
  handler: async (args, ctx) => {
    const user = ctx.previousResults.get('call_user')?.result;
    return await stripe.subscriptions.create({
      customer: user.id,
      plan: args.plan,
    });
  },
});

// DAGExecutor automatically:
// 1. Creates user first
// 2. Waits for completion
// 3. Passes result to subscription.create
// 4. Executes subscription.create
```

### 2. Parallel Execution

Independent actions execute in parallel for better performance.

**Example:**
```typescript
// These actions have no dependencies, so they run in parallel
registry.register({
  id: 'email.send',
  argsSchema: z.object({ to: z.string() }),
  handler: async (args) => sendEmail(args.to),
});

registry.register({
  id: 'slack.notify',
  argsSchema: z.object({ channel: z.string() }),
  handler: async (args) => notifySlack(args.channel),
});

// Plan with both actions executes them concurrently
const plan = {
  calls: [
    { callId: 'c1', actionId: 'email.send', args: { to: 'user@example.com' } },
    { callId: 'c2', actionId: 'slack.notify', args: { channel: '#general' } },
  ],
  // ... other plan fields
};

// Total time ≈ max(email.send, slack.notify), not sum
await executor.execute(plan, context);
```

### 3. Retry Logic

Failed actions automatically retry with configurable backoff.

**Exponential Backoff:**
```typescript
registry.register({
  id: 'api.call',
  argsSchema: z.object({ endpoint: z.string() }),
  handler: async (args) => fetch(args.endpoint),
  retry: {
    maxAttempts: 3,
    backoff: 'exponential',
    delayMs: 1000, // 1s, 2s, 4s
  },
});
```

**Linear Backoff:**
```typescript
registry.register({
  id: 'db.write',
  argsSchema: z.object({ data: z.any() }),
  handler: async (args) => db.insert(args.data),
  retry: {
    maxAttempts: 5,
    backoff: 'linear',
    delayMs: 500, // 500ms, 1s, 1.5s, 2s, 2.5s
  },
});
```

### 4. Compensation/Rollback

When an action fails, previously executed actions with compensation handlers are rolled back in reverse order.

**Example:**
```typescript
// Step 1: Reserve inventory
registry.register({
  id: 'inventory.reserve',
  argsSchema: z.object({ productId: z.string(), quantity: z.number() }),
  handler: async (args) => {
    return await db.inventory.reserve(args.productId, args.quantity);
  },
  compensate: async (args, result) => {
    // Rollback: unreserve if payment fails
    await db.inventory.unreserve(args.productId, args.quantity);
  },
});

// Step 2: Charge payment
registry.register({
  id: 'payment.charge',
  dependencies: ['inventory.reserve'],
  argsSchema: z.object({ amount: z.number() }),
  handler: async (args) => {
    // This fails!
    throw new Error('Card declined');
  },
  compensate: async (args, result) => {
    await stripe.refunds.create({ charge: result.chargeId });
  },
});

// Execution flow:
// 1. inventory.reserve succeeds ✓
// 2. payment.charge fails ✗
// 3. Compensation runs:
//    - inventory.reserve.compensate() is called
//    - Inventory is unreserved
// 4. Result: { succeeded: 1, failed: 1 }
```

**Disabling Compensation:**
```typescript
const executor = new DAGExecutor(registry, {
  enableCompensation: false, // No rollback
});
```

## Topological Sort Algorithm

DAGExecutor uses Kahn's algorithm to determine execution order:

1. **Build Dependency Graph** - Map action dependencies from registry
2. **Calculate In-Degrees** - Count dependencies for each action
3. **Create Batches** - Group actions with 0 in-degree (ready to execute)
4. **Execute Batch** - Run batch in parallel
5. **Update In-Degrees** - Decrease for dependent actions
6. **Repeat** - Until all actions executed

**Example Execution Order:**
```
Actions:
- A (no dependencies)
- B (no dependencies)
- C (depends on A)
- D (depends on A, B)

Execution:
Batch 1: [A, B]  ← Execute in parallel
Batch 2: [C]     ← Execute after A completes
Batch 3: [D]     ← Execute after A and B complete
```

## Error Handling

### Action Not Found
```typescript
// If action not in registry
const result = await executor.execute(plan, context);
// result.failed === 1
// result.results.get('callId').error.message === "Action not found in registry"
```

### Missing Handler
```typescript
// If action has no handler
registry.register({
  id: 'no.handler',
  argsSchema: z.object({}),
  // No handler!
});

const result = await executor.execute(plan, context);
// result.failed === 1
// result.results.get('callId').error.message === "Action has no handler"
```

### Execution Error
```typescript
registry.register({
  id: 'failing',
  argsSchema: z.object({}),
  handler: async () => {
    throw new Error('Something went wrong');
  },
});

const result = await executor.execute(plan, context);
// result.failed === 1
// result.results.get('callId').error.message === "Something went wrong"
```

## Performance Considerations

- **Parallel Execution**: Independent actions run concurrently
- **Batch Size**: Controlled by dependency graph, not a fixed limit
- **Retry Delays**: Use exponential backoff for external services
- **Compensation**: Only runs on failure, adds minimal overhead otherwise

## Integration with Pipeline

DAGExecutor is typically used via the Pipeline:

```typescript
const engine = createNLAPEngine({
  registry,
  router: myRouter,
  interpreter: myInterpreter,
  executor: new DAGExecutor(registry), // Enables execution
});

const result = await engine.interpret("create user and send welcome email", context);
// result.execution contains DAGExecutor results
```

## Best Practices

1. **Define Dependencies Clearly** - Use `dependencies` field for order requirements
2. **Add Compensation for Critical Operations** - Especially for payments, reservations
3. **Configure Retry for Network Calls** - API calls, database writes
4. **Keep Handlers Idempotent** - Safe to retry without side effects
5. **Handle Partial Failures** - Check `execution.failed` and act accordingly
6. **Monitor Compensation** - Log when rollbacks occur for debugging

## Common Patterns

### Transactional Workflow
```typescript
// All-or-nothing execution with compensation
const transactionalActions = [
  'payment.authorize',
  'inventory.reserve',
  'order.create',
  'email.send',
];

// Each action has compensation handler
// If any fails, all previous actions roll back
```

### Fire-and-Forget
```typescript
const executor = new DAGExecutor(registry, {
  enableCompensation: false,
  enableRetry: false,
});

// Quick execution without recovery
```

### Custom Retry Strategy
```typescript
const executor = new DAGExecutor(registry, {
  defaultRetry: {
    maxAttempts: 3,
    backoff: 'exponential',
    delayMs: 2000, // Applies to all actions without explicit retry
  },
});
```

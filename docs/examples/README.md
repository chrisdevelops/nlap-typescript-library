# NLAP Integration Examples

Real-world examples showing how to integrate NLAP into your applications.

## Available Examples

### 1. [Basic Task Manager](./basic-task-manager/README.md)
**Difficulty**: Beginner
**Concepts**: CRUD operations, Express.js integration, basic actions

A complete task management application with:
- Task creation, listing, updating, deletion
- Natural language processing
- Multi-turn conversations
- Database integration
- RESTful API

**Start here if you're new to NLAP.**

### 2. [E-Commerce Assistant](./e-commerce-assistant/README.md)
**Difficulty**: Advanced
**Concepts**: Dependencies, compensation, complex workflows

An e-commerce checkout flow with:
- Action dependencies (inventory → payment → order)
- Compensation/rollback on failure
- Dynamic schema validation
- Transactional guarantees
- Error recovery

**Recommended after mastering the basics.**

### 3. [Worldbuilding Assistant](./worldbuilding-assistant/README.md)
**Difficulty**: Intermediate
**Concepts**: Complex dependencies, graph-based workflows

A creative writing assistant with:
- Character creation
- Location management
- Relationship tracking
- Multi-action scenarios
- Dependency graphs

**Great for understanding dependency ordering.**

## Learning Path

1. **Start**: Read [Basic Task Manager](./basic-task-manager/README.md)
   - Understand core concepts
   - Set up your first NLAP application
   - Process simple natural language

2. **Practice**: Build your own actions
   - Define actions for your domain
   - Test with different inputs
   - Handle edge cases

3. **Advanced**: Study [E-Commerce Assistant](./e-commerce-assistant/README.md)
   - Learn dependency ordering
   - Implement compensation
   - Handle complex workflows

4. **Master**: Build production application
   - Add authentication
   - Persist to database
   - Monitor and observe
   - Scale and optimize

## Common Patterns Across Examples

### Action Definition
```typescript
registry.register({
  id: 'domain.action',
  description: 'Human-readable description',
  argsSchema: z.object({
    field: z.string().describe('Field description'),
  }),
  handler: async (args, ctx) => {
    return await ctx.appContext.db.operation(args);
  },
  tags: ['domain', 'action-type'],
});
```

### Context Setup
```typescript
interface AppContext extends BaseContext {
  db: Database;
  userId: string;
  // ... your app-specific data
}
```

### Engine Creation
```typescript
const engine = createNLAPEngine({
  registry,
  router: new HybridRouter(
    new KeywordRouter(),
    new EmbeddingRouter()
  ),
  interpreter: new Interpreter(
    new ClaudeProvider({ apiKey: '...' })
  ),
  executor: new DAGExecutor(registry),
  memory: new ThreeTierMemory(),
  validator: new Validator(),
});
```

### Request Processing
```typescript
const result = await engine.interpret(
  userInput,
  {
    requestId: generateId(),
    db: myDatabase,
    userId: req.user.id,
  },
  conversationId
);
```

## Example Comparison

| Feature | Task Manager | E-Commerce | Worldbuilding |
|---------|--------------|------------|---------------|
| **Actions** | 5 | 8+ | 6+ |
| **Dependencies** | None | Complex | Medium |
| **Compensation** | No | Yes | No |
| **Database** | Simple | Complex | Graph |
| **Difficulty** | ⭐ | ⭐⭐⭐ | ⭐⭐ |

## Running the Examples

Each example includes:
- Complete source code
- Setup instructions
- Usage examples with curl
- Test cases
- Common pitfalls

### Prerequisites

All examples require:
```bash
npm install @nlap/core @nlap/providers @nlap/routers zod
```

Plus example-specific dependencies (see individual README files).

### Environment Variables

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...
PORT=3000
DATABASE_URL=...
```

## Best Practices from Examples

1. **Group Related Actions** - Organize by domain (tasks, products, etc.)
2. **Use Descriptive IDs** - Namespace with dots (`tasks.create`, `cart.add`)
3. **Add Schema Descriptions** - Help LLM understand fields
4. **Handle Errors Gracefully** - Throw meaningful error messages
5. **Use Tags Consistently** - Enable filtering and organization
6. **Test Edge Cases** - Invalid inputs, missing dependencies
7. **Monitor Execution** - Log results, track errors

## Troubleshooting

### "Action not found in registry"
- Check action ID spelling
- Ensure action is registered before engine creation

### "Validation failed"
- Check Zod schema matches LLM output
- Enable auto-repair: `enableAutoRepair: true`
- Add `.describe()` to schema fields

### "Compensation not running"
- Ensure `enableCompensation: true` in DAGExecutor config
- Add compensation handlers to critical actions
- Check action execution order

### "Out of tokens"
- Reduce `maxCandidates` (default: 12)
- Use HybridRouter for better filtering
- Optimize action descriptions

## Next Steps

1. Choose an example that matches your use case
2. Follow the setup instructions
3. Run the example locally
4. Modify actions for your domain
5. Build your own application!

## Getting Help

- Review [API Documentation](../packages/core/README.md)
- Check [GitHub Issues](https://github.com/yourusername/nlap/issues)
- Join [Community Discord](https://discord.gg/nlap)
- Read [Architecture Spec](../../.docs/NLAP_Architecture_Complete.md)

# E-Commerce Assistant - Advanced Integration Example

Demonstrates complex workflows with action dependencies, compensation/rollback, and transactional operations.

## What You'll Learn

- Action dependencies for ordered execution
- Compensation handlers for rollback
- Dynamic schema validation
- Complex multi-step workflows
- Error recovery and retry logic

## Scenario

Natural language processing for:
- Product search and browsing
- Cart management
- Order placement with payment
- Inventory reservation with rollback

## Key Actions

### Product Search (No Dependencies)
```typescript
registry.register({
  id: 'products.search',
  description: 'Search for products by query',
  argsSchema: z.object({
    query: z.string(),
    limit: z.number().optional(),
  }),
  handler: async (args, ctx) => {
    return await ctx.appContext.db.products.search(args.query, args.limit);
  },
  tags: ['products', 'search'],
});
```

### Add to Cart (Depends on Product Search)
```typescript
registry.register({
  id: 'cart.add',
  description: 'Add a product to cart',
  dependencies: ['products.search'], // Optional: if search was performed
  argsSchema: z.object({
    productId: z.string(),
    quantity: z.number().min(1),
  }),
  handler: async (args, ctx) => {
    // Can access search results from previousResults if needed
    return await ctx.appContext.db.cart.add(
      ctx.appContext.userId,
      args.productId,
      args.quantity
    );
  },
  tags: ['cart', 'add'],
});
```

### Transactional Checkout (Multi-Step with Compensation)

#### Step 1: Reserve Inventory
```typescript
registry.register({
  id: 'checkout.reserve-inventory',
  description: 'Reserve product inventory for checkout',
  argsSchema: z.object({
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number(),
    })),
  }),
  handler: async (args, ctx) => {
    const reservations = [];

    for (const item of args.items) {
      const reservation = await ctx.appContext.db.inventory.reserve(
        item.productId,
        item.quantity
      );
      reservations.push(reservation);
    }

    return { reservations };
  },
  // Rollback if payment fails
  compensate: async (args, result, ctx) => {
    for (const reservation of result.reservations) {
      await ctx.appContext.db.inventory.unreserve(reservation.id);
    }
  },
  tags: ['checkout', 'inventory'],
});
```

#### Step 2: Process Payment
```typescript
registry.register({
  id: 'checkout.process-payment',
  description: 'Process payment for order',
  dependencies: ['checkout.reserve-inventory'], // Must run after inventory reserved
  argsSchema: z.object({
    amount: z.number().positive(),
    paymentMethod: z.string(),
  }),
  handler: async (args, ctx) => {
    const charge = await ctx.appContext.payments.charge({
      amount: args.amount,
      method: args.paymentMethod,
      userId: ctx.appContext.userId,
    });

    return { chargeId: charge.id, status: charge.status };
  },
  // Rollback: refund if order creation fails
  compensate: async (args, result, ctx) => {
    await ctx.appContext.payments.refund(result.chargeId);
  },
  retry: {
    maxAttempts: 2,
    backoff: 'linear',
    delayMs: 1000,
  },
  tags: ['checkout', 'payment'],
  risk: 'high',
});
```

#### Step 3: Create Order
```typescript
registry.register({
  id: 'checkout.create-order',
  description: 'Create final order record',
  dependencies: ['checkout.process-payment'], // After payment succeeds
  argsSchema: z.object({
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number(),
      price: z.number(),
    })),
    shippingAddress: z.object({
      street: z.string(),
      city: z.string(),
      zip: z.string(),
    }),
  }),
  handler: async (args, ctx) => {
    // Access payment result from previousResults
    const paymentResult = ctx.previousResults.get('checkout.process-payment')?.result;

    const order = await ctx.appContext.db.orders.create({
      userId: ctx.appContext.userId,
      items: args.items,
      shippingAddress: args.shippingAddress,
      chargeId: paymentResult.chargeId,
      status: 'confirmed',
    });

    return order;
  },
  tags: ['checkout', 'order'],
});
```

## Complete Workflow Example

### Natural Language Input
```
"I want to buy 2 wireless headphones and ship them to 123 Main St, Portland, OR 97201"
```

### Execution Flow

1. **Product Search** (Batch 1)
   - Searches for "wireless headphones"
   - Returns matching products

2. **Reserve Inventory** (Batch 2)
   - Reserves 2 units of headphones
   - ✅ Compensation ready if payment fails

3. **Process Payment** (Batch 3)
   - Charges credit card
   - ✅ Compensation ready if order creation fails

4. **Create Order** (Batch 4)
   - Creates order record
   - Marks inventory as sold
   - ✅ Success!

### If Payment Fails

1. Reserve Inventory ✅
2. Process Payment ❌ (Card declined)
3. **Compensation Triggered:**
   - `checkout.reserve-inventory.compensate()` runs
   - Inventory unreserved
   - User sees error message

### If Order Creation Fails

1. Reserve Inventory ✅
2. Process Payment ✅
3. Create Order ❌ (Database error)
4. **Compensation Triggered:**
   - `checkout.create-order` compensation (if defined)
   - `checkout.process-payment.compensate()` - Refunds charge
   - `checkout.reserve-inventory.compensate()` - Unreserves inventory

## Dynamic Schema Example

Validate against current inventory:

```typescript
registry.register({
  id: 'cart.add',
  description: 'Add product to cart',
  argsSchema: async (ctx) => {
    // Fetch available products at runtime
    const products = await ctx.db.products.findAll();
    const validProductIds = products.map(p => p.id);

    return z.object({
      productId: z.enum(validProductIds), // Dynamic validation!
      quantity: z.number().min(1).max(10),
    });
  },
  handler: async (args, ctx) => {
    // productId is guaranteed to exist
    return await ctx.appContext.db.cart.add(
      ctx.appContext.userId,
      args.productId,
      args.quantity
    );
  },
});
```

## Full Integration Code

```typescript
// app.ts
import { createNLAPEngine, ActionRegistry, DAGExecutor } from '@nlap/core';
import { ClaudeProvider } from '@nlap/providers';
import { HybridRouter, KeywordRouter, EmbeddingRouter } from '@nlap/routers';

interface EcomContext extends BaseContext {
  db: Database;
  payments: PaymentService;
  userId: string;
}

// Setup
const registry = new ActionRegistry<EcomContext>();
registerProductActions(registry);
registerCartActions(registry);
registerCheckoutActions(registry);

const engine = createNLAPEngine({
  registry,
  router: new HybridRouter(new KeywordRouter(), new EmbeddingRouter()),
  interpreter: new Interpreter(new ClaudeProvider({ apiKey: '...' })),
  executor: new DAGExecutor(registry, {
    enableCompensation: true, // Critical for e-commerce!
    enableRetry: true,
  }),
});

// Process
const result = await engine.interpret(
  "Buy 2 wireless headphones, ship to 123 Main St",
  {
    requestId: '123',
    db: database,
    payments: stripeService,
    userId: 'user_456',
  }
);

// Check results
if (result.execution?.failed > 0) {
  console.error('Order failed, compensation executed');
  // Show error to user
} else {
  const order = result.execution?.results.get('checkout.create-order')?.result;
  console.log('Order created:', order.id);
  // Show success to user
}
```

## Error Handling Best Practices

### 1. Validation Errors
```typescript
// Handled by NLAP validator
// Auto-repair attempts to fix
// Falls back to clarification
```

### 2. Execution Errors
```typescript
// Caught in handler
// Retry if configured
// Compensation if failed
```

### 3. Payment Failures
```typescript
registry.register({
  id: 'payment.charge',
  handler: async (args, ctx) => {
    try {
      return await ctx.appContext.payments.charge(args);
    } catch (error) {
      if (error.code === 'card_declined') {
        throw new Error('Payment declined. Please try another card.');
      }
      throw error;
    }
  },
  retry: {
    maxAttempts: 1, // Don't retry declined cards
    backoff: 'linear',
    delayMs: 0,
  },
});
```

### 4. Inventory Errors
```typescript
registry.register({
  id: 'inventory.reserve',
  handler: async (args, ctx) => {
    const available = await ctx.appContext.db.inventory.getStock(args.productId);

    if (available < args.quantity) {
      throw new Error(
        `Only ${available} units available, requested ${args.quantity}`
      );
    }

    return await ctx.appContext.db.inventory.reserve(args.productId, args.quantity);
  },
});
```

## Testing Compensation

```typescript
// test/checkout.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('Checkout Compensation', () => {
  it('should rollback inventory on payment failure', async () => {
    const mockPayments = {
      charge: vi.fn().mockRejectedValue(new Error('Card declined')),
    };

    const result = await engine.interpret(
      "Buy headphones",
      { db, payments: mockPayments, userId: '123' }
    );

    // Payment failed
    expect(result.execution.failed).toBe(1);

    // Inventory was unreserved
    const inventory = await db.inventory.getStock('headphones');
    expect(inventory).toBe(10); // Back to original
  });
});
```

## Monitoring & Observability

```typescript
// Log compensation events
registry.register({
  id: 'payment.charge',
  compensate: async (args, result, ctx) => {
    console.warn('COMPENSATION: Refunding payment', {
      chargeId: result.chargeId,
      userId: ctx.appContext.userId,
      timestamp: new Date(),
    });

    await ctx.appContext.payments.refund(result.chargeId);

    // Alert monitoring system
    await sendAlert({
      type: 'payment_refund',
      chargeId: result.chargeId,
      reason: 'downstream_failure',
    });
  },
});
```

## Key Learnings

1. **Use Dependencies** for ordered execution (inventory → payment → order)
2. **Add Compensation** for critical operations (payments, reservations)
3. **Configure Retry** for network operations (API calls, payments)
4. **Validate Dynamically** for runtime constraints (inventory levels)
5. **Monitor Compensation** to detect systemic issues
6. **Test Rollback** scenarios in your test suite

## Production Checklist

- [ ] All financial operations have compensation handlers
- [ ] Retry configs appropriate for each action type
- [ ] Error messages are user-friendly
- [ ] Compensation events are logged/monitored
- [ ] Idempotency keys for payment operations
- [ ] Inventory locking with timeouts
- [ ] End-to-end rollback tests

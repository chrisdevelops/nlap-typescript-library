import type { Executor, ExecutionResult } from '../types/pipeline.js';
import type { Plan } from '../types/plans.js';
import type { ActionCall, ActionDefinition, RetryConfig } from '../types/actions.js';
import type { BaseContext, ExecutionContext } from '../types/base.js';
import type { ActionRegistry } from '../registry/ActionRegistry.js';

/**
 * DAGExecutor executes action plans with dependency-ordered execution,
 * parallel processing, retry logic, and compensation/rollback
 */
export class DAGExecutor<TContext extends BaseContext = BaseContext> implements Executor<TContext> {
  constructor(
    private registry: ActionRegistry<TContext>,
    private config: DAGExecutorConfig = {}
  ) {
    this.config = {
      enableCompensation: config.enableCompensation ?? true,
      enableRetry: config.enableRetry ?? true,
      defaultRetry: config.defaultRetry,
    };
  }

  /**
   * Execute the plan with dependency-ordered execution
   */
  async execute(plan: Plan, context: TContext): Promise<ExecutionResult<TContext>> {
    const results = new Map<string, { result: unknown; error?: Error }>();
    const executedCalls: ActionCall[] = [];
    let succeeded = 0;
    let failed = 0;

    try {
      // Build execution order (batches of independent actions)
      const batches = this.buildExecutionOrder(plan.calls);

      // Execute batches in order
      for (const batch of batches) {
        const batchResults = await this.executeBatch(batch, {
          appContext: context,
          previousResults: results,
          conversationId: plan.conversationId,
          turnNumber: plan.turnNumber,
        });

        // Merge batch results into overall results
        for (const [callId, result] of batchResults.entries()) {
          results.set(callId, result);
          executedCalls.push(batch.find((c) => c.callId === callId)!);

          if (result.error) {
            failed++;
            // If any action fails, compensate and abort
            if (this.config.enableCompensation) {
              await this.compensate(executedCalls, results, {
                appContext: context,
                previousResults: results,
                conversationId: plan.conversationId,
                turnNumber: plan.turnNumber,
              });
            }
            return { succeeded, failed, results };
          } else {
            succeeded++;
          }
        }
      }

      return { succeeded, failed, results };
    } catch (error) {
      // Unexpected error during execution
      failed++;
      if (this.config.enableCompensation && executedCalls.length > 0) {
        await this.compensate(executedCalls, results, {
          appContext: context,
          previousResults: results,
          conversationId: plan.conversationId,
          turnNumber: plan.turnNumber,
        });
      }
      throw error;
    }
  }

  /**
   * Build execution order using topological sort (Kahn's algorithm)
   * Returns batches where each batch contains independent actions that can run in parallel
   */
  private buildExecutionOrder(calls: ActionCall[]): ActionCall[][] {
    if (calls.length === 0) {
      return [];
    }

    // Build dependency graph
    const graph = new Map<string, Set<string>>(); // callId -> set of callIds it depends on
    const inDegree = new Map<string, number>(); // callId -> number of dependencies
    const callMap = new Map<string, ActionCall>();
    const actionIdToCallIds = new Map<string, string[]>(); // actionId -> callIds

    // Map actionIds to callIds
    for (const call of calls) {
      if (!actionIdToCallIds.has(call.actionId)) {
        actionIdToCallIds.set(call.actionId, []);
      }
      actionIdToCallIds.get(call.actionId)!.push(call.callId);
    }

    // Initialize
    for (const call of calls) {
      callMap.set(call.callId, call);

      // Get action dependencies from registry
      const action = this.registry.get(call.actionId);
      const actionDeps = action?.dependencies ?? [];

      // Convert action dependencies to call dependencies
      const callDeps = new Set<string>(call.dependsOn ?? []);
      for (const actionDep of actionDeps) {
        // Find all calls that implement this action dependency
        const depCallIds = actionIdToCallIds.get(actionDep) ?? [];
        for (const depCallId of depCallIds) {
          callDeps.add(depCallId);
        }
      }

      graph.set(call.callId, callDeps);
      inDegree.set(call.callId, callDeps.size);
    }

    // Topological sort into batches
    const batches: ActionCall[][] = [];
    const remaining = new Set(calls.map((c) => c.callId));

    while (remaining.size > 0) {
      // Find all nodes with in-degree 0 (no dependencies or all dependencies satisfied)
      const batch: ActionCall[] = [];
      for (const callId of remaining) {
        if (inDegree.get(callId) === 0) {
          batch.push(callMap.get(callId)!);
        }
      }

      if (batch.length === 0) {
        // Cycle detected (should not happen as registry prevents this)
        throw new Error('Cycle detected in action dependencies');
      }

      batches.push(batch);

      // Remove processed nodes and update in-degrees
      for (const call of batch) {
        remaining.delete(call.callId);

        // Update in-degrees for nodes that depend on this one
        for (const otherCallId of remaining) {
          const deps = graph.get(otherCallId)!;
          if (deps.has(call.callId)) {
            inDegree.set(otherCallId, inDegree.get(otherCallId)! - 1);
          }
        }
      }
    }

    return batches;
  }

  /**
   * Execute a batch of independent actions in parallel
   */
  private async executeBatch(
    batch: ActionCall[],
    ctx: ExecutionContext<TContext>
  ): Promise<Map<string, { result: unknown; error?: Error }>> {
    const results = new Map<string, { result: unknown; error?: Error }>();

    // Execute all actions in parallel
    const promises = batch.map(async (call) => {
      const action = this.registry.get(call.actionId);
      if (!action) {
        return {
          callId: call.callId,
          result: { result: undefined, error: new Error(`Action ${call.actionId} not found in registry`) },
        };
      }

      if (!action.handler) {
        return {
          callId: call.callId,
          result: { result: undefined, error: new Error(`Action ${call.actionId} has no handler`) },
        };
      }

      try {
        const result = await this.executeWithRetry(call, action, ctx);
        return { callId: call.callId, result: { result } };
      } catch (error) {
        return {
          callId: call.callId,
          result: { result: undefined, error: error as Error },
        };
      }
    });

    const batchResults = await Promise.all(promises);

    for (const { callId, result } of batchResults) {
      results.set(callId, result);
    }

    return results;
  }

  /**
   * Execute a single action with retry logic
   */
  private async executeWithRetry(
    call: ActionCall,
    action: ActionDefinition<any, any, any, TContext>,
    ctx: ExecutionContext<TContext>
  ): Promise<unknown> {
    const retryConfig = this.config.enableRetry
      ? action.retry ?? this.config.defaultRetry
      : undefined;

    if (!retryConfig) {
      // No retry - execute once
      return await action.handler!(call.args as any, ctx);
    }

    // Execute with retry
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < retryConfig.maxAttempts; attempt++) {
      try {
        return await action.handler!(call.args as any, ctx);
      } catch (error) {
        lastError = error as Error;

        // If this was the last attempt, throw
        if (attempt === retryConfig.maxAttempts - 1) {
          throw lastError;
        }

        // Calculate backoff delay
        const delay = this.calculateBackoff(attempt, retryConfig);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Compensate/rollback executed actions in reverse order
   */
  private async compensate(
    executedCalls: ActionCall[],
    results: Map<string, { result: unknown; error?: Error }>,
    ctx: ExecutionContext<TContext>
  ): Promise<void> {
    // Reverse order (last executed = first compensated)
    const reversed = [...executedCalls].reverse();

    for (const call of reversed) {
      const action = this.registry.get(call.actionId);
      if (!action?.compensate) {
        continue; // Skip if no compensation handler
      }

      const callResult = results.get(call.callId);
      if (!callResult || callResult.error) {
        continue; // Skip if action failed (nothing to compensate)
      }

      try {
        await action.compensate(call.args as any, callResult.result, ctx);
      } catch (error) {
        // Log compensation error but continue compensating others
        console.error(`Compensation failed for ${call.actionId}:`, error);
      }
    }
  }

  /**
   * Calculate backoff delay based on retry config
   */
  private calculateBackoff(attempt: number, config: RetryConfig): number {
    if (config.backoff === 'exponential') {
      return config.delayMs * Math.pow(2, attempt);
    }
    // Linear backoff
    return config.delayMs * (attempt + 1);
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Configuration for DAGExecutor
 */
export interface DAGExecutorConfig {
  /** Enable compensation/rollback on failure (default: true) */
  enableCompensation?: boolean;

  /** Enable retry logic (default: true) */
  enableRetry?: boolean;

  /** Default retry config if action doesn't specify one */
  defaultRetry?: RetryConfig;
}

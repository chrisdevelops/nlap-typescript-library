import type { ActionDefinition, BaseContext } from '../types/index.js';
import { CircularDependencyError } from '../errors/index.js';

/**
 * Action registry with validation, tag indexing, and dependency management
 */
export class ActionRegistry<TContext extends BaseContext = BaseContext> {
  private actions = new Map<string, ActionDefinition<any, any, any, TContext>>();
  private actionsByTag = new Map<string, Set<string>>();
  private dependencyGraph = new Map<string, Set<string>>();
  private locked = false;

  /**
   * Register a new action
   */
  register<TName extends string, TInput, TOutput>(
    action: ActionDefinition<TName, TInput, TOutput, TContext>
  ): this {
    this.validateLockState();
    this.validateActionDefinition(action);
    this.validateDependencies(action);
    this.detectCircularDependencies(action.id, action.dependencies ?? []);

    this.actions.set(action.id, action);
    this.indexByTags(action);
    this.buildDependencyGraph(action);

    return this;
  }

  /**
   * Get action by ID
   */
  get(actionId: string): ActionDefinition<any, any, any, TContext> | undefined {
    return this.actions.get(actionId);
  }

  /**
   * List all registered actions
   */
  list(): ActionDefinition<any, any, any, TContext>[] {
    return Array.from(this.actions.values());
  }

  /**
   * Get actions by a single tag
   */
  getByTag(tag: string): ActionDefinition<any, any, any, TContext>[] {
    const ids = this.actionsByTag.get(tag);
    return ids ? Array.from(ids).map((id) => this.actions.get(id)!) : [];
  }

  /**
   * Get actions by multiple tags (intersection)
   */
  getByTags(tags: string[]): ActionDefinition<any, any, any, TContext>[] {
    if (tags.length === 0) return [];

    const sets = tags.map((tag) => this.actionsByTag.get(tag) ?? new Set<string>());
    const intersection = sets.reduce((acc, set) => new Set([...acc].filter((x) => set.has(x))));

    return Array.from(intersection).map((id) => this.actions.get(id)!);
  }

  /**
   * Get actions that depend on the given action
   */
  getDependents(actionId: string): string[] {
    return Array.from(this.dependencyGraph.get(actionId) ?? []);
  }

  /**
   * Lock the registry to prevent further registration
   */
  lock(): void {
    this.locked = true;
  }

  /**
   * Check if registry is locked
   */
  isLocked(): boolean {
    return this.locked;
  }

  // Private validation methods

  private validateLockState(): void {
    if (this.locked) {
      throw new Error('Registry is locked; cannot register new actions');
    }
  }

  private validateActionDefinition(action: ActionDefinition<any, any, any, TContext>): void {
    if (!action.id || typeof action.id !== 'string') {
      throw new Error('Action must have a string ID');
    }
    if (this.actions.has(action.id)) {
      throw new Error(`Action "${action.id}" already registered`);
    }
    if (!action.description) {
      throw new Error(`Action "${action.id}" must have a description`);
    }
    if (!action.argsSchema) {
      throw new Error(`Action "${action.id}" must have an argsSchema`);
    }
  }

  private validateDependencies(action: ActionDefinition<any, any, any, TContext>): void {
    for (const dep of action.dependencies ?? []) {
      if (!this.actions.has(dep)) {
        throw new Error(
          `Action "${action.id}" depends on "${dep}" which is not registered. ` +
            `Register dependencies before dependents.`
        );
      }
    }
  }

  private detectCircularDependencies(
    actionId: string,
    dependencies: string[],
    visited = new Set<string>(),
    path: string[] = []
  ): void {
    if (visited.has(actionId)) {
      const cycle = [...path, actionId];
      throw new CircularDependencyError(cycle);
    }

    visited.add(actionId);
    path.push(actionId);

    for (const dep of dependencies) {
      const depAction = this.actions.get(dep);
      if (depAction?.dependencies) {
        this.detectCircularDependencies(dep, depAction.dependencies, new Set(visited), [...path]);
      }
    }
  }

  private indexByTags(action: ActionDefinition<any, any, any, TContext>): void {
    for (const tag of action.tags ?? []) {
      if (!this.actionsByTag.has(tag)) {
        this.actionsByTag.set(tag, new Set());
      }
      this.actionsByTag.get(tag)!.add(action.id);
    }
  }

  private buildDependencyGraph(action: ActionDefinition<any, any, any, TContext>): void {
    // Build reverse dependency graph (action → actions that depend on it)
    for (const dep of action.dependencies ?? []) {
      if (!this.dependencyGraph.has(dep)) {
        this.dependencyGraph.set(dep, new Set());
      }
      this.dependencyGraph.get(dep)!.add(action.id);
    }
  }
}

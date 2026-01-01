/**
 * Route candidate
 */
export interface RouteCandidate {
  actionId: string;
  score: number;
  method: 'keyword' | 'embedding' | 'tag';
}

/**
 * Route result
 */
export interface RouteResult {
  candidates: RouteCandidate[];
  duration: number;
}

/**
 * Router interface
 *
 * Note: This uses forward declaration for ActionRegistry to avoid circular dependencies.
 * The actual import happens at runtime in implementation files.
 */
export interface Router<TContext = any> {
  route(
    input: string,
    context: TContext,
    registry: any // ActionRegistry<TContext>
  ): Promise<RouteResult>;
}

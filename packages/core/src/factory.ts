import { Pipeline } from './pipeline/Pipeline.js';
import type { PipelineConfig, BaseContext } from './types/index.js';

/**
 * Create a configured NLAP engine
 */
export function createNLAPEngine<TContext extends BaseContext = BaseContext>(
  config: PipelineConfig<TContext>
): Pipeline<TContext> {
  return new Pipeline(config);
}

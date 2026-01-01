/**
 * Router interface - simplified to avoid circular dependencies
 * (Full type is in @nlap/core)
 */
interface Router<TContext = any> {
  route(input: string, context: TContext, registry: any): Promise<RouteResult>;
}

interface RouteResult {
  candidates: RouteCandidate[];
  duration: number;
}

interface RouteCandidate {
  actionId: string;
  score: number;
  method: 'keyword' | 'embedding' | 'tag';
}

/**
 * Configuration options for HybridRouter
 */
export interface HybridRouterConfig {
  /**
   * Confidence threshold for keyword router (0-1)
   * If top keyword score < threshold, fallback to embedding
   * @default 0.5
   */
  keywordConfidenceThreshold?: number;

  /**
   * Minimum number of keyword candidates required
   * If fewer candidates, fallback to embedding
   * @default 3
   */
  minKeywordCandidates?: number;

  /**
   * Fallback strategy
   * - 'embedding': Use embedding router
   * - 'combine': Merge keyword + embedding scores
   * @default 'embedding'
   */
  fallbackStrategy?: 'embedding' | 'combine';

  /**
   * Weight for keyword scores when combining (0-1)
   * @default 0.6
   */
  keywordWeight?: number;

  /**
   * Enable fallback to embedding router
   * @default true
   */
  enableEmbeddingFallback?: boolean;
}

/**
 * Hybrid router that combines keyword and embedding routing
 * Uses keyword-first strategy with intelligent fallback
 */
export class HybridRouter<TContext = any> implements Router<TContext> {
  private readonly config: Required<HybridRouterConfig>;

  constructor(
    private keywordRouter: Router<TContext>,
    private embeddingRouter: Router<TContext>,
    config: HybridRouterConfig = {}
  ) {
    this.config = {
      keywordConfidenceThreshold: config.keywordConfidenceThreshold ?? 0.5,
      minKeywordCandidates: config.minKeywordCandidates ?? 3,
      fallbackStrategy: config.fallbackStrategy ?? 'embedding',
      keywordWeight: config.keywordWeight ?? 0.6,
      enableEmbeddingFallback: config.enableEmbeddingFallback ?? true,
    };
  }

  /**
   * Route input using keyword-first strategy with embedding fallback
   */
  async route(input: string, context: TContext, registry: any): Promise<RouteResult> {
    const startTime = Date.now();

    // 1. Try keyword router first (fast path)
    const keywordResult = await this.keywordRouter.route(input, context, registry);

    // 2. Check if keyword routing is confident
    const topScore = keywordResult.candidates[0]?.score ?? 0;
    const hasEnoughCandidates = keywordResult.candidates.length >= this.config.minKeywordCandidates;
    const isConfident = topScore >= this.config.keywordConfidenceThreshold;

    if (isConfident && hasEnoughCandidates) {
      // Keyword routing is confident, use it
      return {
        candidates: keywordResult.candidates,
        duration: Date.now() - startTime,
      };
    }

    // 3. Fallback to embedding router
    if (!this.config.enableEmbeddingFallback) {
      // Embedding fallback disabled, return keyword results anyway
      return {
        candidates: keywordResult.candidates,
        duration: Date.now() - startTime,
      };
    }

    const embeddingResult = await this.embeddingRouter.route(input, context, registry);

    // 4. Choose fallback strategy
    if (this.config.fallbackStrategy === 'embedding') {
      // Pure fallback: use embedding results
      return {
        candidates: embeddingResult.candidates,
        duration: Date.now() - startTime,
      };
    } else {
      // Combine: weighted merge of keyword + embedding scores
      const combined = this.combineResults(keywordResult, embeddingResult);
      return {
        candidates: combined,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Combine keyword and embedding scores with weighted average
   */
  private combineResults(
    keywordResult: RouteResult,
    embeddingResult: RouteResult
  ): RouteCandidate[] {
    const scores = new Map<string, { keyword: number; embedding: number }>();

    // Collect keyword scores
    for (const candidate of keywordResult.candidates) {
      scores.set(candidate.actionId, {
        keyword: candidate.score,
        embedding: 0,
      });
    }

    // Collect embedding scores
    for (const candidate of embeddingResult.candidates) {
      const existing = scores.get(candidate.actionId);
      if (existing) {
        existing.embedding = candidate.score;
      } else {
        scores.set(candidate.actionId, {
          keyword: 0,
          embedding: candidate.score,
        });
      }
    }

    // Calculate weighted scores
    const combined: RouteCandidate[] = [];
    const kw = this.config.keywordWeight;
    const ew = 1 - kw;

    for (const [actionId, { keyword, embedding }] of scores.entries()) {
      const combinedScore = (keyword * kw) + (embedding * ew);
      combined.push({
        actionId,
        score: combinedScore,
        method: keyword > 0 && embedding > 0 ? 'keyword' : (keyword > 0 ? 'keyword' : 'embedding'),
      });
    }

    // Sort by combined score descending
    combined.sort((a, b) => b.score - a.score);

    return combined;
  }
}

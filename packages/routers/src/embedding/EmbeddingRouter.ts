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
 * Configuration options for EmbeddingRouter
 */
export interface EmbeddingRouterConfig {
  /**
   * Model to use for embeddings
   * @default 'Xenova/all-MiniLM-L6-v2'
   */
  model?: string;

  /**
   * Minimum similarity score threshold (0-1)
   * @default 0.3
   */
  minScore?: number;

  /**
   * Cache embeddings in memory
   * @default true
   */
  enableCache?: boolean;

  /**
   * Maximum number of candidates to return
   * @default 50 (Pipeline will slice to top 12)
   */
  maxCandidates?: number;
}

/**
 * Embedding cache entry
 */
interface EmbeddingCache {
  actionId: string;
  embedding: number[];
  version: number;
}

/**
 * Vector similarity-based router for action selection
 * Uses semantic embeddings to find relevant actions
 */
export class EmbeddingRouter<TContext = any> implements Router<TContext> {
  private model?: any; // FeatureExtractionPipeline from @xenova/transformers
  private cache: Map<string, EmbeddingCache> = new Map();
  private initialized = false;
  private readonly config: Required<EmbeddingRouterConfig>;

  constructor(config: EmbeddingRouterConfig = {}) {
    this.config = {
      model: config.model ?? 'Xenova/all-MiniLM-L6-v2',
      minScore: config.minScore ?? 0.3,
      enableCache: config.enableCache ?? true,
      maxCandidates: config.maxCandidates ?? 50,
    };
  }

  /**
   * Route input to relevant action candidates using vector similarity
   */
  async route(input: string, _context: TContext, registry: any): Promise<RouteResult> {
    const startTime = Date.now();

    try {
      // Lazy initialization (download model on first use)
      if (!this.initialized) {
        await this.initialize(registry);
      }

      // Embed input query
      const queryEmbedding = await this.embed(input);

      // Calculate cosine similarity with all action embeddings
      const candidates: RouteCandidate[] = [];

      for (const [actionId, cached] of this.cache.entries()) {
        const score = this.cosineSimilarity(queryEmbedding, cached.embedding);

        if (score >= this.config.minScore) {
          candidates.push({
            actionId,
            score,
            method: 'embedding',
          });
        }
      }

      // Sort by score descending
      candidates.sort((a, b) => b.score - a.score);

      // Return top candidates
      return {
        candidates: candidates.slice(0, this.config.maxCandidates),
        duration: Date.now() - startTime,
      };
    } catch (error) {
      // Graceful degradation: return empty candidates on error
      console.error('EmbeddingRouter error:', error);
      return {
        candidates: [],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Initialize model and pre-compute action embeddings
   */
  private async initialize(registry: any): Promise<void> {
    // Load transformer model (downloads on first run)
    const { pipeline } = await import('@xenova/transformers');
    this.model = await pipeline('feature-extraction', this.config.model);

    // Pre-compute embeddings for all actions
    const actions = registry.list();

    for (const action of actions) {
      const doc = this.buildDocument(action);
      const embedding = await this.embed(doc);

      this.cache.set(action.id, {
        actionId: action.id,
        embedding,
        version: this.getActionVersion(action),
      });
    }

    this.initialized = true;
  }

  /**
   * Build searchable document from action metadata
   * Uses same pattern as KeywordRouter for consistency
   */
  private buildDocument(action: any): string {
    const parts = [
      // Convert action ID (e.g., "tasks.create" → "tasks create")
      action.id.replace(/[._-]/g, ' '),
      action.description,
      ...(action.tags ?? []),
      ...(action.examples?.map((ex: any) => ex.input) ?? []),
    ];
    return parts.join(' ').toLowerCase();
  }

  /**
   * Generate embedding for text
   */
  private async embed(text: string): Promise<number[]> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    const result = await this.model(text, { pooling: 'mean', normalize: true });
    return Array.from(result.data as Float32Array);
  }

  /**
   * Calculate cosine similarity between two vectors
   * Returns value between 0 (no similarity) and 1 (identical)
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Get version hash for action (invalidate cache when changed)
   */
  private getActionVersion(action: any): number {
    const str = JSON.stringify({
      id: action.id,
      description: action.description,
      tags: action.tags,
    });

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  /**
   * Invalidate cache for specific action (call when action updated)
   */
  invalidateAction(actionId: string): void {
    this.cache.delete(actionId);
  }

  /**
   * Clear all cached embeddings
   */
  clearCache(): void {
    this.cache.clear();
    this.initialized = false;
  }
}

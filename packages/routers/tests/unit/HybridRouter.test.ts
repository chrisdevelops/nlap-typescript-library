import { describe, it, expect, vi } from 'vitest';
import { HybridRouter } from '../../src/hybrid/HybridRouter.js';

// Router interface for mocks
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

describe('HybridRouter', () => {
  it('should use keyword router when confident', async () => {
    const mockKeyword: Router = {
      route: vi.fn().mockResolvedValue({
        candidates: [
          { actionId: 'a', score: 0.9, method: 'keyword' },
          { actionId: 'b', score: 0.7, method: 'keyword' },
          { actionId: 'c', score: 0.5, method: 'keyword' },
        ],
        duration: 50,
      }),
    };

    const mockEmbedding: Router = {
      route: vi.fn().mockResolvedValue({
        candidates: [
          { actionId: 'd', score: 0.8, method: 'embedding' },
        ],
        duration: 150,
      }),
    };

    const router = new HybridRouter(mockKeyword, mockEmbedding, {
      keywordConfidenceThreshold: 0.5,
      minKeywordCandidates: 3,
    });

    const result = await router.route('test', {}, {});

    // Should use keyword results (confident + enough candidates)
    expect(result.candidates[0].actionId).toBe('a');
    expect(mockKeyword.route).toHaveBeenCalled();
    expect(mockEmbedding.route).not.toHaveBeenCalled();
  });

  it('should fallback to embedding when keyword score too low', async () => {
    const mockKeyword: Router = {
      route: vi.fn().mockResolvedValue({
        candidates: [
          { actionId: 'a', score: 0.3, method: 'keyword' }, // Low score
        ],
        duration: 50,
      }),
    };

    const mockEmbedding: Router = {
      route: vi.fn().mockResolvedValue({
        candidates: [
          { actionId: 'b', score: 0.8, method: 'embedding' },
        ],
        duration: 150,
      }),
    };

    const router = new HybridRouter(mockKeyword, mockEmbedding, {
      keywordConfidenceThreshold: 0.5,
    });

    const result = await router.route('test', {}, {});

    // Should use embedding results (keyword score < threshold)
    expect(result.candidates[0].actionId).toBe('b');
    expect(mockEmbedding.route).toHaveBeenCalled();
  });

  it('should fallback when too few keyword candidates', async () => {
    const mockKeyword: Router = {
      route: vi.fn().mockResolvedValue({
        candidates: [
          { actionId: 'a', score: 0.9, method: 'keyword' },
        ], // Only 1 candidate
        duration: 50,
      }),
    };

    const mockEmbedding: Router = {
      route: vi.fn().mockResolvedValue({
        candidates: [
          { actionId: 'b', score: 0.7, method: 'embedding' },
          { actionId: 'c', score: 0.6, method: 'embedding' },
          { actionId: 'd', score: 0.5, method: 'embedding' },
        ],
        duration: 150,
      }),
    };

    const router = new HybridRouter(mockKeyword, mockEmbedding, {
      minKeywordCandidates: 3,
    });

    const result = await router.route('test', {}, {});

    // Should use embedding (< 3 keyword candidates)
    expect(result.candidates.length).toBe(3);
    expect(mockEmbedding.route).toHaveBeenCalled();
  });

  it('should combine scores when strategy is combine', async () => {
    const mockKeyword: Router = {
      route: vi.fn().mockResolvedValue({
        candidates: [
          { actionId: 'a', score: 1.0, method: 'keyword' },
          { actionId: 'b', score: 0.5, method: 'keyword' },
        ],
        duration: 50,
      }),
    };

    const mockEmbedding: Router = {
      route: vi.fn().mockResolvedValue({
        candidates: [
          { actionId: 'a', score: 0.6, method: 'embedding' },
          { actionId: 'c', score: 0.9, method: 'embedding' },
        ],
        duration: 150,
      }),
    };

    const router = new HybridRouter(mockKeyword, mockEmbedding, {
      fallbackStrategy: 'combine',
      keywordWeight: 0.7, // 70% keyword, 30% embedding
      keywordConfidenceThreshold: 0, // Always combine
    });

    const result = await router.route('test', {}, {});

    // 'a' should win: (1.0 * 0.7) + (0.6 * 0.3) = 0.88
    // 'b' score: (0.5 * 0.7) + (0 * 0.3) = 0.35
    // 'c' score: (0 * 0.7) + (0.9 * 0.3) = 0.27

    expect(result.candidates[0].actionId).toBe('a');
    expect(result.candidates[1].actionId).toBe('b');
    expect(result.candidates[2].actionId).toBe('c');
  });

  it('should respect enableEmbeddingFallback flag', async () => {
    const mockKeyword: Router = {
      route: vi.fn().mockResolvedValue({
        candidates: [
          { actionId: 'a', score: 0.2, method: 'keyword' }, // Low score
        ],
        duration: 50,
      }),
    };

    const mockEmbedding: Router = {
      route: vi.fn().mockResolvedValue({
        candidates: [
          { actionId: 'b', score: 0.9, method: 'embedding' },
        ],
        duration: 150,
      }),
    };

    const router = new HybridRouter(mockKeyword, mockEmbedding, {
      enableEmbeddingFallback: false,
    });

    const result = await router.route('test', {}, {});

    // Should use keyword despite low score (fallback disabled)
    expect(result.candidates[0].actionId).toBe('a');
    expect(mockEmbedding.route).not.toHaveBeenCalled();
  });

  it('should calculate weighted scores correctly', async () => {
    const mockKeyword: Router = {
      route: vi.fn().mockResolvedValue({
        candidates: [
          { actionId: 'a', score: 0.8, method: 'keyword' },
        ],
        duration: 50,
      }),
    };

    const mockEmbedding: Router = {
      route: vi.fn().mockResolvedValue({
        candidates: [
          { actionId: 'a', score: 0.4, method: 'embedding' },
        ],
        duration: 150,
      }),
    };

    const router = new HybridRouter(mockKeyword, mockEmbedding, {
      fallbackStrategy: 'combine',
      keywordWeight: 0.6, // 60% keyword, 40% embedding
      keywordConfidenceThreshold: 0,
    });

    const result = await router.route('test', {}, {});

    // Combined score: (0.8 * 0.6) + (0.4 * 0.4) = 0.48 + 0.16 = 0.64
    expect(result.candidates[0].actionId).toBe('a');
    expect(result.candidates[0].score).toBeCloseTo(0.64, 2);
  });

  it('should include candidates from both routers when combining', async () => {
    const mockKeyword: Router = {
      route: vi.fn().mockResolvedValue({
        candidates: [
          { actionId: 'a', score: 0.5, method: 'keyword' },
          { actionId: 'b', score: 0.4, method: 'keyword' },
        ],
        duration: 50,
      }),
    };

    const mockEmbedding: Router = {
      route: vi.fn().mockResolvedValue({
        candidates: [
          { actionId: 'c', score: 0.6, method: 'embedding' },
          { actionId: 'd', score: 0.5, method: 'embedding' },
        ],
        duration: 150,
      }),
    };

    const router = new HybridRouter(mockKeyword, mockEmbedding, {
      fallbackStrategy: 'combine',
      keywordConfidenceThreshold: 0,
    });

    const result = await router.route('test', {}, {});

    // Should include all candidates from both routers
    expect(result.candidates.length).toBe(4);
  });
});

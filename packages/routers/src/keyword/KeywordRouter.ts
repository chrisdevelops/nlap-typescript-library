import natural from 'natural';
import { removeStopwords } from 'stopword';

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
 * TF-IDF based keyword router for action selection
 */
export class KeywordRouter<TContext = any> implements Router<TContext> {
  private tfidf: natural.TfIdf;
  private actionIds: string[] = [];
  private initialized = false;

  constructor() {
    this.tfidf = new natural.TfIdf();
  }

  /**
   * Route input to relevant action candidates using TF-IDF
   */
  async route(input: string, _context: TContext, registry: any): Promise<RouteResult> {
    const startTime = Date.now();

    // Lazy initialization
    if (!this.initialized) {
      this.initialize(registry);
    }

    // Tokenize and clean input
    const tokens = this.tokenize(input);
    const cleanTokens = removeStopwords(tokens);

    // Calculate TF-IDF scores
    const scores: RouteCandidate[] = [];

    this.tfidf.tfidfs(cleanTokens.join(' '), (i, score) => {
      if (i < this.actionIds.length && score > 0) {
        scores.push({
          actionId: this.actionIds[i],
          score,
          method: 'keyword',
        });
      }
    });

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    return {
      candidates: scores,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Initialize TF-IDF index from registry
   */
  private initialize(registry: any): void {
    const actions = registry.list();

    for (const action of actions) {
      // Build document from action metadata
      const doc = this.buildDocument(action);
      this.tfidf.addDocument(doc);
      this.actionIds.push(action.id);
    }

    this.initialized = true;
  }

  /**
   * Build searchable document from action metadata
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
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    const tokenizer = new natural.WordTokenizer();
    return tokenizer.tokenize(text.toLowerCase()) ?? [];
  }
}

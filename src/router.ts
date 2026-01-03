import natural from 'natural';
import { removeStopwords } from 'stopword';
import type { Action } from './types.js';

/**
 * Route result with scored candidates
 */
export interface RouteResult {
  actionNames: string[];
  scores: Map<string, number>;
}

/**
 * TF-IDF based keyword router for action selection
 */
export class KeywordRouter {
  private tfidf: natural.TfIdf;
  private actionNames: string[] = [];

  constructor(actions: Action<any>[]) {
    this.tfidf = new natural.TfIdf();

    for (const action of actions) {
      const doc = this.buildDocument(action);
      this.tfidf.addDocument(doc);
      this.actionNames.push(action.name);
    }
  }

  /**
   * Route input to relevant action candidates
   * Returns action names sorted by relevance (max 12)
   */
  route(input: string, maxCandidates: number = 12): string[] {
    const tokens = this.tokenize(input);
    const cleanTokens = removeStopwords(tokens);

    const scores: Array<{ name: string; score: number }> = [];

    this.tfidf.tfidfs(cleanTokens.join(' '), (i, score) => {
      if (i < this.actionNames.length && score > 0) {
        scores.push({
          name: this.actionNames[i],
          score,
        });
      }
    });

    // Sort by score descending and return top candidates
    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, maxCandidates)
      .map((s) => s.name);
  }

  /**
   * Build searchable document from action metadata
   */
  private buildDocument(action: Action<any>): string {
    const parts = [
      // Convert camelCase to words: createTask → create task
      action.name.replace(/([A-Z])/g, ' $1').toLowerCase(),
      action.description,
      ...(action.examples?.map((ex) => ex.input) ?? []),
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

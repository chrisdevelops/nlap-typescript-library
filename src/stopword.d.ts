declare module 'stopword' {
  export function removeStopwords(
    tokens: string[],
    stopwords?: string[]
  ): string[];
}

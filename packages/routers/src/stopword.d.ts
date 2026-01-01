declare module 'stopword' {
  export function removeStopwords(tokens: string[], language?: string[]): string[];
  export const eng: string[];
}

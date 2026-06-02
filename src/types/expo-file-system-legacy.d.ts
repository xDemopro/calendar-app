// Type shim for `expo-file-system/legacy` subpath.
// Metro resolves this at runtime, but tsc cannot find a top-level entry,
// so we declare the surface we use.
declare module 'expo-file-system/legacy' {
  export enum EncodingType {
    UTF8 = 'utf8',
    Base64 = 'base64',
  }
  export function readAsStringAsync(
    uri: string,
    options?: { encoding?: EncodingType | 'utf8' | 'base64'; position?: number; length?: number },
  ): Promise<string>;
}

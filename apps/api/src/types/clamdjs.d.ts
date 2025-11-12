// Назначение: типы для clamdjs
// Модули: clamdjs

declare module 'clamdjs' {
  interface Scanner {
    scanStream(
      stream: NodeJS.ReadableStream,
      timeout?: number,
    ): Promise<string>;
    scanBuffer(
      buffer: Buffer,
      timeout?: number,
      chunkSize?: number,
    ): Promise<string>;
    scanFile(
      path: string,
      timeout?: number,
      chunkSize?: number,
    ): Promise<string>;
  }

  export function createScanner(host: string, port: number): Scanner;
  export function ping(
    host: string,
    port: number,
    timeout?: number,
  ): Promise<boolean>;
  export function version(
    host: string,
    port: number,
    timeout?: number,
  ): Promise<string>;
  export function isCleanReply(reply: string): boolean;
  const clamd: {
    createScanner: typeof createScanner;
    ping: typeof ping;
    version: typeof version;
    isCleanReply: typeof isCleanReply;
  };
  export default clamd;
}

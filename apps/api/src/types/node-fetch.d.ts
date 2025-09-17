// Назначение файла: заглушка типов для node-fetch в сборке API
// Основные модули: глобальные типы RequestInit и Response

declare module "node-fetch" {
  interface BasicHeaders {
    [key: string]: string;
  }

  interface FetchRequestInit extends Record<string, unknown> {
    method?: string;
    headers?: BasicHeaders | string[][];
    body?: unknown;
    signal?: AbortSignal | null;
  }

  class FetchResponse {
    readonly ok: boolean;
    readonly status: number;
    readonly headers: BasicHeaders;
    json<T = unknown>(): Promise<T>;
    text(): Promise<string>;
  }

  const fetch: (url: string, init?: FetchRequestInit) => Promise<FetchResponse>;

  export default fetch;
  export { FetchResponse as Response, FetchRequestInit as RequestInit };
}

// Заглушка типов для mongodb-memory-server при запуске тестов API.
declare module 'mongodb-memory-server' {
  export class MongoMemoryServer {
    static create(
      options?: Record<string, unknown>,
    ): Promise<MongoMemoryServer>;
    getUri(): string;
    stop(cleanup?: boolean): Promise<boolean>;
  }
}

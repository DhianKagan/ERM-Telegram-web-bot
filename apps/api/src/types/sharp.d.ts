// Назначение: заглушка типов для sharp в тестах
declare module 'sharp' {
  type SharpInstance = {
    jpeg(options?: unknown): SharpInstance;
    toFile(path: string): Promise<void>;
  };

  function sharp(input?: unknown): SharpInstance;

  export default sharp;
}

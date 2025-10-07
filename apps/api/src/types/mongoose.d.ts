// Назначение: дополняет типы mongoose для серверного кода
// Основные модули: mongoose
import 'mongoose';

declare module 'mongoose' {
  interface Schema<TRawDocType = any> {
    pre<TDoc = TRawDocType>(
      event: string,
      fn: (...args: unknown[]) => unknown,
    ): this;
    index(
      fields: Record<string, unknown>,
      options?: Record<string, unknown>,
    ): this;
  }
}

// Назначение: дополняет типы mongoose для серверного кода
// Основные модули: mongoose
import type { HydratedDocument } from 'mongoose';
import 'mongoose';

declare module 'mongoose' {
  interface Schema<TRawDocType = unknown> {
    pre(
      event: string,
      fn: (this: HydratedDocument<TRawDocType>, ...args: unknown[]) => unknown,
    ): this;
    index(
      fields: Record<string, unknown>,
      options?: Record<string, unknown>,
    ): this;
  }
}

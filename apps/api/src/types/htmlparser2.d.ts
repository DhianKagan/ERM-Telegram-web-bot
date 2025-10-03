// Назначение: заглушки типов для htmlparser2 в тестовой среде.
// Основные модули: htmlparser2.
declare module 'htmlparser2' {
  import type { DomNode } from 'domhandler';

  export interface ParserOptions {
    decodeEntities?: boolean;
  }

  export interface Document {
    children: DomNode[];
  }

  export function parseDocument(
    data: string,
    options?: ParserOptions,
  ): Document;
}

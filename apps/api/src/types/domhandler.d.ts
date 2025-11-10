// Назначение: заглушки типов для пакета domhandler в среде тестирования.
// Основные модули: domhandler.
declare module 'domhandler' {
  export interface DomNode {
    type: string;
    parent?: DomNode | null;
    prev?: DomNode | null;
    next?: DomNode | null;
    startIndex?: number | null;
    endIndex?: number | null;
    children?: DomNode[];
    attribs?: Record<string, string | undefined>;
    [key: string]: unknown;
  }

  export interface DataNode extends DomNode {
    data: string;
  }

  export interface Element extends DomNode {
    name: string;
    children: DomNode[];
  }

  export type Node = DomNode;
}

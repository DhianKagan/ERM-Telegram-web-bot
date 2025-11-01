// Назначение файла: типы для модулей pdfmake без официальных деклараций
// Основные модули: pdfmake
declare module 'pdfmake/interfaces' {
  export type TDocumentDefinitions = {
    content: Array<Record<string, unknown>>;
    defaultStyle?: Record<string, unknown>;
    styles?: Record<string, unknown>;
    info?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

declare module 'pdfmake' {
  import type { TDocumentDefinitions } from 'pdfmake/interfaces';

  type FontFace = {
    normal: Buffer;
    bold?: Buffer;
    italics?: Buffer;
    bolditalics?: Buffer;
  };

  type FontDescriptors = Record<string, FontFace>;

  type PdfKitDocument = {
    on(event: 'data', listener: (chunk: Buffer) => void): void;
    on(event: 'end', listener: () => void): void;
    on(event: 'error', listener: (error: Error) => void): void;
    end(): void;
  };

  export default class PdfPrinter {
    constructor(fontDescriptors: FontDescriptors);
    createPdfKitDocument(
      docDefinition: TDocumentDefinitions,
      options?: unknown,
    ): PdfKitDocument;
  }
}

declare module 'pdfmake/build/vfs_fonts' {
  const fonts: {
    pdfMake: {
      vfs: Record<string, string>;
    };
  };
  export default fonts;
}

declare module 'exceljs' {
  export class Worksheet {
    columns: Array<{ header: string; key: string; width: number }>;
    addRow(row: Record<string, unknown>): void;
    getRow(index: number): { font: { bold?: boolean } };
  }

  export class Workbook {
    creator: string;
    created: Date;
    addWorksheet(name: string): Worksheet;
    readonly xlsx: {
      writeBuffer(): Promise<ArrayBuffer>;
    };
  }

  const ExcelJS: {
    Workbook: typeof Workbook;
  };

  export default ExcelJS;
}

// Назначение: заглушка типов для sharp в тестах
declare module 'sharp' {
  type SharpColor =
    | string
    | { r: number; g: number; b: number; alpha?: number };

  type ResizeOptions = {
    width?: number;
    height?: number;
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
    position?: string | number;
    withoutEnlargement?: boolean;
  };

  type FlattenOptions = {
    background?: SharpColor;
  };

  type JpegOptions = {
    quality?: number;
    progressive?: boolean;
  };

  type CompositeInput = {
    input: Buffer | string;
    left?: number;
    top?: number;
  };

  type CreateOptions = {
    create: {
      width: number;
      height: number;
      channels?: number;
      background?: SharpColor;
    };
  };

  type Metadata = {
    width?: number;
    height?: number;
    hasAlpha?: boolean;
  };

  type SharpInput = string | Buffer | CreateOptions;

  interface SharpInstance {
    metadata(): Promise<Metadata>;
    resize(options: ResizeOptions): SharpInstance;
    resize(
      width: number,
      height: number,
      options?: ResizeOptions,
    ): SharpInstance;
    flatten(options?: FlattenOptions): SharpInstance;
    jpeg(options?: JpegOptions): SharpInstance;
    composite(images: CompositeInput[]): SharpInstance;
    toFile(path: string): Promise<void>;
    toBuffer(): Promise<Buffer>;
  }

  function sharp(input?: SharpInput): SharpInstance;

  export type Sharp = SharpInstance;

  export default sharp;
}

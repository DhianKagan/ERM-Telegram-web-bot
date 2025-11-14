// Назначение: упрощённые типы mongoose для unit-тестов и скриптов
// Модули: mongoose, mongodb

declare module 'mongoose' {
  import type { AnyBulkWriteOperation } from 'mongodb';

  export interface ConnectOptions {
    serverSelectionTimeoutMS?: number;
  }

  export interface AdminDb {
    ping(): Promise<void>;
  }

  export interface DatabaseHandle {
    admin(): AdminDb;
  }

  export interface Connection {
    readyState: number;
    db?: DatabaseHandle;
  }

  export namespace Types {
    class ObjectId {
      constructor(id?: string);
      toHexString(): string;
      static isValid(value: unknown): boolean;
    }
  }

    export class Schema<T = unknown> {
      readonly dummy?: T;
      constructor(
        definition?: Record<string, unknown>,
        options?: Record<string, unknown>,
      );
    static Types: {
      Mixed: unknown;
      ObjectId: typeof Types.ObjectId;
    };
  }

  export interface UpdateResult {
    upsertedCount?: number;
    modifiedCount?: number;
  }

  export interface BulkWriteOptions {
    ordered?: boolean;
  }

  export interface BulkWriteResult {
    modifiedCount?: number;
    upsertedCount?: number;
  }

  export interface Model<T> {
    find(filter?: Record<string, unknown>): {
      lean(): Promise<T[]>;
      lean<U>(): Promise<U[]>;
    };
    updateOne(
      filter: Record<string, unknown>,
      update: Record<string, unknown>,
      options?: Record<string, unknown>,
    ): Promise<UpdateResult>;
    bulkWrite(
      operations: Array<AnyBulkWriteOperation<T>>,
      options?: BulkWriteOptions,
    ): Promise<BulkWriteResult>;
    create(doc: Partial<T>): Promise<T & { toObject(): T }>;
  }

  export const models: Record<string, Model<unknown>>;

  export function model<T>(
    name: string,
    schema: Schema<T>,
    collection?: string,
  ): Model<T>;

  export function connect(uri: string, options?: ConnectOptions): Promise<void>;

  export function disconnect(): Promise<void>;

  export const connection: Connection;
}

// Назначение: минимальные типы mongodb для unit-тестов и скриптов
// Модули: mongodb

declare module 'mongodb' {
  export type AnyBulkWriteOperation<T> =
    | { updateOne: { filter: Record<string, unknown>; update: Record<string, unknown> } }
    | { deleteOne: { filter: Record<string, unknown> } }
    | { deleteMany: { filter: Record<string, unknown> } }
    | { insertOne: { document: T } };
}

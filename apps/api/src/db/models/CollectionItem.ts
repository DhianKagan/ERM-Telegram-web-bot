// Назначение файла: модель универсальной коллекции
// Основные модули: mongoose
import { Schema, model, Document } from 'mongoose';

export interface CollectionItemAttrs {
  type: string;
  name: string;
  value: string;
}

export interface CollectionItemDocument extends CollectionItemAttrs, Document {}

const collectionItemSchema = new Schema<CollectionItemDocument>({
  type: { type: String, required: true },
  name: { type: String, required: true },
  value: { type: String, required: true },
});

collectionItemSchema.index(
  { type: 1, name: 1 },
  { name: 'type_name_unique', unique: true },
);
collectionItemSchema.index(
  { type: 'text', name: 'text', value: 'text' },
  { name: 'search_text' },
);

export const CollectionItem = model<CollectionItemDocument>(
  'CollectionItem',
  collectionItemSchema,
);

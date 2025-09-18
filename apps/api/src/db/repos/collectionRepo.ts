// Назначение файла: репозиторий элементов коллекции
// Основные модули: mongoose, модели CollectionItem
import { Types } from 'mongoose';
import {
  CollectionItem,
  CollectionItemDocument,
  CollectionItemAttrs,
} from '../models/CollectionItem';

export interface CollectionFilters {
  type?: string;
  name?: string;
  value?: string;
  search?: string;
}

export async function create(
  data: CollectionItemAttrs & { _id?: Types.ObjectId | string },
): Promise<CollectionItemDocument> {
  const payload: Record<string, unknown> = {
    type: data.type,
    name: data.name,
    value: data.value,
  };
  if (data._id) {
    payload._id =
      typeof data._id === 'string' ? new Types.ObjectId(data._id) : data._id;
  }
  return CollectionItem.create(payload);
}

export async function list(
  filters: CollectionFilters = {},
  page = 1,
  limit = 20,
): Promise<{ items: CollectionItemDocument[]; total: number }> {
  const q: Record<string, unknown> = {};
  if (filters.type) q.type = filters.type;
  if (filters.name) q.name = filters.name;
  if (filters.value) q.value = filters.value;
  if (filters.search) q.$text = { $search: filters.search };
  const total = await CollectionItem.countDocuments(q);
  const items = await CollectionItem.find(q)
    .skip((page - 1) * limit)
    .limit(limit)
    .exec();
  return { items, total };
}

export async function update(
  id: string,
  data: Partial<CollectionItemAttrs>,
): Promise<CollectionItemDocument | null> {
  return CollectionItem.findByIdAndUpdate(id, data, { new: true });
}

export async function remove(
  id: string,
): Promise<CollectionItemDocument | null> {
  return CollectionItem.findByIdAndDelete(id);
}

export default { create, list, update, remove };

// Назначение: универсальная коллекция с CRUD-методами, валидацией и React-хуком.
// Основные модули: Collection, функции валидации, хук useCrud.

import { useState, useCallback } from 'react';
import type {
  BaseItem,
  Employee,
  CollectionType,
  Fleet,
  Department,
} from './types';

export class Collection<T extends BaseItem> {
  private items: Map<string, T> = new Map();

  create(item: T): T {
    this.items.set(item.id, item);
    return item;
  }

  read(id: string): T | undefined {
    return this.items.get(id);
  }

  update(id: string, data: Partial<T>): T | undefined {
    const current = this.items.get(id);
    if (!current) return undefined;
    const updated = { ...current, ...data };
    this.items.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.items.delete(id);
  }

  list(): T[] {
    return Array.from(this.items.values());
  }
}

export function validateCollectionType(type: string): type is CollectionType {
  return ['fleets', 'departments', 'divisions', 'roles', 'employees'].includes(
    type,
  );
}

export function validateBaseItem(item: BaseItem): boolean {
  return Boolean(item.id && item.name);
}

export function validateFleet(fleet: Fleet): boolean {
  return validateBaseItem(fleet);
}

export function validateDepartment(dept: Department): boolean {
  return validateBaseItem(dept) && Boolean(dept.fleetId);
}

export function validateEmployee(emp: Employee): boolean {
  return validateBaseItem(emp) && Boolean(emp.departmentId);
}

export function useCrud<T extends BaseItem>() {
  const [items, setItems] = useState<Record<string, T>>({});

  const create = useCallback((item: T) => {
    setItems((prev) => ({ ...prev, [item.id]: item }));
    return item;
  }, []);

  const read = useCallback((id: string) => items[id], [items]);

  const update = useCallback((id: string, data: Partial<T>) => {
    setItems((prev) => {
      const current = prev[id];
      if (!current) return prev;
      const updated = { ...current, ...data };
      return { ...prev, [id]: updated };
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  return { items: Object.values(items), create, read, update, delete: remove };
}

export type {
  CollectionType,
  BaseItem,
  Fleet,
  Department,
  Employee,
} from './types';

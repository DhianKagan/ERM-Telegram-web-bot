// Назначение: универсальная коллекция с CRUD-методами.
// Основные модули: generic Collection и интерфейсы моделей.

export interface Fleet {
  id: string;
  name: string;
}

export interface Department {
  id: string;
  fleetId: string;
  name: string;
}

export interface Employee {
  id: string;
  departmentId: string;
  name: string;
}

export class Collection<T extends { id: string }> {
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

// Назначение: список элементов коллекции с поиском и пагинацией
// Основные модули: React, Pagination
import React from "react";
import Pagination from "../../components/Pagination";
import type { CollectionItem } from "../../services/collections";

interface Props {
  items: CollectionItem[];
  selectedId?: string;
  totalPages: number;
  page: number;
  onSelect: (item: CollectionItem) => void;
  onSearch: (text: string) => void;
  onPageChange: (page: number) => void;
  renderValue?: (item: CollectionItem) => React.ReactNode;
}

export default function CollectionList({
  items,
  selectedId,
  totalPages,
  page,
  onSelect,
  onSearch,
  onPageChange,
  renderValue,
}: Props) {
  const [search, setSearch] = React.useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(search);
  };

  return (
    <div>
      <form onSubmit={submit} className="mb-2 flex gap-2">
        <input
          className="h-8 flex-1 rounded border px-2"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск"
        />
        <button type="submit" className="btn btn-blue">
          Искать
        </button>
      </form>
      <ul className="divide-y rounded border">
        {items.map((it) => (
          <li key={it._id}>
            <button
              type="button"
              onClick={() => onSelect(it)}
              className={`w-full cursor-pointer p-2 text-left ${
                selectedId === it._id ? "bg-gray" : ""
              }`}
            >
              <div className="font-medium">{it.name}</div>
              <div className="text-sm text-gray-500">
                {renderValue ? renderValue(it) : it.value}
              </div>
            </button>
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <Pagination total={totalPages} page={page} onChange={onPageChange} />
      )}
    </div>
  );
}

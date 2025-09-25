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
  searchValue?: string;
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
  searchValue,
}: Props) {
  const [search, setSearch] = React.useState(searchValue ?? "");

  React.useEffect(() => {
    setSearch(searchValue ?? "");
  }, [searchValue]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(search);
  };

  return (
    <div>
      <form
        onSubmit={submit}
        className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <input
          className="h-10 w-full rounded border px-3 sm:h-9 sm:flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск"
        />
        <button
          type="submit"
          className="btn btn-blue h-10 rounded px-4 sm:h-9 sm:px-3"
        >
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

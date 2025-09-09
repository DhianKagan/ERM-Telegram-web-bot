// Список элементов коллекции с поиском и пагинацией
// Основные модули: React, Pagination
import React from "react";
import Pagination from "../../components/Pagination";
import { CollectionItem } from "../../services/collections";

interface Props {
  items: CollectionItem[];
  total: number;
  page: number;
  limit: number;
  selectedId?: string;
  onSelect: (item: CollectionItem) => void;
  onSearch: (value: string) => void;
  search: string;
  onPageChange: (p: number) => void;
}

export default function CollectionList({
  items,
  total,
  page,
  limit,
  selectedId,
  onSelect,
  onSearch,
  search,
  onPageChange,
}: Props) {
  const [text, setText] = React.useState(search);

  React.useEffect(() => {
    setText(search);
  }, [search]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(text);
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div>
      <form onSubmit={submit} className="mb-2 flex gap-2">
        <input
          className="h-8 flex-1 rounded border px-2"
          value={text}
          onChange={(e) => setText(e.target.value)}
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
              <div className="text-sm text-gray-500">{it.value}</div>
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

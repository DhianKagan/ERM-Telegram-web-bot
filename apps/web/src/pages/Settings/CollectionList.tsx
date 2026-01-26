// Назначение: список элементов коллекции с поиском и пагинацией
// Основные модули: React, Pagination
import React from 'react';

import UnifiedSearch from '@/components/UnifiedSearch';
import Pagination from '../../components/Pagination';
import type { CollectionItem } from '../../services/collections';

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
  const [search, setSearch] = React.useState(searchValue ?? '');
  const searchInputId = React.useId();

  React.useEffect(() => {
    setSearch(searchValue ?? '');
  }, [searchValue]);

  return (
    <div>
      <div className="mb-2">
        <UnifiedSearch
          id={searchInputId}
          value={search}
          onChange={setSearch}
          onSearch={() => onSearch(search)}
          onReset={() => {
            setSearch('');
            onSearch('');
          }}
          placeholder="Поиск"
          className="max-w-full"
        />
      </div>
      <ul className="divide-y rounded border">
        {items.map((it) => (
          <li key={it._id}>
            <button
              type="button"
              onClick={() => onSelect(it)}
              className={`w-full cursor-pointer p-2 text-left ${
                selectedId === it._id ? 'bg-gray' : ''
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

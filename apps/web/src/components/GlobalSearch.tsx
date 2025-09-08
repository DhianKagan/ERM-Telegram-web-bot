// Глобальный модуль поиска
// Модули: React, heroicons, i18next, ui
import React from "react";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import useTasks from "../context/useTasks";

export default function GlobalSearch() {
  const { query, setQuery } = useTasks();
  const { t } = useTranslation();
  const ref = React.useRef<HTMLInputElement>(null);

  const clear = () => {
    setQuery("");
    ref.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      clear();
      ref.current?.blur();
    }
  };

  return (
    <div className="relative">
      <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-gray-400" />
      <Input
        ref={ref}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKey}
        placeholder={t("search")}
        aria-label={t("search")}
        className="h-9 w-64 pr-8 pl-8"
      />
      {query && (
        <button
          onClick={clear}
          aria-label="Очистить"
          className="absolute top-1/2 right-2 -translate-y-1/2 text-gray-400 hover:text-black"
        >
          <XMarkIcon className="size-4" />
        </button>
      )}
    </div>
  );
}

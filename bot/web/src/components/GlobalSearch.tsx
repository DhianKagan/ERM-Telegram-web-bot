// Глобальный модуль поиска
// Модули: React, heroicons, i18next
import React from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";

export default function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const { t } = useTranslation();
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hover:text-accentPrimary rounded p-2"
        aria-label={t("search")}
      >
        <MagnifyingGlassIcon className="h-5 w-5" />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search")}
              className="w-full rounded border px-2 py-1"
            />
          </div>
        </div>
      )}
    </>
  );
}

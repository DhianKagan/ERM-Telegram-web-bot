// Глобальный модуль поиска
// Модули: React, heroicons, i18next
import React from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import useTasks from "../context/useTasks";

export default function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const { query, setQuery } = useTasks();
  const { t } = useTranslation();
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="ghost"
        size="icon"
        aria-label={t("search")}
        className="size-12"
      >
        <MagnifyingGlassIcon className="size-5" />
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <label htmlFor="global-search" className="sr-only">
              {t("search")}
            </label>
            <Input
              id="global-search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search")}
              className="h-12"
            />
          </div>
        </div>
      )}
    </>
  );
}

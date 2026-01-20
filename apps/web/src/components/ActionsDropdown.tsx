// Назначение: компактное меню управления/экспорта для панелей.
// Основные модули: React, Radix Dropdown Menu, Button.
import React from 'react';
import { MoreVertical } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type ActionsDropdownProps = {
  onManage?: () => void;
  onExport?: () => void;
  onSettings?: () => void;
  onSort?: () => void;
};

export default function ActionsDropdown({
  onManage,
  onExport,
  onSettings,
  onSort,
}: ActionsDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Открыть меню управления"
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem
          onClick={() => {
            onManage?.();
          }}
        >
          Управление
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            onExport?.();
          }}
        >
          Экспорт
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            onSettings?.();
          }}
        >
          Настройки
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            onSort?.();
          }}
        >
          Сортировка
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

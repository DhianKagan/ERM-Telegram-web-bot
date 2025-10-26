// Назначение файла: Jest-заглушка для пакета @dnd-kit/sortable
// Основные модули: React
import React from "react";

type ContextProps = {
  children?: React.ReactNode;
  items: readonly unknown[];
  strategy?: (...args: unknown[]) => unknown;
};

export const SortableContext: React.FC<ContextProps> = ({ children }) => (
  <>{children}</>
);

export const sortableKeyboardCoordinates = () => [];
export const verticalListSortingStrategy = () => [];

export interface UseSortableOptions {
  id: string;
  data?: Record<string, unknown>;
  disabled?: boolean;
}

export const useSortable = (_options: UseSortableOptions) => ({
  attributes: {},
  listeners: {},
  setNodeRef: () => undefined,
  transform: null as { x?: number; y?: number } | null,
  transition: undefined as string | undefined,
  isDragging: false,
  isOver: false,
});

// Назначение файла: заглушки модулей @dnd-kit для фронтенд-тестов
// Основные модули: React
import type * as React from "react";

declare module "@dnd-kit/core" {
  export interface DragEventBase {
    id: string | number;
    data: { current: unknown };
  }

  export interface DragEndEvent {
    active: DragEventBase;
    over: DragEventBase | null;
  }

  export interface DragStartEvent {
    active: DragEventBase;
  }

  export interface DragOverEvent {
    active: DragEventBase;
    over: DragEventBase | null;
  }

  export interface DndContextProps {
    children?: React.ReactNode;
    onDragStart?: (event: DragStartEvent) => void;
    onDragOver?: (event: DragOverEvent) => void;
    onDragEnd?: (event: DragEndEvent) => void;
    sensors?: unknown[];
    collisionDetection?: (...args: unknown[]) => unknown;
  }

  export const DndContext: React.FC<DndContextProps>;

  export class PointerSensor {
    constructor(...args: unknown[]);
  }

  export class KeyboardSensor {
    constructor(...args: unknown[]);
  }

  export const closestCenter: (...args: unknown[]) => unknown;

  export const useSensor: <T>(
    sensor: new (...args: unknown[]) => T,
    options?: unknown,
  ) => T;
  export const useSensors: (...sensors: unknown[]) => unknown[];

  export interface DroppableProps {
    id: string;
    disabled?: boolean;
    data?: Record<string, unknown>;
  }

  export interface DroppableHookResult {
    isOver: boolean;
    setNodeRef: (node: HTMLElement | null) => void;
  }

  export function useDroppable(props: DroppableProps): DroppableHookResult;
}

declare module "@dnd-kit/sortable" {
  import type * as React from "react";

  export interface SortableContextProps {
    children?: React.ReactNode;
    items: readonly unknown[];
    strategy?: (...args: unknown[]) => unknown;
  }

  export const SortableContext: React.FC<SortableContextProps>;

  export const sortableKeyboardCoordinates: (...args: unknown[]) => unknown;
  export const verticalListSortingStrategy: (...args: unknown[]) => unknown;

  export interface UseSortableOptions {
    id: string;
    data?: Record<string, unknown>;
    disabled?: boolean;
  }

  export interface UseSortableReturn {
    attributes: Record<string, unknown>;
    listeners: Record<string, unknown>;
    setNodeRef: (node: HTMLElement | null) => void;
    transform: {
      x?: number;
      y?: number;
      scaleX?: number;
      scaleY?: number;
    } | null;
    transition?: string;
    isDragging: boolean;
    isOver: boolean;
  }

  export function useSortable(options: UseSortableOptions): UseSortableReturn;
}

declare module "@dnd-kit/utilities" {
  export const CSS: {
    Transform: {
      toString: (transform?: Record<string, unknown> | null) => string;
    };
  };
}

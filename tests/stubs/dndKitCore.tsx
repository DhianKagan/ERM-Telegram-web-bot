// Назначение файла: Jest-заглушка для пакета @dnd-kit/core
// Основные модули: React
import React from "react";

export type DragEventBase = {
  id: string | number;
  data: { current: unknown };
};

export type DragStartEvent = { active: DragEventBase };
export type DragEndEvent = { active: DragEventBase; over: DragEventBase | null };
export type DragOverEvent = DragEndEvent;

type Props = {
  children?: React.ReactNode;
  sensors?: unknown[];
  collisionDetection?: (...args: unknown[]) => unknown;
  onDragStart?: (event: DragStartEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
};

export const DndContext: React.FC<Props> = ({
  children,
  sensors = [],
  collisionDetection,
  onDragStart,
  onDragOver,
  onDragEnd,
}) => {
  void sensors;
  void collisionDetection;
  const mockEvent: DragEndEvent = {
    active: { id: "mock", data: { current: null } },
    over: null,
  };
  const handleEvent = (handler?: (event: DragEndEvent) => void) => {
    if (typeof handler === "function") {
      handler(mockEvent);
    }
  };
  React.useEffect(() => {
    if (typeof onDragStart === "function") {
      onDragStart({ active: mockEvent.active });
    }
    handleEvent(onDragOver);
    handleEvent(onDragEnd);
  }, [onDragEnd, onDragOver, onDragStart]);
  return <>{children}</>;
};

export class PointerSensor {
  constructor(..._args: unknown[]) {}
}

export class KeyboardSensor {
  constructor(..._args: unknown[]) {}
}

export const closestCenter = () => ({ x: 0, y: 0 });

export const useSensor = <T,>(
  sensor: new (...args: unknown[]) => T,
  _options?: unknown,
): T => new sensor();
export const useSensors = (...sensors: unknown[]) => sensors;

export interface DroppableProps {
  id: string;
  disabled?: boolean;
  data?: Record<string, unknown>;
}

export const useDroppable = (_props: DroppableProps) => ({
  isOver: false,
  setNodeRef: () => undefined,
});

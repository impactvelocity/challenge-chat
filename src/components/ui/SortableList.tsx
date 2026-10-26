import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, type ReactNode } from 'react';

type Item = { id: number | string };

type SortableListProps<T extends Item> = {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T) => ReactNode;
  getLabel: (item: T) => string;
};

/** Drag-to-sort rows. The grip is the drag activator; keyboard sorting via Space + arrows. */
export function SortableList<T extends Item>({ items, onReorder, renderItem, getLabel }: SortableListProps<T>) {
  const [activeId, setActiveId] = useState<T['id'] | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const active = items.find((i) => i.id === activeId);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    onReorder(arrayMove(items, from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => setActiveId(e.active.id as T['id'])}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2.5">
          {items.map((item, i) => (
            <SortableRow key={item.id} id={item.id} label={`Position ${i + 1}: ${getLabel(item)}`}>
              {renderItem(item)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {active && (
          <div className="rrow" data-overlay="">
            <Grip />
            {renderItem(active)}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function SortableRow({ id, label, children }: { id: number | string; label: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      className="rrow"
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button ref={setActivatorNodeRef} type="button" className="grip" aria-label={`Reorder. ${label}`} {...attributes} {...listeners}>
        <GripDots />
      </button>
      {children}
    </div>
  );
}

function Grip() {
  return (
    <span className="grip" aria-hidden="true">
      <GripDots />
    </span>
  );
}

function GripDots() {
  return (
    <>
      <i />
      <i />
      <i />
      <i />
      <i />
      <i />
    </>
  );
}

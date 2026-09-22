'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { sideLetter } from '@/lib/format';
import type { Rower } from '@/lib/types';

interface Props {
  rower: Rower;
  location?: string;
}

export function RowerRow({ rower, location }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `rower|${rower.id}`,
    data: { rowerId: rower.id },
  });
  const letter = rower.isCoxswain ? 'C' : sideLetter(rower.sidePreference);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...listeners}
      {...attributes}
      className={`flex items-center justify-between gap-2 border-b border-line px-1 py-2 text-xs ${
        rower.status === 'unavailable' ? 'text-ink-muted' : ''
      } ${isDragging ? 'opacity-30' : ''}`}
    >
      <span className={rower.status === 'unavailable' ? 'line-through' : 'truncate'}>
        {rower.name}
      </span>
      <span className="flex shrink-0 items-center gap-2 text-[10px] text-ink-muted">
        {location && <span>{location}</span>}
        <span>{letter}</span>
      </span>
    </div>
  );
}

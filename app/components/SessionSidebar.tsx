'use client';

import { formatDate } from '@/lib/format';
import type { Session } from '@/lib/types';

interface Props {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  sessions: Session[];
  selectedSessionId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDuplicate: () => void;
}

export function SessionSidebar({
  selectedDate,
  setSelectedDate,
  sessions,
  selectedSessionId,
  onSelect,
  onNew,
  onDuplicate,
}: Props) {
  return (
    <aside className="card h-fit p-4">
      <div className="flex items-center justify-between">
        <span className="label-caps">Sessions</span>
        <button className="button-primary px-2.5 py-1" onClick={onNew}>
          + New
        </button>
      </div>
      <input
        type="date"
        value={selectedDate}
        onChange={(event) => setSelectedDate(event.target.value)}
        className="focus-ring mt-3 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
      />
      <div className="mt-4 space-y-1">
        {sessions.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`focus-ring w-full rounded-lg px-3 py-2 text-left ${
              selectedSessionId === item.id
                ? 'bg-cardinal-soft text-cardinal ring-1 ring-cardinal'
                : 'hover:bg-paper-alt'
            }`}
          >
            <span className="block text-sm font-medium">{item.label}</span>
            <span className="text-[10px] text-ink-muted">{item.boats.length} boats</span>
          </button>
        ))}
        {!sessions.length && (
          <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-ink-muted">
            No sessions for {formatDate(selectedDate)}.
          </p>
        )}
      </div>
      <div className="mt-4 border-t border-line pt-3">
        <button onClick={onDuplicate} className="button-secondary w-full px-3 py-2 text-xs">
          Duplicate previous
        </button>
      </div>
    </aside>
  );
}

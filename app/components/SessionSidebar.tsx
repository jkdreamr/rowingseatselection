'use client';

import { formatDate } from '@/lib/format';
import { sessionTitle } from '@/lib/lineupText';
import type { LineupClipboard } from '@/lib/storage';
import type { Session } from '@/lib/types';

export interface SessionGroup {
  groupId: string;
  label: string;
  variants: Session[];
}

interface Props {
  mode: 'session' | 'playground';
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  groups: SessionGroup[];
  selectedSessionId?: string;
  onSelect: (session: Session) => void;
  onNew: () => void;
  onDuplicate: () => void;
  clipboard: LineupClipboard | null;
  onPaste: () => void;
}

export function SessionSidebar({
  mode,
  selectedDate,
  setSelectedDate,
  groups,
  selectedSessionId,
  onSelect,
  onNew,
  onDuplicate,
  clipboard,
  onPaste,
}: Props) {
  return (
    <aside className="card h-fit p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="label-caps">{mode === 'playground' ? 'Playground' : 'Sessions'}</span>
        <button className="button-primary px-2.5 py-1" onClick={onNew}>
          + New
        </button>
      </div>
      {mode === 'session' && (
        <input
          type="date"
          value={selectedDate}
          onChange={(event) => setSelectedDate(event.target.value)}
          className="focus-ring mt-3 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
        />
      )}
      <div className="mt-4 space-y-1">
        {groups.map((group) => {
          const selected = group.variants.some((item) => item.id === selectedSessionId);
          return (
            <button
              key={group.groupId}
              onClick={() =>
                onSelect(
                  group.variants.find((item) => item.id === selectedSessionId) ?? group.variants[0],
                )
              }
              className={`focus-ring w-full rounded-lg px-3 py-2 text-left ${
                selected ? 'bg-cardinal-soft text-cardinal ring-1 ring-cardinal' : 'hover:bg-paper-alt'
              }`}
            >
              <span className="block text-sm font-medium">{group.label}</span>
              <span className="text-[10px] text-ink-muted">
                {group.variants.length === 1
                  ? `${group.variants[0].boats.length} boats`
                  : `${group.variants.length} lineups`}
              </span>
            </button>
          );
        })}
        {!groups.length && (
          <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-ink-muted">
            {mode === 'playground'
              ? 'No playground lineups.'
              : `No sessions for ${formatDate(selectedDate)}.`}
          </p>
        )}
      </div>
      <div className="mt-4 space-y-2 border-t border-line pt-3">
        {mode === 'session' && (
          <button onClick={onDuplicate} className="button-secondary w-full px-3 py-2 text-xs">
            Duplicate previous
          </button>
        )}
        {clipboard?.kind === 'session' && (
          <>
            <button onClick={onPaste} className="button-secondary w-full px-3 py-2 text-xs">
              Paste lineup
            </button>
            <p className="text-[10px] text-ink-muted">
              Copied: {sessionTitle(clipboard.session, 1)}
            </p>
          </>
        )}
      </div>
    </aside>
  );
}

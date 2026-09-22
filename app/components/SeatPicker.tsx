'use client';

import type { Rower } from '@/lib/types';

interface Props {
  rowers: Rower[];
  locations: Map<string, string>;
  search: string;
  setSearch: (value: string) => void;
  onPick: (id: string) => void;
  onClose: () => void;
}

export function SeatPicker({ rowers, locations, search, setSearch, onPick, onClose }: Props) {
  const matches = rowers
    .filter((rower) => rower.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(locations.has(a.id)) - Number(locations.has(b.id)))
    .slice(0, 8);
  return (
    <div className="absolute inset-x-8 top-32 z-30 rounded-xl border border-line bg-paper p-3">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="focus-ring min-w-0 flex-1 rounded-lg border border-line bg-paper px-2 py-1.5 text-xs"
          placeholder="Search roster…"
        />
        <button onClick={onClose} className="text-ink-muted">
          ×
        </button>
      </div>
      <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
        {matches.map((rower) => {
          const location = locations.get(rower.id);
          return (
            <button
              key={rower.id}
              onClick={() => onPick(rower.id)}
              className={`focus-ring flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs ${
                location
                  ? 'border-l-2 border-l-cardinal bg-cardinal-soft text-ink'
                  : 'hover:bg-paper-alt'
              }`}
            >
              <span className={rower.status === 'unavailable' ? 'text-ink-muted line-through' : ''}>
                {rower.name}
              </span>
              <span className={location ? 'text-cardinal' : 'text-ink-muted'}>
                {location ?? rower.status}
              </span>
            </button>
          );
        })}
        {!matches.length && (
          <p className="py-3 text-center text-xs text-ink-muted">No rowers found.</p>
        )}
      </div>
    </div>
  );
}

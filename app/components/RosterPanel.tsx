'use client';

import { useDroppable } from '@dnd-kit/core';
import { RowerRow } from './RowerRow';
import type { Rower } from '@/lib/types';

interface Props {
  rowers: Rower[];
  allRowers: Rower[];
  locations: Map<string, string>;
  search: string;
  setSearch: (value: string) => void;
  groupFilter: string;
  setGroupFilter: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  groups: string[];
  onSample: () => void;
}

export function RosterPanel({
  rowers,
  allRowers,
  locations,
  search,
  setSearch,
  groupFilter,
  setGroupFilter,
  statusFilter,
  setStatusFilter,
  groups,
  onSample,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unassigned' });
  const seatedCount = rowers.filter((rower) => locations.has(rower.id)).length;
  return (
    <aside className="card h-fit p-4 xl:sticky xl:top-[76px]">
      <div className="flex items-center justify-between">
        <span className="label-caps">Roster</span>
        <span className="text-xs text-ink-muted">{allRowers.length}</span>
      </div>
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="focus-ring mt-3 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
        placeholder="Search rowers…"
      />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <select
          value={groupFilter}
          onChange={(event) => setGroupFilter(event.target.value)}
          className="focus-ring rounded-lg border border-line bg-paper px-2 py-2 text-[10px]"
        >
          <option value="all">All groups</option>
          {groups.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="focus-ring rounded-lg border border-line bg-paper px-2 py-2 text-[10px]"
        >
          <option value="all">All status</option>
          <option value="available">Available</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </div>
      <p className="mt-2 text-[10px] text-ink-muted">
        {seatedCount} seated · {rowers.length - seatedCount} unassigned
      </p>
      <div
        ref={setNodeRef}
        className={`mt-3 rounded-lg border border-dashed px-3 py-2 text-center text-[10px] text-ink-muted ${
          isOver ? 'border-cardinal bg-cardinal-soft' : 'border-line'
        }`}
      >
        Drop here to unassign · or double-click a seated rower
      </div>
      <div className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto pr-1">
        {['Coxswains', 'Port', 'Starboard', 'Both', 'Scull', 'Unavailable'].map((group) => {
          const members = rowers.filter((rower) =>
            group === 'Unavailable'
              ? rower.status === 'unavailable'
              : rower.status !== 'available'
                ? false
                : group === 'Coxswains'
                  ? rower.isCoxswain
                  : !rower.isCoxswain &&
                    (group === 'Port'
                      ? rower.sidePreference === 'port'
                      : group === 'Starboard'
                        ? rower.sidePreference === 'starboard'
                        : group === 'Both'
                          ? rower.sidePreference === 'both'
                          : rower.sidePreference === 'scull'),
          );
          if (!members.length) return null;
          return (
            <div key={group}>
              <p className="label-caps mb-1">{group}</p>
              {members.map((rower) => (
                <RowerRow
                  key={rower.id}
                  rower={rower}
                  seated={locations.has(rower.id)}
                  location={locations.get(rower.id)}
                />
              ))}
            </div>
          );
        })}
      </div>
      {!allRowers.length && (
        <button className="button-primary mt-4 w-full px-3 py-2" onClick={onSample}>
          Load sample roster
        </button>
      )}
    </aside>
  );
}

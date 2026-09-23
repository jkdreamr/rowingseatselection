'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLineupStore } from '@/lib/store';
import { formatDate } from '@/lib/format';
import { seatLabel, sessionTitle, sessionToText } from '@/lib/lineupText';
import type { Rower, Session } from '@/lib/types';

const MAX_SELECTED = 6;

function rowerLocations(session: Session): Map<string, string> {
  const map = new Map<string, string>();
  for (const boat of session.boats) {
    if (boat.coxswainId) map.set(boat.coxswainId, `${boat.name} · C`);
    for (const seat of boat.seats) {
      if (seat.rowerId) map.set(seat.rowerId, `${boat.name} · ${seatLabel(seat.number)}`);
    }
  }
  return map;
}

export default function ComparePage() {
  return (
    <Suspense fallback={null}>
      <CompareView />
    </Suspense>
  );
}

function CompareView() {
  const { present, loaded } = useLineupStore();
  const params = useSearchParams();
  const [selected, setSelected] = useState<string[]>(() =>
    (params.get('ids') ?? '').split(',').filter(Boolean).slice(0, MAX_SELECTED),
  );
  const [copied, setCopied] = useState(false);

  const groupsByVariantCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const session of present.sessions)
      counts.set(session.groupId, (counts.get(session.groupId) ?? 0) + 1);
    return counts;
  }, [present.sessions]);

  const dated = useMemo(
    () =>
      present.sessions
        .filter((session) => session.kind === 'session')
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            a.label.localeCompare(b.label) ||
            a.variant.localeCompare(b.variant),
        ),
    [present.sessions],
  );
  const playground = useMemo(
    () => present.sessions.filter((session) => session.kind === 'playground'),
    [present.sessions],
  );
  const byDate = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const session of dated) map.set(session.date, [...(map.get(session.date) ?? []), session]);
    return [...map.entries()];
  }, [dated]);

  const chosen = selected
    .map((id) => present.sessions.find((session) => session.id === id))
    .filter((session): session is Session => Boolean(session));
  const locations = chosen.map(rowerLocations);
  const rowerName = (id: string | null) =>
    present.rowers.find((rower) => rower.id === id)?.name ?? '—';
  const title = (session: Session) =>
    sessionTitle(session, groupsByVariantCount.get(session.groupId) ?? 1);

  const involved: Rower[] = present.rowers
    .filter((rower) => locations.some((map) => map.has(rower.id)))
    .sort((a, b) => a.name.localeCompare(b.name));

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length >= MAX_SELECTED
          ? current
          : [...current, id],
    );

  const copyAll = async () => {
    const text = chosen
      .map((session) =>
        sessionToText(session, present.rowers, groupsByVariantCount.get(session.groupId) ?? 1),
      )
      .join('\n\n---\n\n');
    await navigator.clipboard?.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  if (!loaded)
    return (
      <main className="mx-auto max-w-[1600px] px-4 py-10">
        <div className="card h-96 animate-pulse" />
      </main>
    );

  const renderOption = (session: Session) => {
    const isSelected = selected.includes(session.id);
    const disabled = !isSelected && selected.length >= MAX_SELECTED;
    return (
      <label
        key={session.id}
        className={`flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm ${
          isSelected ? 'bg-cardinal-soft' : 'hover:bg-paper-alt'
        } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        <input
          type="checkbox"
          checked={isSelected}
          disabled={disabled}
          onChange={() => toggle(session.id)}
        />
        <span className="truncate">
          {session.label}
          {(groupsByVariantCount.get(session.groupId) ?? 1) > 1 && (
            <span className="text-ink-muted"> · {session.variant}</span>
          )}
        </span>
        <span className="ml-auto shrink-0 text-xs text-ink-muted">
          {session.boats.length} boats
        </span>
      </label>
    );
  };

  return (
    <main className="mx-auto max-w-[1600px] px-4 pb-24 pt-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-editorial">Compare</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Pick up to {MAX_SELECTED} lineups. Rowers who change boats are marked in cardinal.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="button-secondary px-3 py-1.5 text-sm"
            onClick={copyAll}
            disabled={chosen.length === 0}
          >
            Copy as text
          </button>
          {copied && <span className="text-xs text-cardinal">Copied</span>}
          <button
            className="button-secondary px-3 py-1.5 text-sm"
            onClick={() => setSelected([])}
            disabled={chosen.length === 0}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="card max-h-[70vh] overflow-y-auto p-2">
          {byDate.length === 0 && playground.length === 0 && (
            <p className="p-2 text-sm text-ink-muted">No lineups yet.</p>
          )}
          {byDate.map(([date, sessions]) => (
            <div key={date} className="mb-2">
              <p className="label-caps px-2 pt-2">{formatDate(date)}</p>
              {sessions.map(renderOption)}
            </div>
          ))}
          {playground.length > 0 && (
            <div className="mb-2">
              <p className="label-caps px-2 pt-2">Playground</p>
              {playground.map(renderOption)}
            </div>
          )}
        </aside>

        <section className="min-w-0 space-y-6">
          {chosen.length === 0 ? (
            <div className="card flex h-64 items-center justify-center text-sm text-ink-muted">
              Select two or more lineups to compare them side by side.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <div
                  className="grid gap-4"
                  style={{
                    gridTemplateColumns: `repeat(${chosen.length}, minmax(240px, 1fr))`,
                  }}
                >
                  {chosen.map((session, column) => (
                    <div key={session.id} className="card p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="text-sm font-semibold">{title(session)}</h2>
                        <button
                          className="text-xs text-ink-muted hover:text-cardinal"
                          onClick={() => toggle(session.id)}
                          aria-label={`Remove ${title(session)}`}
                        >
                          ×
                        </button>
                      </div>
                      {session.notes.trim() && (
                        <p className="mt-2 whitespace-pre-wrap text-xs text-ink-soft">
                          {session.notes}
                        </p>
                      )}
                      <div className="mt-3 space-y-3">
                        {session.boats.length === 0 && (
                          <p className="text-xs text-ink-muted">No boats.</p>
                        )}
                        {session.boats.map((boat) => (
                          <div key={boat.id} className="border-t border-line pt-2">
                            <p className="text-xs font-semibold">
                              {boat.name}{' '}
                              <span className="font-normal text-ink-muted">{boat.classId}</span>
                            </p>
                            <ul className="mt-1 space-y-0.5 text-xs">
                              {boat.coxswainId && (
                                <li className="flex justify-between gap-2">
                                  <span className="text-ink-muted">C</span>
                                  <span
                                    className={changedClass(boat.coxswainId, column, locations)}
                                  >
                                    {rowerName(boat.coxswainId)}
                                  </span>
                                </li>
                              )}
                              {boat.seats
                                .slice()
                                .sort((a, b) => b.number - a.number)
                                .map((seat) => (
                                  <li key={seat.number} className="flex justify-between gap-2">
                                    <span className="text-ink-muted">
                                      {seatLabel(seat.number)}
                                      {seat.side && <span> {seat.side[0].toUpperCase()}</span>}
                                    </span>
                                    <span
                                      className={`truncate ${changedClass(seat.rowerId, column, locations)}`}
                                    >
                                      {rowerName(seat.rowerId)}
                                    </span>
                                  </li>
                                ))}
                            </ul>
                            {boat.notes.trim() && (
                              <p className="mt-1 whitespace-pre-wrap text-[11px] text-ink-soft">
                                {boat.notes}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {chosen.length > 1 && (
                <div className="card overflow-x-auto p-4">
                  <p className="label-caps">Where each rower sits</p>
                  <table className="mt-3 w-full text-xs">
                    <thead>
                      <tr className="text-left text-ink-muted">
                        <th className="py-1 pr-4 font-normal">Rower</th>
                        {chosen.map((session) => (
                          <th key={session.id} className="py-1 pr-4 font-normal">
                            {title(session)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {involved.map((rower) => {
                        const cells = locations.map((map) => map.get(rower.id) ?? '—');
                        const differs = new Set(cells).size > 1;
                        return (
                          <tr key={rower.id} className="border-t border-line">
                            <td className={`py-1 pr-4 ${differs ? 'font-semibold' : ''}`}>
                              {rower.name}
                            </td>
                            {cells.map((cell, index) => (
                              <td
                                key={index}
                                className={`py-1 pr-4 ${
                                  differs && cell !== cells[0] ? 'text-cardinal' : ''
                                } ${cell === '—' ? 'text-ink-muted' : ''}`}
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function changedClass(
  rowerId: string | null,
  column: number,
  locations: Map<string, string>[],
): string {
  if (!rowerId || column === 0) return '';
  const here = locations[column].get(rowerId);
  const first = locations[0].get(rowerId);
  return here !== first ? 'text-cardinal' : '';
}

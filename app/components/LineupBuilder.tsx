'use client';

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useEffect, useMemo, useState } from 'react';
import { BoatCard } from './BoatCard';
import { RosterPanel } from './RosterPanel';
import { SessionHeader } from './SessionHeader';
import { SessionSidebar } from './SessionSidebar';
import { useLineupStore } from '@/lib/store';
import { formatDate, today } from '@/lib/format';
import { newBoat, newSession } from '@/lib/factories';
import { uid } from '@/lib/ids';
import { sampleCoxswains, sampleRowers } from '@/lib/storage';
import type { Rower, SeatSource, Session } from '@/lib/types';

export default function LineupBuilder() {
  const { present, loaded, dispatch, canUndo, canRedo } = useLineupStore();
  const [selectedDate, setSelectedDate] = useState(today());
  const [selectedSessionId, setSelectedSessionId] = useState<string>();
  const [rosterSearch, setRosterSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeDrag, setActiveDrag] = useState<Rower>();
  const [picker, setPicker] = useState<{ boatId: string; seatNumber: number }>();
  const [pickerSearch, setPickerSearch] = useState('');
  const [menuBoatId, setMenuBoatId] = useState<string>();
  const [copied, setCopied] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );
  const sessionsForDate = present.sessions.filter((session) => session.date === selectedDate);
  const session =
    present.sessions.find((item) => item.id === selectedSessionId) ?? sessionsForDate[0];
  const groups = useMemo(
    () =>
      Array.from(new Set(present.rowers.map((rower) => rower.group).filter(Boolean))) as string[],
    [present.rowers],
  );
  const locations = useMemo(() => {
    const result = new Map<string, string>();
    session?.boats.forEach((boat) => {
      boat.seats.forEach((seat) => {
        if (seat.rowerId) result.set(seat.rowerId, `${boat.name} · ${seat.number}`);
      });
      if (boat.coxswainId) result.set(boat.coxswainId, `${boat.name} · cox`);
    });
    return result;
  }, [session]);
  const seatedIds = new Set(locations.keys());

  useEffect(() => {
    if (!selectedSessionId && session) setSelectedSessionId(session.id);
  }, [selectedSessionId, session]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPicker(undefined);
        setMenuBoatId(undefined);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? 'REDO' : 'UNDO' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  if (!loaded) {
    return (
      <main className="mx-auto max-w-[1600px] px-4 py-8">
        <div className="h-10 w-64 animate-pulse rounded bg-paper-alt" />
        <div className="mt-8 h-[65vh] animate-pulse rounded-card bg-paper-alt" />
      </main>
    );
  }

  const createSession = (date = selectedDate) => {
    const labels = present.sessions.filter((item) => item.date === date).map((item) => item.label);
    const label = !labels.includes('AM')
      ? 'AM'
      : !labels.includes('PM')
        ? 'PM'
        : `Session ${labels.length + 1}`;
    const created = newSession(date, label);
    dispatch({ type: 'CREATE_SESSION', session: created });
    setSelectedDate(date);
    setSelectedSessionId(created.id);
  };
  const duplicatePrevious = () => {
    const previous = present.sessions
      .filter((item) => item.date < selectedDate)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!previous) return createSession();
    const duplicate: Session = {
      ...structuredClone(previous),
      id: uid('session'),
      date: selectedDate,
      label: previous.label,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      boats: previous.boats.map((boat) => ({ ...boat, id: uid('boat') })),
    };
    dispatch({ type: 'DUPLICATE_SESSION', sourceSessionId: previous.id, session: duplicate });
    setSelectedSessionId(duplicate.id);
  };
  const copyText = async () => {
    if (!session) return;
    const lines = [`${formatDate(session.date)} — ${session.label}`];
    for (const boat of session.boats) {
      lines.push(`Boat ${boat.name} (${boat.classId})`);
      if (boat.coxswainId) {
        lines.push(
          `C: ${present.rowers.find((rower) => rower.id === boat.coxswainId)?.name ?? 'Unknown'}`,
        );
      }
      boat.seats
        .slice()
        .sort((a, b) => b.number - a.number)
        .forEach((seat) => {
          lines.push(
            `${seat.number === 1 ? 'B' : seat.number} (${seat.side ? seat.side[0].toUpperCase() : '—'}): ${
              present.rowers.find((rower) => rower.id === seat.rowerId)?.name ?? '—'
            }`,
          );
        });
    }
    await navigator.clipboard?.writeText(lines.join('\n'));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(undefined);
    const overId = String(event.over?.id ?? '');
    const activeData = event.active.data.current as
      { rowerId?: string; source?: SeatSource } | undefined;
    if (!session || !overId) return;
    const overParts = overId.split('|');
    if (overParts[0] === 'boat' && event.active.id !== event.over?.id) {
      const from = session.boats.findIndex(
        (boat) => boat.id === String(event.active.id).split('|')[1],
      );
      const to = session.boats.findIndex((boat) => boat.id === overParts[1]);
      if (from >= 0 && to >= 0)
        dispatch({ type: 'REORDER_BOATS', sessionId: session.id, from, to });
      return;
    }
    if (!activeData?.rowerId) return;
    if (overId === 'unassigned') {
      if (activeData.source) {
        if ('cox' in activeData.source) {
          dispatch({ type: 'CLEAR_COX', sessionId: session.id, boatId: activeData.source.boatId });
        } else {
          dispatch({
            type: 'CLEAR_SEAT',
            sessionId: session.id,
            boatId: activeData.source.boatId,
            seatNumber: activeData.source.seatNumber,
          });
        }
      }
      return;
    }
    if (overParts[0] === 'seat') {
      dispatch({
        type: 'ASSIGN_SEAT',
        sessionId: session.id,
        boatId: overParts[2],
        seatNumber: Number(overParts[3]),
        rowerId: activeData.rowerId,
        source: activeData.source,
      });
    } else if (overParts[0] === 'cox') {
      dispatch({
        type: 'ASSIGN_COX',
        sessionId: session.id,
        boatId: overParts[2],
        rowerId: activeData.rowerId,
        source: activeData.source,
      });
    }
  };
  const filteredRowers = present.rowers.filter((rower) => {
    const searchMatch =
      rower.name.toLowerCase().includes(rosterSearch.toLowerCase()) ||
      rower.group?.toLowerCase().includes(rosterSearch.toLowerCase());
    return (
      searchMatch &&
      (groupFilter === 'all' || rower.group === groupFilter) &&
      (statusFilter === 'all' || rower.status === statusFilter)
    );
  });

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(event) => {
        const rowerId = (event.active.data.current as { rowerId?: string })?.rowerId;
        setActiveDrag(present.rowers.find((rower) => rower.id === rowerId));
      }}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(undefined)}
    >
      <main className="mx-auto max-w-[1600px] px-3 pb-24 pt-5 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-editorial">Lineups</h1>
          <div className="flex items-center gap-2">
            <button
              className="button-secondary px-3 py-2"
              onClick={() => dispatch({ type: 'UNDO' })}
              disabled={!canUndo}
            >
              Undo
            </button>
            <button
              className="button-secondary px-3 py-2"
              onClick={() => dispatch({ type: 'REDO' })}
              disabled={!canRedo}
            >
              Redo
            </button>
            <button className="button-secondary px-3 py-2" onClick={() => void copyText()}>
              Copy as text
            </button>
            {copied && <span className="text-xs text-cardinal">Copied</span>}
            {session && (
              <a
                className="button-secondary px-3 py-2"
                href={`/print/${session.id}`}
                target="_blank"
              >
                Print
              </a>
            )}
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_300px]">
          <SessionSidebar
            selectedDate={selectedDate}
            setSelectedDate={(date) => {
              setSelectedDate(date);
              setSelectedSessionId(undefined);
            }}
            sessions={sessionsForDate}
            selectedSessionId={session?.id}
            onSelect={setSelectedSessionId}
            onNew={() => createSession()}
            onDuplicate={duplicatePrevious}
          />
          <section className="min-w-0">
            {session ? (
              <div className="space-y-4">
                <SessionHeader
                  session={session}
                  rowerCount={locations.size}
                  dispatch={dispatch}
                  onDelete={() => setSelectedSessionId(undefined)}
                  onAddBoat={() =>
                    dispatch({
                      type: 'ADD_BOAT',
                      sessionId: session.id,
                      boat: newBoat(session.boats.length + 1),
                    })
                  }
                />
                {!session.boats.length && (
                  <div className="card p-10 text-center text-sm text-ink-muted">
                    Add a boat to begin assigning seats.
                  </div>
                )}
                <SortableContext
                  items={session.boats.map((boat) => `boat|${boat.id}`)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {session.boats.map((boat) => (
                      <BoatCard
                        key={boat.id}
                        session={session}
                        boat={boat}
                        rowers={present.rowers}
                        dispatch={dispatch}
                        menuOpen={menuBoatId === boat.id}
                        setMenuOpen={(open) => setMenuBoatId(open ? boat.id : undefined)}
                        picker={picker}
                        setPicker={setPicker}
                        pickerSearch={pickerSearch}
                        setPickerSearch={setPickerSearch}
                      />
                    ))}
                  </div>
                </SortableContext>
              </div>
            ) : (
              <div className="card flex min-h-[520px] flex-col items-center justify-center p-8 text-center">
                <h2 className="text-xl font-semibold">Start a session</h2>
                <p className="mt-2 max-w-sm text-sm text-ink-soft">
                  Create a session to begin assigning seats.
                </p>
                <button className="button-primary mt-5 px-4 py-2" onClick={() => createSession()}>
                  New session
                </button>
              </div>
            )}
          </section>
          <RosterPanel
            rowers={filteredRowers}
            allRowers={present.rowers}
            locations={locations}
            seatedIds={seatedIds}
            search={rosterSearch}
            setSearch={setRosterSearch}
            groupFilter={groupFilter}
            setGroupFilter={setGroupFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            groups={groups}
            onSample={() =>
              sampleRowers()
                .concat(sampleCoxswains())
                .forEach((rower) => dispatch({ type: 'ADD_ROWER', rower }))
            }
          />
        </div>
      </main>
      <DragOverlay>
        {activeDrag ? (
          <div className="rounded-lg border border-cardinal bg-paper px-3 py-2 text-sm">
            {activeDrag.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

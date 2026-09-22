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
import { SessionSidebar, type SessionGroup } from './SessionSidebar';
import { useLineupStore } from '@/lib/store';
import { formatDate, today } from '@/lib/format';
import { cloneBoat, cloneSession, newBoat, newSession, nextVariantName } from '@/lib/factories';
import { uid } from '@/lib/ids';
import { sessionToText } from '@/lib/lineupText';
import { sampleCoxswains, sampleRowers } from '@/lib/storage';
import type { Rower, SeatSource, Session } from '@/lib/types';

interface Props {
  mode?: 'session' | 'playground';
}

export default function LineupBuilder({ mode = 'session' }: Props) {
  const { present, loaded, dispatch, canUndo, canRedo, coach, clipboard, setClipboard } =
    useLineupStore();
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
  const [copyFeedback, setCopyFeedback] = useState('');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );
  const visibleSessions = useMemo(
    () =>
      present.sessions.filter(
        (item) => item.kind === mode && (mode === 'playground' || item.date === selectedDate),
      ),
    [mode, present.sessions, selectedDate],
  );
  const grouped = useMemo(() => {
    const map = new Map<string, Session[]>();
    visibleSessions.forEach((item) =>
      map.set(item.groupId, [...(map.get(item.groupId) ?? []), item]),
    );
    return Array.from(map, ([groupId, variants]) => ({
      groupId,
      label: variants[0].label,
      variants: variants.slice().sort((a, b) => a.variant.localeCompare(b.variant)),
    }));
  }, [visibleSessions]);
  const session =
    visibleSessions.find((item) => item.id === selectedSessionId) ?? grouped[0]?.variants[0];
  const sessionGroup = grouped.find((group) => group.groupId === session?.groupId);
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
  const rosterGroups = useMemo(
    () =>
      Array.from(new Set(present.rowers.map((rower) => rower.group).filter(Boolean))) as string[],
    [present.rowers],
  );

  useEffect(() => {
    if (session && session.id !== selectedSessionId) setSelectedSessionId(session.id);
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
        <div className="mt-8 h-[65vh] animate-pulse rounded bg-paper-alt" />
      </main>
    );
  }

  const createLineup = () => {
    if (mode === 'playground') {
      const count = present.sessions.filter((item) => item.kind === 'playground').length;
      const created = newSession(undefined, `Scratch ${count + 1}`, { kind: 'playground' });
      dispatch({ type: 'CREATE_SESSION', session: created });
      setSelectedSessionId(created.id);
      return;
    }
    const labels = present.sessions
      .filter((item) => item.kind === 'session' && item.date === selectedDate)
      .map((item) => item.label);
    const label = !labels.includes('AM')
      ? 'AM'
      : !labels.includes('PM')
        ? 'PM'
        : `Session ${labels.length + 1}`;
    const created = newSession(selectedDate, label);
    dispatch({ type: 'CREATE_SESSION', session: created });
    setSelectedSessionId(created.id);
  };
  const duplicatePrevious = () => {
    const previousDate = Array.from(
      new Set(
        present.sessions
          .filter((item) => item.kind === 'session' && item.date < selectedDate)
          .map((item) => item.date),
      ),
    )
      .sort()
      .pop();
    const previous = previousDate
      ? present.sessions.filter((item) => item.kind === 'session' && item.date === previousDate)
      : [];
    const sourceGroup =
      previous[0] && previous.find((item) => item.groupId === previous[0].groupId);
    if (!sourceGroup) {
      createLineup();
      return;
    }
    const groupId = uid('session');
    const variants = previous
      .filter((item) => item.groupId === sourceGroup.groupId)
      .sort((a, b) => a.variant.localeCompare(b.variant))
      .map((item) => cloneSession(item, { date: selectedDate, groupId, variant: item.variant }));
    variants.forEach((item) => dispatch({ type: 'CREATE_SESSION', session: item }));
    setSelectedSessionId(variants[0]?.id);
  };
  const copyText = async () => {
    if (!session) return;
    await navigator.clipboard?.writeText(
      sessionToText(session, present.rowers, sessionGroup?.variants.length ?? 1),
    );
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
      if (from >= 0 && to >= 0) {
        dispatch({ type: 'REORDER_BOATS', sessionId: session.id, from, to });
      }
      return;
    }
    if (!activeData?.rowerId) return;
    if (overId === 'unassigned') {
      if (activeData.source && 'cox' in activeData.source) {
        dispatch({ type: 'CLEAR_COX', sessionId: session.id, boatId: activeData.source.boatId });
      } else if (activeData.source) {
        dispatch({
          type: 'CLEAR_SEAT',
          sessionId: session.id,
          boatId: activeData.source.boatId,
          seatNumber: activeData.source.seatNumber,
        });
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
  const pasteBoat = () => {
    if (!session || clipboard?.kind !== 'boat') return;
    const occupied = new Set(locations.keys());
    const boat = cloneBoat(clipboard.boat);
    boat.seats = boat.seats.map((seat) => ({
      ...seat,
      rowerId: seat.rowerId && occupied.has(seat.rowerId) ? null : seat.rowerId,
    }));
    if (boat.coxswainId && occupied.has(boat.coxswainId)) boat.coxswainId = null;
    dispatch({ type: 'ADD_BOAT', sessionId: session.id, boat });
  };
  const pasteLineup = () => {
    if (clipboard?.kind !== 'session') return;
    const created = cloneSession(clipboard.session, {
      date: selectedDate,
      kind: mode,
      label: clipboard.session.label,
    });
    dispatch({ type: 'CREATE_SESSION', session: created });
    setSelectedSessionId(created.id);
  };
  const createAlternative = () => {
    if (!session || !sessionGroup) return;
    const created = cloneSession(session, {
      groupId: session.groupId,
      variant: nextVariantName(sessionGroup.variants.map((item) => item.variant)),
      date: session.date,
      label: session.label,
    });
    dispatch({ type: 'CREATE_SESSION', session: created });
    setSelectedSessionId(created.id);
  };
  const pasteAlternative = () => {
    if (!session || !sessionGroup || clipboard?.kind !== 'session') return;
    const created = cloneSession(clipboard.session, {
      groupId: session.groupId,
      variant: nextVariantName(sessionGroup.variants.map((item) => item.variant)),
      date: session.date,
      label: session.label,
    });
    dispatch({ type: 'CREATE_SESSION', session: created });
    setSelectedSessionId(created.id);
  };
  const copyToDay = (date: string, label: string) => {
    if (!session) return;
    dispatch({
      type: 'CREATE_SESSION',
      session: cloneSession(session, { kind: 'session', date, label }),
    });
    setCopyFeedback(`Copied to ${formatDate(date)}`);
    window.setTimeout(() => setCopyFeedback(''), 1500);
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
  const groups: SessionGroup[] = grouped;

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
          <h1 className="text-3xl font-semibold tracking-editorial">
            {mode === 'playground' ? 'Playground' : 'Lineups'}
          </h1>
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
            {session && (
              <button className="button-secondary px-3 py-2" onClick={() => void copyText()}>
                Copy as text
              </button>
            )}
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
            mode={mode}
            selectedDate={selectedDate}
            setSelectedDate={(date) => {
              setSelectedDate(date);
              setSelectedSessionId(undefined);
            }}
            groups={groups}
            selectedSessionId={session?.id}
            onSelect={(item) => setSelectedSessionId(item.id)}
            onNew={createLineup}
            onDuplicate={duplicatePrevious}
            clipboard={clipboard}
            onPaste={pasteLineup}
          />
          <section className="min-w-0">
            {session ? (
              <div className="space-y-4">
                <SessionHeader
                  mode={mode}
                  session={session}
                  variants={sessionGroup?.variants ?? [session]}
                  rowerCount={locations.size}
                  coach={coach}
                  clipboard={clipboard}
                  dispatch={dispatch}
                  onDelete={() =>
                    setSelectedSessionId(
                      sessionGroup?.variants.find((item) => item.id !== session.id)?.id,
                    )
                  }
                  onAddBoat={() =>
                    dispatch({
                      type: 'ADD_BOAT',
                      sessionId: session.id,
                      boat: newBoat(session.boats.length + 1),
                    })
                  }
                  onSelectVariant={(item) => setSelectedSessionId(item.id)}
                  onCreateAlternative={createAlternative}
                  onCopyLineup={() =>
                    setClipboard({
                      kind: 'session',
                      session: structuredClone(session),
                      copiedAt: new Date().toISOString(),
                    })
                  }
                  onPasteAlternative={pasteAlternative}
                  onCopyToDay={copyToDay}
                  copyFeedback={copyFeedback}
                  pasteBoat={pasteBoat}
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
                  <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(400px,1fr))]">
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
                        locations={locations}
                        coachId={coach.id}
                        coachName={coach.name}
                        onCopyBoat={() =>
                          setClipboard({
                            kind: 'boat',
                            boat: structuredClone(boat),
                            copiedAt: new Date().toISOString(),
                          })
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </div>
            ) : (
              <div className="card flex min-h-[520px] flex-col items-center justify-center p-8 text-center">
                <h2 className="text-xl font-semibold">
                  {mode === 'playground' ? 'Start a playground lineup' : 'Start a session'}
                </h2>
                <p className="mt-2 max-w-sm text-sm text-ink-soft">
                  Create a lineup to begin assigning seats.
                </p>
                <button className="button-primary mt-5 px-4 py-2" onClick={createLineup}>
                  New lineup
                </button>
              </div>
            )}
          </section>
          <RosterPanel
            rowers={filteredRowers}
            allRowers={present.rowers}
            locations={locations}
            search={rosterSearch}
            setSearch={setRosterSearch}
            groupFilter={groupFilter}
            setGroupFilter={setGroupFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            groups={rosterGroups}
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

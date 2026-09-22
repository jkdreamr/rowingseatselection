'use client';

import {
  DndContext, DragEndEvent, DragOverlay, PointerSensor, TouchSensor, useDroppable, useDraggable, useSensor, useSensors,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useMemo, useState } from 'react';
import { BoatDiagram } from './BoatDiagram';
import { useLineupStore } from '@/lib/store';
import {
  BOAT_CLASSES, createSeats, getBoatClass, type Boat, type BoatClassId, type Rower, type Session, type Side,
} from '@/lib/types';
import {
  downloadJson, exportFileName, sampleCoxswains, sampleRowers,
} from '@/lib/storage';

const today = () => new Date().toISOString().slice(0, 10);
const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function newBoat(index: number, classId: BoatClassId = '8+'): Boat {
  return { id: uid('boat'), classId, name: `Boat ${index}`, seats: createSeats(classId), coxswainId: null, coxPosition: 'stern', notes: '' };
}

function newSession(date = today(), label = 'AM'): Session {
  return { id: uid('session'), date, label, boats: [], notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function statusColor(status: Rower['status']) {
  return status === 'available' ? 'text-success' : 'text-amber-200';
}

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
  const [saved, setSaved] = useState(true);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  const dates = useMemo(() => Array.from(new Set(present.sessions.map((session) => session.date))).sort(), [present.sessions]);
  const sessionsForDate = present.sessions.filter((session) => session.date === selectedDate);
  const session = present.sessions.find((item) => item.id === selectedSessionId) ?? sessionsForDate[0];
  const seatedIds = useMemo(() => new Set(session?.boats.flatMap((boat) => boat.seats.flatMap((seat) => seat.rowerId ?? []).concat(boat.coxswainId ?? [])) ?? []), [session]);
  const groups = useMemo(() => Array.from(new Set(present.rowers.map((rower) => rower.group).filter(Boolean))) as string[], [present.rowers]);

  useEffect(() => {
    if (!selectedSessionId && session) setSelectedSessionId(session.id);
  }, [selectedSessionId, session]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setPicker(undefined); setMenuBoatId(undefined); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? 'REDO' : 'UNDO' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);
  useEffect(() => {
    if (!loaded) return;
    setSaved(false);
    const timer = window.setTimeout(() => setSaved(true), 450);
    return () => window.clearTimeout(timer);
  }, [present, loaded]);

  if (!loaded) {
    return <main className="mx-auto max-w-[1600px] animate-pulse px-4 py-8"><div className="h-10 w-64 rounded bg-white/[.06]" /><div className="mt-8 h-[65vh] rounded-card bg-white/[.04]" /></main>;
  }

  const createSession = (date = selectedDate, label = 'AM') => {
    const created = newSession(date, label);
    dispatch({ type: 'CREATE_SESSION', session: created });
    setSelectedDate(date);
    setSelectedSessionId(created.id);
  };
  const duplicatePrevious = () => {
    const previous = present.sessions.filter((item) => item.date < selectedDate).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!previous) return createSession();
    const duplicate: Session = { ...structuredClone(previous), id: uid('session'), date: selectedDate, label: `${previous.label} copy`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), boats: previous.boats.map((boat) => ({ ...boat, id: uid('boat') })) };
    dispatch({ type: 'DUPLICATE_SESSION', sourceSessionId: previous.id, session: duplicate });
    setSelectedSessionId(duplicate.id);
  };
  const copyText = async () => {
    if (!session) return;
    const lines = [`${formatDate(session.date)} — ${session.label}`];
    for (const boat of session.boats) {
      lines.push(`Boat ${boat.name} (${boat.classId})`);
      if (boat.coxswainId) lines.push(`C: ${present.rowers.find((rower) => rower.id === boat.coxswainId)?.name ?? 'Unknown'}`);
      for (const seat of boat.seats.slice().sort((a, b) => b.number - a.number)) {
        lines.push(`${seat.number === 1 ? 'B' : seat.number} (${seat.side ? seat.side[0].toUpperCase() : '—'}): ${present.rowers.find((rower) => rower.id === seat.rowerId)?.name ?? '—'}`);
      }
      if (boat.notes) lines.push(`Notes: ${boat.notes}`);
    }
    await navigator.clipboard?.writeText(lines.join('\n'));
  };
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(undefined);
    const overId = String(event.over?.id ?? '');
    const activeData = event.active.data.current as { rowerId?: string; source?: { boatId: string; seatNumber: number } } | undefined;
    if (!session || !overId) return;
    const overParts = overId.split('|');
    if (overParts[0] === 'boat' && event.active.id !== event.over?.id) {
      const from = session.boats.findIndex((boat) => boat.id === String(event.active.id).split('|')[1]);
      const to = session.boats.findIndex((boat) => boat.id === overParts[1]);
      if (from >= 0 && to >= 0) dispatch({ type: 'REORDER_BOATS', sessionId: session.id, from, to });
      return;
    }
    if (!activeData?.rowerId) return;
    if (overId === 'unassigned') {
      if (activeData.source) dispatch({ type: 'CLEAR_SEAT', sessionId: session.id, boatId: activeData.source.boatId, seatNumber: activeData.source.seatNumber });
      return;
    }
    const parts = overId.split('|');
    if (parts[0] === 'seat') {
      dispatch({ type: 'ASSIGN_SEAT', sessionId: session.id, boatId: parts[2], seatNumber: Number(parts[3]), rowerId: activeData.rowerId, source: activeData.source });
    } else if (parts[0] === 'cox') {
      dispatch({ type: 'ASSIGN_COX', sessionId: session.id, boatId: parts[2], rowerId: activeData.rowerId });
    }
  };

  const filteredRowers = present.rowers.filter((rower) => {
    const searchMatch = rower.name.toLowerCase().includes(rosterSearch.toLowerCase()) || rower.group?.toLowerCase().includes(rosterSearch.toLowerCase());
    const groupMatch = groupFilter === 'all' || rower.group === groupFilter;
    const statusMatch = statusFilter === 'all' || rower.status === statusFilter;
    return searchMatch && groupMatch && statusMatch;
  });

  return (
    <DndContext sensors={sensors} onDragStart={(event) => {
      const rowerId = (event.active.data.current as { rowerId?: string })?.rowerId;
      setActiveDrag(present.rowers.find((rower) => rower.id === rowerId));
    }} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDrag(undefined)}>
      <main className="mx-auto max-w-[1600px] px-3 pb-24 pt-5 sm:px-6">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="label-caps text-coral">Daily seat planning</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-editorial">Lineups</h1>
              <span className={`rounded-full border px-2 py-1 text-[10px] ${saved ? 'border-success/30 text-success' : 'border-amber-300/30 text-amber-200'}`}>{saved ? 'Saved' : 'Saving…'}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="focus-ring rounded-full border border-white/10 px-3 py-2 text-xs text-charcoal-soft hover:bg-white/[.06]" onClick={() => dispatch({ type: 'UNDO' })} disabled={!canUndo}>↶ Undo</button>
            <button className="focus-ring rounded-full border border-white/10 px-3 py-2 text-xs text-charcoal-soft hover:bg-white/[.06]" onClick={() => dispatch({ type: 'REDO' })} disabled={!canRedo}>↷ Redo</button>
            <button className="focus-ring rounded-full border border-white/10 px-3 py-2 text-xs text-charcoal-soft hover:bg-white/[.06]" onClick={() => void copyText()}>Copy as text</button>
            {session && <a className="focus-ring rounded-full border border-white/10 px-3 py-2 text-xs text-charcoal-soft hover:bg-white/[.06]" href={`/print/${session.id}`} target="_blank">Print</a>}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_300px]">
          <aside className="card h-fit p-4">
            <div className="flex items-center justify-between">
              <span className="label-caps">Sessions</span>
              <button className="focus-ring rounded-full bg-coral px-2.5 py-1 text-xs font-semibold" onClick={() => { const label = window.prompt('Session label', 'AM')?.trim(); if (label) createSession(selectedDate, label); }}>+ New</button>
            </div>
            <input type="date" value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setSelectedSessionId(undefined); }} className="focus-ring mt-3 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm" />
            <div className="mt-4 space-y-1">
              {sessionsForDate.map((item) => <button key={item.id} onClick={() => setSelectedSessionId(item.id)} className={`focus-ring w-full rounded-lg px-3 py-2 text-left ${session?.id === item.id ? 'bg-coral/15 text-white ring-1 ring-coral/50' : 'hover:bg-white/[.05]'}`}><span className="block text-sm font-medium">{item.label}</span><span className="text-[10px] text-charcoal-muted">{item.boats.length} boats</span></button>)}
              {!sessionsForDate.length && <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-charcoal-muted">No sessions for {formatDate(selectedDate)}.</p>}
            </div>
            <div className="mt-4 border-t border-white/[.07] pt-3">
              <button onClick={duplicatePrevious} className="focus-ring w-full rounded-lg border border-white/10 px-3 py-2 text-xs text-charcoal-soft hover:bg-white/[.05]">Duplicate previous</button>
              {dates.length > 0 && <p className="mt-3 text-[10px] text-charcoal-muted">{dates.length} date{dates.length === 1 ? '' : 's'} in this workspace</p>}
            </div>
          </aside>

          <section className="min-w-0">
            {session ? <SessionWorkspace session={session} present={present} dispatch={dispatch} onDelete={() => setSelectedSessionId(undefined)} menuBoatId={menuBoatId} setMenuBoatId={setMenuBoatId} picker={picker} setPicker={setPicker} pickerSearch={pickerSearch} setPickerSearch={setPickerSearch} /> : (
              <div className="card flex min-h-[520px] flex-col items-center justify-center p-8 text-center">
                <div className="mb-4 text-5xl">🚣</div>
                <h2 className="text-xl font-semibold">Start a session</h2>
                <p className="mt-2 max-w-sm text-sm text-charcoal-soft">Create a session for today or load a sample roster to try the builder.</p>
                <button className="focus-ring mt-5 rounded-full bg-coral px-4 py-2 text-sm font-semibold" onClick={() => createSession()}>New session</button>
              </div>
            )}
          </section>

          <RosterPanel rowers={filteredRowers} allRowers={present.rowers} seatedIds={seatedIds} search={rosterSearch} setSearch={setRosterSearch} groupFilter={groupFilter} setGroupFilter={setGroupFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} groups={groups} onSample={() => dispatch({ type: 'ADD_ROWER', rower: sampleRowers()[0] })} />
        </div>
        {!present.rowers.length && <div className="fixed inset-x-4 bottom-5 z-30 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl border border-coral/30 bg-container-high p-3 shadow-modal"><div><p className="text-sm font-semibold">Empty roster</p><p className="text-xs text-charcoal-soft">Load 16 rowers and 2 coxswains to explore.</p></div><button onClick={() => sampleRowers().concat(sampleCoxswains()).forEach((rower) => dispatch({ type: 'ADD_ROWER', rower }))} className="focus-ring shrink-0 rounded-full bg-coral px-3 py-2 text-xs font-semibold">Load sample roster</button></div>}
      </main>
      <DragOverlay>{activeDrag ? <div className="rounded-lg border border-coral/50 bg-container-high px-3 py-2 text-sm shadow-modal">{activeDrag.name}</div> : null}</DragOverlay>
    </DndContext>
  );
}

function SessionWorkspace({ session, present, dispatch, onDelete, menuBoatId, setMenuBoatId, picker, setPicker, pickerSearch, setPickerSearch }: {
  session: Session;
  present: ReturnType<typeof useLineupStore>['present'];
  dispatch: ReturnType<typeof useLineupStore>['dispatch'];
  onDelete: () => void;
  menuBoatId?: string;
  setMenuBoatId: (value?: string) => void;
  picker?: { boatId: string; seatNumber: number };
  setPicker: (value?: { boatId: string; seatNumber: number }) => void;
  pickerSearch: string;
  setPickerSearch: (value: string) => void;
}) {
  const boatCounts = session.boats.map((boat) => boat.seats.filter((seat) => seat.rowerId).length);
  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <input value={session.label} onChange={(event) => dispatch({ type: 'UPDATE_SESSION', sessionId: session.id, patch: { label: event.target.value } })} className="focus-ring min-w-0 max-w-[230px] bg-transparent text-xl font-semibold tracking-tight" />
            <span className="rounded-full bg-white/[.06] px-2 py-1 text-[10px] text-charcoal-muted">{formatDate(session.date)}</span>
          </div>
          <p className="mt-1 text-xs text-charcoal-muted">{session.boats.length} boats · {boatCounts.reduce((sum, value) => sum + value, 0)} rowers seated</p>
        </div>
        <div className="flex gap-2">
          <button className="focus-ring rounded-full border border-white/10 px-3 py-2 text-xs hover:bg-white/[.06]" onClick={() => dispatch({ type: 'UPDATE_SESSION', sessionId: session.id, patch: { notes: session.notes ? '' : 'Coach notes: ' } })}>Session notes</button>
          <button className="focus-ring rounded-full border border-red-300/20 px-3 py-2 text-xs text-red-200 hover:bg-red-400/10" onClick={() => { if (window.confirm(`Delete ${session.label}?`)) { dispatch({ type: 'DELETE_SESSION', sessionId: session.id }); onDelete(); } }}>Delete</button>
          <button className="focus-ring rounded-full bg-coral px-3 py-2 text-xs font-semibold" onClick={() => dispatch({ type: 'ADD_BOAT', sessionId: session.id, boat: newBoat(session.boats.length + 1) })}>+ Add boat</button>
        </div>
      </div>
      {session.notes && <textarea value={session.notes} onChange={(event) => dispatch({ type: 'UPDATE_SESSION', sessionId: session.id, patch: { notes: event.target.value } })} className="focus-ring card min-h-16 w-full resize-y p-3 text-sm" placeholder="Session notes" />}
      {!session.boats.length && <div className="card border-dashed p-10 text-center text-sm text-charcoal-muted">Add a boat to begin assigning seats.</div>}
      <SortableContext items={session.boats.map((boat) => `boat|${boat.id}`)} strategy={verticalListSortingStrategy}>
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {session.boats.map((boat, index) => (
            <BoatCard key={boat.id} session={session} boat={boat} index={index} rowers={present.rowers} dispatch={dispatch} menuOpen={menuBoatId === boat.id} setMenuOpen={(open) => setMenuBoatId(open ? boat.id : undefined)} picker={picker} setPicker={setPicker} pickerSearch={pickerSearch} setPickerSearch={setPickerSearch} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function BoatCard({ session, boat, index, rowers, dispatch, menuOpen, setMenuOpen, picker, setPicker, pickerSearch, setPickerSearch }: {
  session: Session; boat: Boat; index: number; rowers: Rower[]; dispatch: ReturnType<typeof useLineupStore>['dispatch']; menuOpen: boolean; setMenuOpen: (open: boolean) => void; picker?: { boatId: string; seatNumber: number }; setPicker: (value?: { boatId: string; seatNumber: number }) => void; pickerSearch: string; setPickerSearch: (value: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `boat|${boat.id}` });
  const classInfo = getBoatClass(boat.classId);
  const filled = boat.seats.filter((seat) => seat.rowerId).length;
  const weights = boat.seats.map((seat) => rowers.find((rower) => rower.id === seat.rowerId)?.weightLbs).filter((weight): weight is number => Boolean(weight));
  const ergs = boat.seats.map((seat) => rowers.find((rower) => rower.id === seat.rowerId)?.ergTwoKSeconds).filter((erg): erg is number => Boolean(erg));
  const ports = boat.seats.filter((seat) => seat.side === 'port' && seat.rowerId).length;
  const stars = boat.seats.filter((seat) => seat.side === 'starboard' && seat.rowerId).length;
  const duplicateIds = new Set<string>();
  session.boats.flatMap((item) => item.seats.map((seat) => seat.rowerId).filter((id): id is string => Boolean(id))).forEach((id, _, ids) => {
    if (ids.filter((candidate) => candidate === id).length > 1) duplicateIds.add(id);
  });
  const duplicate = () => dispatch({ type: 'ADD_BOAT', sessionId: session.id, boat: { ...structuredClone(boat), id: uid('boat'), name: `${boat.name} copy` } });
  return (
    <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`card relative overflow-visible p-3 ${isDragging ? 'z-10 opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-2 border-b border-white/[.07] pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <button className="focus-ring cursor-grab text-charcoal-muted" title="Drag to reorder" {...attributes} {...listeners}>⋮⋮</button>
          <div className="min-w-0">
            <input value={boat.name} onChange={(event) => dispatch({ type: 'RENAME_BOAT', sessionId: session.id, boatId: boat.id, name: event.target.value })} className="focus-ring w-full min-w-0 bg-transparent text-sm font-semibold" />
            <select value={boat.classId} onChange={(event) => dispatch({ type: 'SET_CLASS', sessionId: session.id, boatId: boat.id, classId: event.target.value as BoatClassId })} className="focus-ring mt-1 max-w-full bg-transparent text-[10px] text-charcoal-muted">
              {BOAT_CLASSES.map((option) => <option key={option.id} value={option.id} className="bg-container">{option.id} · {option.label}</option>)}
            </select>
          </div>
        </div>
        <div className="relative">
          <button className="focus-ring grid h-8 w-8 place-items-center rounded-full text-lg text-charcoal-soft hover:bg-white/[.07]" onClick={() => setMenuOpen(!menuOpen)} aria-label="Boat actions">•••</button>
          {menuOpen && <div className="absolute right-0 top-9 z-20 w-52 rounded-xl border border-white/10 bg-container-high p-1 shadow-modal">
            {[
              ['Standard (port stroke)', 'standard-port'], ['Standard (starboard stroke)', 'standard-starboard'], ['Flip all sides', 'flip'], ['Bucket preset', 'bucket'],
              ].map(([label, preset]) => <button key={preset} className="focus-ring block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-white/[.07]" onClick={() => { dispatch({ type: 'RIG_PRESET', sessionId: session.id, boatId: boat.id, preset: preset as 'standard-port' | 'standard-starboard' | 'flip' | 'bucket' }); setMenuOpen(false); }}>{label}</button>)}
            {classInfo.coxed && <button className="focus-ring block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-white/[.07]" onClick={() => { dispatch({ type: 'SET_COX_POSITION', sessionId: session.id, boatId: boat.id, position: boat.coxPosition === 'stern' ? 'bow' : 'stern' }); setMenuOpen(false); }}>Cox at {boat.coxPosition === 'stern' ? 'bow' : 'stern'}</button>}
            <button className="focus-ring block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-white/[.07]" onClick={() => { duplicate(); setMenuOpen(false); }}>Duplicate boat</button>
            <button className="focus-ring block w-full rounded-lg px-3 py-2 text-left text-xs text-amber-200 hover:bg-white/[.07]" onClick={() => { boat.seats.forEach((seat) => seat.rowerId && dispatch({ type: 'CLEAR_SEAT', sessionId: session.id, boatId: boat.id, seatNumber: seat.number })); dispatch({ type: 'CLEAR_COX', sessionId: session.id, boatId: boat.id }); setMenuOpen(false); }}>Clear boat</button>
            <button className="focus-ring block w-full rounded-lg px-3 py-2 text-left text-xs text-red-300 hover:bg-white/[.07]" onClick={() => { if (window.confirm(`Delete ${boat.name}?`)) dispatch({ type: 'REMOVE_BOAT', sessionId: session.id, boatId: boat.id }); setMenuOpen(false); }}>Delete boat</button>
          </div>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 py-2 text-[10px] text-charcoal-muted">
        <span className={filled < classInfo.seats ? 'text-amber-200' : 'text-success'}>{filled}/{classInfo.seats} filled</span>
        {weights.length > 0 && <span>avg {Math.round(weights.reduce((a, b) => a + b, 0) / weights.length)} lb</span>}
        {ergs.length > 0 && <span>2k {(ergs.reduce((a, b) => a + b, 0) / ergs.length / 60).toFixed(1)}m</span>}
        {!classInfo.sculling && <span className={ports !== stars ? 'text-amber-200' : ''}>{ports}P / {stars}S</span>}
      </div>
      <BoatDiagram sessionId={session.id} boat={boat} rowers={rowers} duplicateIds={duplicateIds} onEmptySeat={(seatNumber) => { setPicker({ boatId: boat.id, seatNumber }); setPickerSearch(''); }} onToggleSide={(seatNumber, side) => dispatch({ type: 'SET_SEAT_SIDE', sessionId: session.id, boatId: boat.id, seatNumber, side })} />
      {picker?.boatId === boat.id && <SeatPicker rowers={rowers} search={pickerSearch} setSearch={setPickerSearch} onPick={(rowerId) => { dispatch({ type: 'ASSIGN_SEAT', sessionId: session.id, boatId: boat.id, seatNumber: picker.seatNumber, rowerId }); setPicker(undefined); }} onClose={() => setPicker(undefined)} />}
      <textarea value={boat.notes} onChange={(event) => dispatch({ type: 'SET_BOAT_NOTES', sessionId: session.id, boatId: boat.id, notes: event.target.value })} className="focus-ring mt-2 min-h-10 w-full resize-y rounded-lg border border-white/[.07] bg-black/10 px-2 py-2 text-xs text-charcoal-soft" placeholder="Boat notes…" />
      <p className="mt-2 text-[9px] text-charcoal-muted">Boat {index + 1} · bow ↑</p>
    </article>
  );
}

function SeatPicker({ rowers, search, setSearch, onPick, onClose }: { rowers: Rower[]; search: string; setSearch: (value: string) => void; onPick: (id: string) => void; onClose: () => void }) {
  const matches = rowers.filter((rower) => rower.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8);
  return <div className="absolute inset-x-8 top-32 z-30 rounded-xl border border-white/10 bg-container-high p-3 shadow-modal"><div className="flex items-center gap-2"><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} className="focus-ring min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs" placeholder="Search roster…" /><button onClick={onClose} className="text-charcoal-muted">×</button></div><div className="mt-2 max-h-44 space-y-1 overflow-y-auto">{matches.map((rower) => <button key={rower.id} onClick={() => onPick(rower.id)} className="focus-ring flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs hover:bg-white/[.07]"><span>{rower.name}</span><span className={statusColor(rower.status)}>{rower.status}</span></button>)}{!matches.length && <p className="py-3 text-center text-xs text-charcoal-muted">No rowers found.</p>}</div></div>;
}

function RosterPanel({ rowers, allRowers, seatedIds, search, setSearch, groupFilter, setGroupFilter, statusFilter, setStatusFilter, groups, onSample }: { rowers: Rower[]; allRowers: Rower[]; seatedIds: Set<string>; search: string; setSearch: (value: string) => void; groupFilter: string; setGroupFilter: (value: string) => void; statusFilter: string; setStatusFilter: (value: string) => void; groups: string[]; onSample: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unassigned' });
  return <aside className="card h-fit p-4 xl:sticky xl:top-[76px]"><div className="flex items-center justify-between"><span className="label-caps">Roster</span><span className="text-xs text-charcoal-muted">{allRowers.length}</span></div><input value={search} onChange={(event) => setSearch(event.target.value)} className="focus-ring mt-3 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm" placeholder="Search rowers…" /><div className="mt-2 grid grid-cols-2 gap-2"><select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} className="focus-ring rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-[10px]"><option value="all">All groups</option>{groups.map((group) => <option key={group} value={group}>{group}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="focus-ring rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-[10px]"><option value="all">All status</option><option value="available">Available</option><option value="limited">Limited</option><option value="injured">Injured</option><option value="sick">Sick</option><option value="away">Away</option></select></div><div ref={setNodeRef} id="unassigned" className={`mt-3 rounded-lg border border-dashed px-3 py-2 text-center text-[10px] text-charcoal-muted ${isOver ? 'border-coral bg-coral/10' : 'border-white/15'}`}>Drop here to unassign</div><div className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto pr-1">{['Coxswains', 'Port', 'Starboard', 'Both', 'Scull', 'Unavailable'].map((group) => { const members = rowers.filter((rower) => group === 'Coxswains' ? rower.isCoxswain : group === 'Unavailable' ? rower.status !== 'available' : !rower.isCoxswain && (group === 'Port' ? rower.sidePreference === 'port' : group === 'Starboard' ? rower.sidePreference === 'starboard' : group === 'Both' ? rower.sidePreference === 'both' : rower.sidePreference === 'scull')); if (!members.length) return null; return <div key={group}><p className="label-caps mb-1">{group}</p><div className="space-y-1">{members.map((rower) => <RosterRow key={rower.id} rower={rower} seated={seatedIds.has(rower.id)} />)}</div></div>; })}</div>{!allRowers.length && <button className="focus-ring mt-4 w-full rounded-lg bg-coral px-3 py-2 text-xs font-semibold" onClick={onSample}>Load sample roster</button>}</aside>;
}

function RosterRow({ rower, seated }: { rower: Rower; seated: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `rower|${rower.id}`, data: { rowerId: rower.id } });
  return <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} {...listeners} {...attributes} className={`rounded-lg border border-white/[.06] bg-white/[.025] px-2 py-2 ${rower.status !== 'available' ? 'opacity-60' : ''} ${isDragging ? 'opacity-30' : ''}`}><div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-xs font-medium">{rower.name}</span>{seated && <span className="shrink-0 rounded-full bg-white/[.07] px-1.5 py-0.5 text-[9px] text-charcoal-muted">seated</span>}</div><div className="mt-1 flex items-center gap-2 text-[9px] text-charcoal-muted"><span>{rower.group || 'No group'}</span><span className={statusColor(rower.status)}>{rower.status}</span></div></div>;
}

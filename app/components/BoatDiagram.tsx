'use client';

import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { getBoatClass, type Boat, type Rower, type Side } from '@/lib/types';

function displayName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2 || name.length < 17) return name;
  return `${parts[parts.length - 1]} ${parts[0][0]}.`;
}

function SeatDrop({ boat, sessionId, seatNumber, rower, duplicate, onEmpty, onToggleSide }: { boat: Boat; sessionId: string; seatNumber: number; rower?: Rower; duplicate: boolean; onEmpty: () => void; onToggleSide: (side: Side) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `seat|${sessionId}|${boat.id}|${seatNumber}` });
  const seat = boat.seats.find((item) => item.number === seatNumber);
  const side = seat?.side;
  return (
    <div ref={setNodeRef} className={`relative flex min-h-[42px] items-center gap-2 rounded-lg px-2 transition ${isOver ? 'bg-coral/20 ring-1 ring-coral' : ''}`}>
      <span className="w-5 text-center font-mono text-[10px] text-charcoal-muted">{seatNumber}</span>
      <div className={`relative flex h-8 min-w-0 flex-1 items-center justify-center rounded-md border ${rower ? 'border-white/[.12] bg-white/[.07]' : 'border-dashed border-white/[.15] bg-black/10'}`}>
        {rower ? <DraggableRower rower={rower} source={{ boatId: boat.id, seatNumber }} compact /> : <button className="focus-ring w-full text-center text-[10px] text-charcoal-light" onClick={onEmpty}>Tap to pick</button>}
        {rower && rower.status !== 'available' && <span title={`Status: ${rower.status}`} className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-400" />}
        {rower && (rower.sidePreference === 'port' && side === 'starboard' || rower.sidePreference === 'starboard' && side === 'port') && <span title="Non-preferred side" className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-amber-300" />}
        {duplicate && <span title="Assigned more than once in this session" className="absolute -bottom-1 -left-1 h-2 w-2 rounded-full bg-red-400" />}
      </div>
      {!getBoatClass(boat.classId).sculling && side && (
        <button
          className={`focus-ring absolute ${side === 'port' ? '-left-7' : '-right-7'} grid h-7 w-7 place-items-center rounded-full border text-[9px] font-bold ${side === 'port' ? 'border-coral/60 bg-coral/20 text-red-200' : 'border-success/60 bg-success/20 text-green-100'}`}
          title={`Toggle side (currently ${side})`}
          onClick={() => onToggleSide(side === 'port' ? 'starboard' : 'port')}
        >
          {side === 'port' ? 'P' : 'S'}
        </button>
      )}
      {getBoatClass(boat.classId).sculling && <span className="absolute -left-5 text-xs text-success">‹</span>}
      {getBoatClass(boat.classId).sculling && <span className="absolute -right-5 text-xs text-success">›</span>}
    </div>
  );
}

function DraggableRower({ rower, source, compact = false }: { rower: Rower; source?: { boatId: string; seatNumber: number }; compact?: boolean }) {
  const id = source ? `seated|${source.boatId}|${source.seatNumber}|${rower.id}` : `rower|${rower.id}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, data: { rowerId: rower.id, source } });
  return (
    <button
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...listeners}
      {...attributes}
      className={`focus-ring min-w-0 truncate text-left text-xs font-medium ${isDragging ? 'opacity-30' : ''} ${compact ? 'w-full px-1' : ''}`}
      title={`${rower.name} — drag to move`}
    >
      {displayName(rower.name)}
    </button>
  );
}

export function BoatDiagram({
  sessionId, boat, rowers, duplicateIds, onEmptySeat, onToggleSide,
}: {
  sessionId: string;
  boat: Boat;
  rowers: Rower[];
  duplicateIds?: Set<string>;
  onEmptySeat: (seatNumber: number) => void;
  onToggleSide: (seatNumber: number, side: Side) => void;
}) {
  const classInfo = getBoatClass(boat.classId);
  const rowerMap = new Map(rowers.map((rower) => [rower.id, rower]));
  return (
    <div className="relative mx-auto w-full max-w-[300px] px-10 py-3">
      <div className="absolute bottom-1 left-1/2 top-1 w-32 -translate-x-1/2 rounded-[48%] border border-white/[.13] bg-gradient-to-b from-stone-light/80 via-container-high to-stone-light/40 shadow-inner">
        <div className="absolute left-1/2 top-2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-white/20" />
        <div className="absolute bottom-2 left-1/2 h-5 w-8 -translate-x-1/2 rounded-sm border border-white/10 bg-black/20" />
      </div>
      <div className="relative z-10 space-y-1">
        <div className="mb-1 flex justify-between px-1 text-[9px] font-semibold tracking-[.18em]">
          <span className="text-red-300">← PORT</span>
          <span className="text-green-200">STARBOARD →</span>
        </div>
        {classInfo.coxed && boat.coxPosition === 'bow' && (
          <CoxDrop boat={boat} sessionId={sessionId} rower={boat.coxswainId ? rowerMap.get(boat.coxswainId) : undefined} />
        )}
        {boat.seats.map((seat) => (
          <SeatDrop
            key={seat.number}
            boat={boat}
            sessionId={sessionId}
            seatNumber={seat.number}
            rower={seat.rowerId ? rowerMap.get(seat.rowerId) : undefined}
            duplicate={Boolean(seat.rowerId && duplicateIds?.has(seat.rowerId))}
            onEmpty={() => onEmptySeat(seat.number)}
            onToggleSide={(side) => onToggleSide(seat.number, side)}
          />
        ))}
        {classInfo.coxed && boat.coxPosition === 'stern' && (
          <CoxDrop boat={boat} sessionId={sessionId} rower={boat.coxswainId ? rowerMap.get(boat.coxswainId) : undefined} />
        )}
      </div>
    </div>
  );
}

function CoxDrop({ boat, sessionId, rower }: { boat: Boat; sessionId: string; rower?: Rower }) {
  const { setNodeRef, isOver } = useDroppable({ id: `cox|${sessionId}|${boat.id}` });
  return (
    <div ref={setNodeRef} className={`mt-1 flex items-center gap-2 rounded-lg border border-dashed border-amber-300/30 bg-amber-300/[.06] px-2 py-2 text-[10px] text-amber-100 ${isOver ? 'ring-1 ring-amber-300' : ''}`}>
      <span className="w-5 text-center">C</span>
      <span className="truncate">{rower ? rower.name : 'Drop coxswain here'}</span>
      {boat.coxPosition === 'bow' && <span className="ml-auto text-[9px] uppercase text-amber-200/70">bow</span>}
    </div>
  );
}

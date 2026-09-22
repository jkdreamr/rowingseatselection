'use client';

import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { getBoatClass, type Boat, type Rower, type SeatSource, type Side } from '@/lib/types';

// Geometry (px). Bow at top, stern at bottom. Port is the viewer's left.
const ROW = 46; // vertical pitch per seat
const HULL_W = 44; // hull beam at midships
const TIP = 64; // length of the bow / stern taper beyond the first / last row
const RIGGER = 16; // hull edge -> oarlock
const CHIP_GAP = 6; // oarlock -> name chip
const CHIP_W = 100; // the name chip sits on the oar shaft
const SHAFT = CHIP_GAP + CHIP_W + 4; // oarlock -> blade
const BLADE_L = 22;
const BLADE_W = 9;
const LABEL_W = RIGGER + SHAFT + BLADE_L + 6; // everything outboard of the hull on one side
const CX = LABEL_W + HULL_W / 2; // hull centreline x
const WIDTH = CX * 2;
const CHIP_H = 30;

const CARDINAL = '#8C1515';
const INK = '#111111';
const LINE = '#cfcfcf';

function displayName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2 || name.length <= 11) return name;
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

type CoxPlacement = 'stern' | 'bow' | null;

/** Which row (0-based from the top) each seat and the cox occupy. */
function layout(boat: Boat) {
  const cls = getBoatClass(boat.classId);
  const cox: CoxPlacement = cls.coxed ? boat.coxPosition : null;
  const firstSeatRow = cox === 'bow' ? 1 : 0;
  const rows = boat.seats.length + (cox ? 1 : 0);
  const rowY = (row: number) => TIP + row * ROW + ROW / 2;
  const seatRow = (seatNumber: number) => firstSeatRow + (seatNumber - 1);
  const coxRow = cox === 'bow' ? 0 : rows - 1;
  const height = TIP * 2 + rows * ROW;
  return { cls, cox, rows, rowY, seatRow, coxRow, height };
}

function hullPath(height: number) {
  const half = HULL_W / 2;
  const l = CX - half;
  const r = CX + half;
  const bowEnd = TIP + 6;
  const sternStart = height - TIP - 6;
  // Long, fine-entry bow; slightly fuller stern with a squared-off transom point.
  return [
    `M ${CX} 0`,
    `C ${CX + 3} ${TIP * 0.35}, ${r} ${TIP * 0.8}, ${r} ${bowEnd}`,
    `L ${r} ${sternStart}`,
    `C ${r} ${height - TIP * 0.7}, ${CX + 2.5} ${height - TIP * 0.3}, ${CX} ${height}`,
    `C ${CX - 2.5} ${height - TIP * 0.3}, ${l} ${height - TIP * 0.7}, ${l} ${sternStart}`,
    `L ${l} ${bowEnd}`,
    `C ${l} ${TIP * 0.8}, ${CX - 3} ${TIP * 0.35}, ${CX} 0`,
    'Z',
  ].join(' ');
}

function Oar({ y, side, onToggle }: { y: number; side: Side; onToggle: () => void }) {
  const dir = side === 'port' ? -1 : 1;
  const hullEdge = CX + dir * (HULL_W / 2);
  const lock = hullEdge + dir * RIGGER;
  const bladeStart = lock + dir * SHAFT;
  const bladeEnd = bladeStart + dir * BLADE_L;
  const isPort = side === 'port';
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`Seat rigged ${side}; click to switch to ${isPort ? 'starboard' : 'port'}`}
      className="cursor-pointer outline-none focus-visible:opacity-70"
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onToggle();
        }
      }}
    >
      {/* rigger: two stays meeting at the oarlock */}
      <path
        d={`M ${hullEdge} ${y - 9} L ${lock} ${y} L ${hullEdge} ${y + 9}`}
        fill="none"
        stroke={INK}
        strokeWidth={1.25}
      />
      <circle cx={lock} cy={y} r={2.5} fill="#fff" stroke={INK} strokeWidth={1.25} />
      {/* shaft */}
      <line
        x1={lock}
        y1={y}
        x2={bladeStart}
        y2={y}
        stroke={INK}
        strokeWidth={2}
        strokeLinecap="round"
      />
      {/* hatchet blade */}
      <path
        d={
          isPort
            ? `M ${bladeStart} ${y - 1.5} L ${bladeEnd + 4} ${y - BLADE_W / 2 - 1} Q ${bladeEnd} ${y} ${bladeEnd + 4} ${y + BLADE_W / 2 + 1} L ${bladeStart} ${y + 1.5} Z`
            : `M ${bladeStart} ${y - 1.5} L ${bladeEnd - 4} ${y - BLADE_W / 2 - 1} Q ${bladeEnd} ${y} ${bladeEnd - 4} ${y + BLADE_W / 2 + 1} L ${bladeStart} ${y + 1.5} Z`
        }
        fill={isPort ? CARDINAL : '#fff'}
        stroke={isPort ? CARDINAL : INK}
        strokeWidth={1.25}
      />
      {/* generous invisible hit area */}
      <rect
        x={Math.min(hullEdge, bladeEnd) - 4}
        y={y - 14}
        width={RIGGER + SHAFT + BLADE_L + 8}
        height={28}
        fill="transparent"
      />
    </g>
  );
}

function ScullOars({ y }: { y: number }) {
  return (
    <g aria-hidden>
      {([-1, 1] as const).map((dir) => {
        const hullEdge = CX + dir * (HULL_W / 2);
        const lock = hullEdge + dir * RIGGER;
        const bladeStart = lock + dir * SHAFT;
        const bladeEnd = bladeStart + dir * (BLADE_L - 6);
        return (
          <g key={dir}>
            <path
              d={`M ${hullEdge} ${y - 8} L ${lock} ${y} L ${hullEdge} ${y + 8}`}
              fill="none"
              stroke={INK}
              strokeWidth={1.25}
            />
            <circle cx={lock} cy={y} r={2.5} fill="#fff" stroke={INK} strokeWidth={1.25} />
            <line
              x1={lock}
              y1={y}
              x2={bladeStart}
              y2={y}
              stroke={INK}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <path
              d={`M ${bladeStart} ${y - 1.5} L ${bladeEnd - dir * 3} ${y - 4.5} Q ${bladeEnd} ${y} ${bladeEnd - dir * 3} ${y + 4.5} L ${bladeStart} ${y + 1.5} Z`}
              fill="#fff"
              stroke={INK}
              strokeWidth={1.25}
            />
          </g>
        );
      })}
    </g>
  );
}

function SeatGlyph({ y }: { y: number }) {
  // Sliding seat on its tracks, plus the foot stretcher one step sternward.
  return (
    <g aria-hidden>
      <line x1={CX - 7} y1={y - 12} x2={CX - 7} y2={y + 12} stroke={LINE} strokeWidth={1} />
      <line x1={CX + 7} y1={y - 12} x2={CX + 7} y2={y + 12} stroke={LINE} strokeWidth={1} />
      <rect
        x={CX - 9}
        y={y - 5}
        width={18}
        height={10}
        rx={3}
        fill="#fff"
        stroke={INK}
        strokeWidth={1.25}
      />
      <line
        x1={CX - 10}
        y1={y + 17}
        x2={CX + 10}
        y2={y + 17}
        stroke={INK}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </g>
  );
}

function CoxGlyph({ y }: { y: number }) {
  return (
    <g aria-hidden>
      <rect
        x={CX - 11}
        y={y - 12}
        width={22}
        height={24}
        rx={6}
        fill="#fff"
        stroke={INK}
        strokeWidth={1.25}
      />
      <circle cx={CX} cy={y - 3} r={3.5} fill={INK} />
    </g>
  );
}

function RowerChip({
  rower,
  source,
  warnings,
}: {
  rower: Rower;
  source: SeatSource;
  warnings: string[];
}) {
  const key = 'cox' in source ? 'cox' : source.seatNumber;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `seated|${source.boatId}|${key}|${rower.id}`,
    data: { rowerId: rower.id, source },
  });
  const flagged = warnings.length > 0;
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      title={[rower.name, ...warnings].join(' — ')}
      className={`focus-ring flex w-full min-w-0 cursor-grab items-center gap-1.5 rounded-md border bg-white px-2 text-left text-xs font-medium text-ink active:cursor-grabbing ${
        flagged ? 'border-cardinal' : 'border-ink'
      } ${isDragging ? 'opacity-30' : ''}`}
      style={{ height: CHIP_H, transform: CSS.Translate.toString(transform) }}
    >
      {flagged && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-cardinal" />}
      <span className="truncate">{displayName(rower.name)}</span>
    </button>
  );
}

function EmptyChip({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{ height: CHIP_H }}
      className="focus-ring w-full rounded-md border border-dashed border-line-strong bg-white text-xs text-ink-muted hover:border-ink hover:text-ink"
    >
      {label}
    </button>
  );
}

function SeatSlot({
  id,
  y,
  align,
  children,
}: {
  id: string;
  y: number;
  align: 'port' | 'starboard';
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const chipOuterEdge = LABEL_W - RIGGER - CHIP_GAP; // distance from the outer diagram edge to the inboard end of the chip
  const x = align === 'port' ? chipOuterEdge - CHIP_W : WIDTH - chipOuterEdge;
  return (
    <div
      ref={setNodeRef}
      style={{ top: y - ROW / 2, left: x, width: CHIP_W, height: ROW }}
      className={`absolute flex items-center rounded-md transition ${isOver ? 'bg-cardinal-soft ring-1 ring-cardinal' : ''}`}
    >
      {children}
    </div>
  );
}

export function BoatDiagram({
  sessionId,
  boat,
  rowers,
  duplicateIds,
  onEmptySeat,
  onToggleSide,
}: {
  sessionId: string;
  boat: Boat;
  rowers: Rower[];
  duplicateIds?: Set<string>;
  onEmptySeat: (seatNumber: number) => void;
  onToggleSide: (seatNumber: number, side: Side) => void;
}) {
  const { cls, cox, rowY, seatRow, coxRow, height } = layout(boat);
  const rowerMap = new Map(rowers.map((rower) => [rower.id, rower]));
  const coxswain = boat.coxswainId ? rowerMap.get(boat.coxswainId) : undefined;

  const warningsFor = (rower: Rower, side: Side | null) => {
    const list: string[] = [];
    if (duplicateIds?.has(rower.id)) list.push('Assigned more than once in this session');
    if (rower.status !== 'available') list.push('Marked unavailable');
    if (
      side &&
      (rower.sidePreference === 'port' || rower.sidePreference === 'starboard') &&
      rower.sidePreference !== side
    ) {
      list.push(`Prefers ${rower.sidePreference}`);
    }
    if (side && rower.sidePreference === 'scull') list.push('Prefers sculling');
    return list;
  };

  return (
    <div className="mx-auto w-full overflow-x-auto">
      <div className="relative mx-auto" style={{ width: WIDTH, height }}>
        <svg
          width={WIDTH}
          height={height}
          viewBox={`0 0 ${WIDTH} ${height}`}
          className="absolute inset-0 select-none"
        >
          <text
            x={LABEL_W - 4}
            y={12}
            textAnchor="end"
            fontSize={9}
            fontWeight={600}
            letterSpacing={1.5}
            fill={CARDINAL}
          >
            PORT
          </text>
          <text
            x={LABEL_W + HULL_W + 4}
            y={12}
            fontSize={9}
            fontWeight={600}
            letterSpacing={1.5}
            fill={INK}
          >
            STARBOARD
          </text>
          <text
            x={CX}
            y={TIP - 8}
            textAnchor="middle"
            fontSize={8}
            fill="#8a8a8a"
            letterSpacing={1}
          >
            BOW
          </text>
          <path d={hullPath(height)} fill="#fff" stroke={INK} strokeWidth={1.5} />
          {/* keel line */}
          <line
            x1={CX}
            y1={TIP * 0.55}
            x2={CX}
            y2={height - TIP * 0.55}
            stroke={LINE}
            strokeWidth={1}
          />
          {/* fin */}
          <path d={`M ${CX} ${height - TIP * 0.6} l 0 10 l 5 -3 z`} fill={INK} />
          <text
            x={CX}
            y={height - TIP + 14}
            textAnchor="middle"
            fontSize={8}
            fill="#8a8a8a"
            letterSpacing={1}
          >
            STERN
          </text>

          {boat.seats.map((seat) => {
            const y = rowY(seatRow(seat.number));
            return (
              <g key={seat.number}>
                <SeatGlyph y={y} />
                {cls.sculling ? (
                  <ScullOars y={y} />
                ) : (
                  seat.side && (
                    <Oar
                      y={y}
                      side={seat.side}
                      onToggle={() =>
                        onToggleSide(seat.number, seat.side === 'port' ? 'starboard' : 'port')
                      }
                    />
                  )
                )}
                <text
                  x={
                    seat.side === 'starboard' || cls.sculling
                      ? CX - HULL_W / 2 - 6
                      : CX + HULL_W / 2 + 6
                  }
                  y={y + 3.5}
                  textAnchor={seat.side === 'starboard' || cls.sculling ? 'end' : 'start'}
                  fontSize={10}
                  fontWeight={600}
                  fill={INK}
                >
                  {seat.number === boat.seats.length && boat.seats.length > 1
                    ? 'S'
                    : seat.number === 1
                      ? 'B'
                      : seat.number}
                </text>
              </g>
            );
          })}
          {cox && <CoxGlyph y={rowY(coxRow)} />}
        </svg>

        {boat.seats.map((seat) => {
          const y = rowY(seatRow(seat.number));
          const rower = seat.rowerId ? rowerMap.get(seat.rowerId) : undefined;
          const align: Side = cls.sculling ? 'starboard' : (seat.side ?? 'port');
          const label =
            seat.number === 1 && boat.seats.length > 1
              ? 'Bow'
              : seat.number === boat.seats.length
                ? 'Stroke'
                : `Seat ${seat.number}`;
          return (
            <SeatSlot
              key={seat.number}
              id={`seat|${sessionId}|${boat.id}|${seat.number}`}
              y={y}
              align={align}
            >
              {rower ? (
                <RowerChip
                  rower={rower}
                  source={{ boatId: boat.id, seatNumber: seat.number }}
                  warnings={warningsFor(rower, seat.side)}
                />
              ) : (
                <EmptyChip onClick={() => onEmptySeat(seat.number)} label={label} />
              )}
            </SeatSlot>
          );
        })}
        {cox && (
          <CoxSlot
            id={`cox|${sessionId}|${boat.id}`}
            y={rowY(coxRow)}
            coxswain={coxswain}
            warnings={coxswain ? warningsFor(coxswain, null) : []}
            boatId={boat.id}
          />
        )}
      </div>
    </div>
  );
}

function CoxSlot({
  id,
  y,
  coxswain,
  warnings,
  boatId,
}: {
  id: string;
  y: number;
  coxswain?: Rower;
  warnings: string[];
  boatId: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const x = WIDTH - LABEL_W + RIGGER + CHIP_GAP;
  return (
    <div
      ref={setNodeRef}
      style={{ top: y - ROW / 2, left: x, width: CHIP_W, height: ROW }}
      className={`absolute flex items-center rounded-md transition ${isOver ? 'bg-cardinal-soft ring-1 ring-cardinal' : ''}`}
    >
      {coxswain ? (
        <RowerChip rower={coxswain} source={{ boatId, cox: true }} warnings={warnings} />
      ) : (
        <div
          style={{ height: CHIP_H }}
          className="flex w-full items-center justify-center rounded-md border border-dashed border-line-strong bg-white text-xs text-ink-muted"
        >
          Coxswain
        </div>
      )}
    </div>
  );
}

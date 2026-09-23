'use client';

import { useEffect, useRef, useState } from 'react';
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { BoatDiagram } from './BoatDiagram';
import { SeatPicker } from './SeatPicker';
import { AutoTextarea } from './AutoTextarea';
import { formatTwoK } from '@/lib/format';
import { cloneBoat } from '@/lib/factories';
import {
  BOAT_CLASSES,
  getBoatClass,
  type Boat,
  type BoatClassId,
  type Rower,
  type Session,
} from '@/lib/types';
import type { Action } from '@/lib/reducer';

interface Props {
  session: Session;
  boat: Boat;
  rowers: Rower[];
  dispatch: React.Dispatch<Action>;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  picker?: { boatId: string; seatNumber: number };
  setPicker: (value?: { boatId: string; seatNumber: number }) => void;
  pickerSearch: string;
  setPickerSearch: (value: string) => void;
  locations: Map<string, string>;
  coachId: string;
  coachName: string;
  onCopyBoat: () => void;
}

export function BoatCard({
  session,
  boat,
  rowers,
  dispatch,
  menuOpen,
  setMenuOpen,
  picker,
  setPicker,
  pickerSearch,
  setPickerSearch,
  locations,
  coachId,
  coachName,
  onCopyBoat,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `boat|${boat.id}`,
  });
  const classInfo = getBoatClass(boat.classId);
  const filled = boat.seats.filter((seat) => seat.rowerId).length;
  const weights = boat.seats
    .map((seat) => rowers.find((rower) => rower.id === seat.rowerId)?.weightLbs)
    .filter((weight): weight is number => Boolean(weight));
  const ergs = boat.seats
    .map((seat) => rowers.find((rower) => rower.id === seat.rowerId)?.ergTwoKSeconds)
    .filter((erg): erg is number => Boolean(erg));
  const ports = boat.seats.filter((seat) => seat.side === 'port' && seat.rowerId).length;
  const starboards = boat.seats.filter((seat) => seat.side === 'starboard' && seat.rowerId).length;
  const duplicateIds = new Set<string>();
  const assigned = session.boats.flatMap((item) =>
    item.seats.map((seat) => seat.rowerId).filter((id): id is string => Boolean(id)),
  );
  assigned.forEach((id) => {
    if (assigned.filter((candidate) => candidate === id).length > 1) duplicateIds.add(id);
  });
  const duplicate = () =>
    dispatch({
      type: 'ADD_BOAT',
      sessionId: session.id,
      boat: cloneBoat(boat, { withRowers: false, name: `${boat.name} copy` }),
    });
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [menuOpen, setMenuOpen]);
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`card relative overflow-visible p-3 ${isDragging ? 'z-10 opacity-70' : ''}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            className="focus-ring cursor-grab text-ink-muted"
            title="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </button>
          <input
            value={boat.name}
            onChange={(event) =>
              dispatch({
                type: 'RENAME_BOAT',
                sessionId: session.id,
                boatId: boat.id,
                name: event.target.value,
              })
            }
            className="focus-ring min-w-0 bg-transparent text-sm font-semibold"
          />
          <select
            value={boat.classId}
            onChange={(event) =>
              dispatch({
                type: 'SET_CLASS',
                sessionId: session.id,
                boatId: boat.id,
                classId: event.target.value as BoatClassId,
              })
            }
            className="focus-ring bg-transparent text-xs text-ink-muted"
          >
            {BOAT_CLASSES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.id}
              </option>
            ))}
          </select>
        </div>
        <div ref={menuRef} className="relative">
          <button
            className="focus-ring grid h-8 w-8 place-items-center text-lg text-ink-muted hover:bg-paper-alt"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Boat actions"
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 z-20 w-52 rounded-lg border border-line bg-paper p-1">
              {[
                ['Standard (port stroke)', 'standard-port'],
                ['Standard (starboard stroke)', 'standard-starboard'],
                ['Flip all sides', 'flip'],
                ['Bucket preset', 'bucket'],
              ].map(([label, preset]) => (
                <button
                  key={preset}
                  className="focus-ring block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-paper-alt"
                  onClick={() => {
                    dispatch({
                      type: 'RIG_PRESET',
                      sessionId: session.id,
                      boatId: boat.id,
                      preset: preset as 'standard-port' | 'standard-starboard' | 'flip' | 'bucket',
                    });
                    setMenuOpen(false);
                  }}
                >
                  {label}
                </button>
              ))}
              {classInfo.coxed && (
                <button
                  className="focus-ring block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-paper-alt"
                  onClick={() => {
                    dispatch({
                      type: 'SET_COX_POSITION',
                      sessionId: session.id,
                      boatId: boat.id,
                      position: boat.coxPosition === 'stern' ? 'bow' : 'stern',
                    });
                    setMenuOpen(false);
                  }}
                >
                  Cox at {boat.coxPosition === 'stern' ? 'bow' : 'stern'}
                </button>
              )}
              <div className="my-1 border-t border-line" />
              <button
                className="focus-ring block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-paper-alt"
                onClick={() => {
                  duplicate();
                  setMenuOpen(false);
                }}
              >
                Duplicate boat
              </button>
              <button
                className="focus-ring block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-paper-alt"
                onClick={() => {
                  onCopyBoat();
                  setMenuOpen(false);
                }}
              >
                Copy boat
              </button>
              <div className="my-1 border-t border-line" />
              <button
                className="focus-ring block w-full rounded-lg px-3 py-2 text-left text-xs text-cardinal hover:bg-paper-alt"
                onClick={() => {
                  dispatch({ type: 'CLEAR_BOAT', sessionId: session.id, boatId: boat.id });
                  setMenuOpen(false);
                }}
              >
                Clear boat
              </button>
              <button
                className="focus-ring block w-full rounded-lg px-3 py-2 text-left text-xs text-cardinal hover:bg-paper-alt"
                onClick={() => {
                  dispatch({ type: 'REMOVE_BOAT', sessionId: session.id, boatId: boat.id });
                  setMenuOpen(false);
                }}
              >
                Delete boat
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 py-2 text-[10px] text-ink-muted">
        <span className={filled < classInfo.seats ? 'text-cardinal' : 'text-ink'}>
          {filled}/{classInfo.seats} filled
        </span>
        {weights.length > 0 && (
          <span>avg {Math.round(weights.reduce((a, b) => a + b, 0) / weights.length)} lb</span>
        )}
        {ergs.length > 0 && (
          <span>2k {formatTwoK(ergs.reduce((a, b) => a + b, 0) / ergs.length)}</span>
        )}
        {!classInfo.sculling && (
          <span className={ports !== starboards ? 'text-cardinal' : ''}>
            {ports}P / {starboards}S
          </span>
        )}
      </div>
      <BoatDiagram
        sessionId={session.id}
        boat={boat}
        rowers={rowers}
        duplicateIds={duplicateIds}
        onEmptySeat={(seatNumber) => {
          setPicker({ boatId: boat.id, seatNumber });
          setPickerSearch('');
        }}
        onToggleSide={(seatNumber, side) =>
          dispatch({
            type: 'SET_SEAT_SIDE',
            sessionId: session.id,
            boatId: boat.id,
            seatNumber,
            side,
          })
        }
        onRemove={(source) =>
          dispatch(
            'cox' in source
              ? { type: 'CLEAR_COX', sessionId: session.id, boatId: boat.id }
              : {
                  type: 'CLEAR_SEAT',
                  sessionId: session.id,
                  boatId: boat.id,
                  seatNumber: source.seatNumber,
                },
          )
        }
      />
      {picker?.boatId === boat.id && (
        <SeatPicker
          rowers={rowers}
          locations={locations}
          search={pickerSearch}
          setSearch={setPickerSearch}
          onPick={(rowerId) => {
            dispatch({
              type: 'ASSIGN_SEAT',
              sessionId: session.id,
              boatId: boat.id,
              seatNumber: picker.seatNumber,
              rowerId,
            });
            setPicker(undefined);
          }}
          onClose={() => setPicker(undefined)}
        />
      )}
      <BoatNotes
        boat={boat}
        sessionId={session.id}
        dispatch={dispatch}
        coachId={coachId}
        coachName={coachName}
      />
    </article>
  );
}

function BoatNotes({
  boat,
  sessionId,
  dispatch,
  coachId,
  coachName,
}: {
  boat: Boat;
  sessionId: string;
  dispatch: React.Dispatch<Action>;
  coachId: string;
  coachName: string;
}) {
  const [tab, setTab] = useState<'public' | 'private'>('public');
  const privateNote = boat.privateNotes?.[coachId] ?? '';
  const value = tab === 'public' ? boat.notes : privateNote;
  return (
    <div className="mt-2 rounded-lg border border-line p-2">
      <div className="mb-2 flex items-center gap-3">
        <span className="label-caps text-ink-muted">Boat notes</span>
        {(['public', 'private'] as const).map((item) => (
          <button
            key={item}
            className={`label-caps border-b-2 pb-1 ${
              tab === item ? 'border-cardinal text-cardinal' : 'border-transparent'
            }`}
            onClick={() => setTab(item)}
          >
            {item === 'public' ? 'Public' : 'Private'}
            {(item === 'public' ? boat.notes : privateNote) && (
              <span className="ml-1 text-cardinal">•</span>
            )}
          </button>
        ))}
      </div>
      <AutoTextarea
        value={value}
        onChange={(event) =>
          dispatch(
            tab === 'public'
              ? {
                  type: 'SET_BOAT_NOTES',
                  sessionId,
                  boatId: boat.id,
                  notes: event.target.value,
                }
              : {
                  type: 'SET_BOAT_PRIVATE_NOTES',
                  sessionId,
                  boatId: boat.id,
                  coachId,
                  notes: event.target.value,
                },
          )
        }
        className="focus-ring w-full bg-transparent px-1 py-1 text-xs text-ink-soft"
        placeholder={tab === 'private' ? 'Private notes (only you see these)' : 'Boat notes'}
      />
      {tab === 'private' && !coachName && (
        <p className="mt-1 text-[10px] text-ink-muted">
          Set your name in{' '}
          <a className="text-cardinal underline" href="/settings">
            Settings
          </a>{' '}
          so other coaches can tell notes apart later.
        </p>
      )}
    </div>
  );
}

'use client';

import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { BoatDiagram } from './BoatDiagram';
import { SeatPicker } from './SeatPicker';
import { formatTwoK } from '@/lib/format';
import { uid } from '@/lib/ids';
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
      boat: {
        ...structuredClone(boat),
        id: uid('boat'),
        name: `${boat.name} copy`,
        coxswainId: null,
        seats: boat.seats.map((seat) => ({ ...seat, rowerId: null })),
      },
    });
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
            className="focus-ring bg-transparent text-[10px] text-ink-muted"
          >
            {BOAT_CLASSES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.id}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
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
      />
      {picker?.boatId === boat.id && (
        <SeatPicker
          rowers={rowers}
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
      <textarea
        value={boat.notes}
        onChange={(event) =>
          dispatch({
            type: 'SET_BOAT_NOTES',
            sessionId: session.id,
            boatId: boat.id,
            notes: event.target.value,
          })
        }
        className="focus-ring mt-2 min-h-10 w-full resize-y rounded-lg border border-line bg-paper px-2 py-2 text-xs text-ink-soft"
        placeholder="Boat notes…"
      />
    </article>
  );
}

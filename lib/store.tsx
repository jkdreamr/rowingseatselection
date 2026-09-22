'use client';

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createSeats, getBoatClass, type AppData, type Boat, type BoatClassId, type Rower, type Session, type Side } from './types';
import { emptyData, LocalStorageAdapter } from './storage';

export type Action =
  | { type: 'INIT'; data: AppData }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'ADD_ROWER'; rower: Rower }
  | { type: 'UPDATE_ROWER'; rowerId: string; patch: Partial<Rower> }
  | { type: 'DELETE_ROWER'; rowerId: string }
  | { type: 'CREATE_SESSION'; session: Session }
  | { type: 'DUPLICATE_SESSION'; sourceSessionId: string; session: Session }
  | { type: 'DELETE_SESSION'; sessionId: string }
  | { type: 'UPDATE_SESSION'; sessionId: string; patch: Partial<Session> }
  | { type: 'ADD_BOAT'; sessionId: string; boat: Boat }
  | { type: 'REMOVE_BOAT'; sessionId: string; boatId: string }
  | { type: 'RENAME_BOAT'; sessionId: string; boatId: string; name: string }
  | { type: 'REORDER_BOATS'; sessionId: string; from: number; to: number }
  | { type: 'SET_CLASS'; sessionId: string; boatId: string; classId: BoatClassId }
  | { type: 'SET_COX_POSITION'; sessionId: string; boatId: string; position: 'stern' | 'bow' }
  | { type: 'SET_BOAT_NOTES'; sessionId: string; boatId: string; notes: string }
  | { type: 'ASSIGN_SEAT'; sessionId: string; boatId: string; seatNumber: number; rowerId: string; source?: { boatId: string; seatNumber: number } }
  | { type: 'CLEAR_SEAT'; sessionId: string; boatId: string; seatNumber: number }
  | { type: 'SWAP_SEATS'; sessionId: string; first: { boatId: string; seatNumber: number }; second: { boatId: string; seatNumber: number } }
  | { type: 'SET_SEAT_SIDE'; sessionId: string; boatId: string; seatNumber: number; side: Side }
  | { type: 'RIG_PRESET'; sessionId: string; boatId: string; preset: 'standard-port' | 'standard-starboard' | 'flip' | 'bucket' }
  | { type: 'ASSIGN_COX'; sessionId: string; boatId: string; rowerId: string }
  | { type: 'CLEAR_COX'; sessionId: string; boatId: string };

interface HistoryState {
  present: AppData;
  past: AppData[];
  future: AppData[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function updateSession(data: AppData, sessionId: string, updater: (session: Session) => Session): AppData {
  return { ...data, sessions: data.sessions.map((session) => session.id === sessionId ? updater(session) : session) };
}

function updateBoat(data: AppData, sessionId: string, boatId: string, updater: (boat: Boat) => Boat): AppData {
  return updateSession(data, sessionId, (session) => ({ ...session, boats: session.boats.map((boat) => boat.id === boatId ? updater(boat) : boat), updatedAt: new Date().toISOString() }));
}

function seatLocation(data: AppData, sessionId: string, rowerId: string) {
  const session = data.sessions.find((item) => item.id === sessionId);
  for (const boat of session?.boats ?? []) {
    const seat = boat.seats.find((item) => item.rowerId === rowerId);
    if (seat) return { boatId: boat.id, seatNumber: seat.number };
  }
  return null;
}

function setSeat(boat: Boat, seatNumber: number, rowerId: string | null) {
  return { ...boat, seats: boat.seats.map((seat) => seat.number === seatNumber ? { ...seat, rowerId } : seat) };
}

function reduceData(data: AppData, action: Exclude<Action, { type: 'INIT' | 'UNDO' | 'REDO' }>): AppData {
  const now = new Date().toISOString();
  switch (action.type) {
    case 'ADD_ROWER': return { ...data, rowers: [...data.rowers, action.rower] };
    case 'UPDATE_ROWER': return { ...data, rowers: data.rowers.map((rower) => rower.id === action.rowerId ? { ...rower, ...action.patch, updatedAt: now } : rower) };
    case 'DELETE_ROWER': return {
      ...data,
      rowers: data.rowers.filter((rower) => rower.id !== action.rowerId),
      sessions: data.sessions.map((session) => ({ ...session, boats: session.boats.map((boat) => ({ ...boat, coxswainId: boat.coxswainId === action.rowerId ? null : boat.coxswainId, seats: boat.seats.map((seat) => seat.rowerId === action.rowerId ? { ...seat, rowerId: null } : seat) })) })),
    };
    case 'CREATE_SESSION': return { ...data, sessions: [...data.sessions, action.session] };
    case 'DUPLICATE_SESSION': return { ...data, sessions: [...data.sessions, action.session] };
    case 'DELETE_SESSION': return { ...data, sessions: data.sessions.filter((session) => session.id !== action.sessionId) };
    case 'UPDATE_SESSION': return updateSession(data, action.sessionId, (session) => ({ ...session, ...action.patch, updatedAt: now }));
    case 'ADD_BOAT': return updateSession(data, action.sessionId, (session) => ({ ...session, boats: [...session.boats, action.boat], updatedAt: now }));
    case 'REMOVE_BOAT': return updateSession(data, action.sessionId, (session) => ({ ...session, boats: session.boats.filter((boat) => boat.id !== action.boatId), updatedAt: now }));
    case 'RENAME_BOAT': return updateBoat(data, action.sessionId, action.boatId, (boat) => ({ ...boat, name: action.name }));
    case 'REORDER_BOATS': return updateSession(data, action.sessionId, (session) => {
      const boats = [...session.boats];
      const [moved] = boats.splice(action.from, 1);
      boats.splice(action.to, 0, moved);
      return { ...session, boats };
    });
    case 'SET_CLASS': return updateBoat(data, action.sessionId, action.boatId, (boat) => {
      const classInfo = getBoatClass(action.classId);
      const oldSeats = new Map(boat.seats.map((seat) => [seat.number, seat.rowerId]));
      const seats = createSeats(action.classId).map((seat) => ({ ...seat, rowerId: oldSeats.get(seat.number) ?? null }));
      return { ...boat, classId: action.classId, seats, coxswainId: classInfo.coxed ? boat.coxswainId : null };
    });
    case 'SET_COX_POSITION': return updateBoat(data, action.sessionId, action.boatId, (boat) => ({ ...boat, coxPosition: action.position }));
    case 'SET_BOAT_NOTES': return updateBoat(data, action.sessionId, action.boatId, (boat) => ({ ...boat, notes: action.notes }));
    case 'ASSIGN_SEAT': {
      const sourceLocation = action.source ?? seatLocation(data, action.sessionId, action.rowerId);
      let next = updateSession(data, action.sessionId, (session) => ({
        ...session,
        boats: session.boats.map((boat) => ({ ...boat, seats: boat.seats.map((seat) => seat.rowerId === action.rowerId ? { ...seat, rowerId: null } : seat) })),
      }));
      const targetBoat = next.sessions.find((session) => session.id === action.sessionId)?.boats.find((boat) => boat.id === action.boatId);
      const targetSeat = targetBoat?.seats.find((seat) => seat.number === action.seatNumber);
      const displaced = targetSeat?.rowerId ?? null;
      if (sourceLocation && displaced && sourceLocation.boatId !== action.boatId || sourceLocation && displaced && sourceLocation.seatNumber !== action.seatNumber) {
        next = updateBoat(next, action.sessionId, action.boatId, (boat) => setSeat(boat, action.seatNumber, action.rowerId));
        next = updateBoat(next, action.sessionId, sourceLocation.boatId, (boat) => setSeat(boat, sourceLocation.seatNumber, displaced));
      } else {
        next = updateBoat(next, action.sessionId, action.boatId, (boat) => setSeat(boat, action.seatNumber, action.rowerId));
      }
      return next;
    }
    case 'CLEAR_SEAT': return updateBoat(data, action.sessionId, action.boatId, (boat) => setSeat(boat, action.seatNumber, null));
    case 'SWAP_SEATS': {
      const session = data.sessions.find((item) => item.id === action.sessionId);
      const firstBoat = session?.boats.find((boat) => boat.id === action.first.boatId);
      const secondBoat = session?.boats.find((boat) => boat.id === action.second.boatId);
      const first = firstBoat?.seats.find((seat) => seat.number === action.first.seatNumber)?.rowerId ?? null;
      const second = secondBoat?.seats.find((seat) => seat.number === action.second.seatNumber)?.rowerId ?? null;
      return updateBoat(updateBoat(data, action.sessionId, action.first.boatId, (boat) => setSeat(boat, action.first.seatNumber, second)), action.sessionId, action.second.boatId, (boat) => setSeat(boat, action.second.seatNumber, first));
    }
    case 'SET_SEAT_SIDE': return updateBoat(data, action.sessionId, action.boatId, (boat) => ({ ...boat, seats: boat.seats.map((seat) => seat.number === action.seatNumber ? { ...seat, side: action.side } : seat) }));
    case 'RIG_PRESET': return updateBoat(data, action.sessionId, action.boatId, (boat) => {
      const count = boat.seats.length;
      const currentStroke = boat.seats.find((seat) => seat.number === count)?.side ?? 'port';
      let sides: Side[] = boat.seats.map((seat) => seat.side ?? 'port');
      if (action.preset === 'flip') sides = sides.map((side) => side === 'port' ? 'starboard' : 'port');
      else if (action.preset === 'bucket' && count === 8) sides = ['port', 'starboard', 'port', 'starboard', 'port', 'starboard', 'starboard', 'port'];
      else if (action.preset === 'bucket' && count === 4) sides = ['port', 'starboard', 'starboard', 'port'];
      else {
        const stroke = action.preset === 'standard-starboard' ? 'starboard' : action.preset === 'standard-port' ? 'port' : currentStroke;
        sides = boat.seats.map((seat) => (seat.side === null ? 'port' : createSeats(count === 8 ? '8+' : count === 4 ? '4+' : boat.classId, stroke)[seat.number - 1]?.side ?? seat.side ?? stroke));
      }
      return { ...boat, seats: boat.seats.map((seat, index) => seat.side === null ? seat : { ...seat, side: sides[index] }) };
    });
    case 'ASSIGN_COX': return updateBoat(data, action.sessionId, action.boatId, (boat) => ({ ...boat, coxswainId: action.rowerId }));
    case 'CLEAR_COX': return updateBoat(data, action.sessionId, action.boatId, (boat) => ({ ...boat, coxswainId: null }));
  }
}

export function lineupReducer(state: HistoryState, action: Action): HistoryState {
  if (action.type === 'INIT') return { present: action.data, past: [], future: [] };
  if (action.type === 'UNDO') {
    const previous = state.past[state.past.length - 1];
    return previous ? { present: previous, past: state.past.slice(0, -1), future: [state.present, ...state.future].slice(0, 50) } : state;
  }
  if (action.type === 'REDO') {
    const next = state.future[0];
    return next ? { present: next, past: [...state.past, state.present].slice(-50), future: state.future.slice(1) } : state;
  }
  const next = reduceData(state.present, action);
  if (JSON.stringify(next) === JSON.stringify(state.present)) return state;
  return { present: next, past: [...state.past, state.present].slice(-50), future: [] };
}

const initialHistory: HistoryState = { present: emptyData(), past: [], future: [] };
interface StoreContextValue extends HistoryState {
  loaded: boolean;
  dispatch: React.Dispatch<Action>;
  canUndo: boolean;
  canRedo: boolean;
}
const StoreContext = createContext<StoreContextValue | null>(null);

export function LineupStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(lineupReducer, initialHistory);
  const [loaded, setLoaded] = useState(false);
  const adapter = useMemo(() => new LocalStorageAdapter(), []);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    adapter.load().then((data) => { dispatch({ type: 'INIT', data }); setLoaded(true); });
  }, [adapter]);
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void adapter.save(state.present); }, 300);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [adapter, loaded, state.present]);
  const value = useMemo(() => ({ ...state, loaded, dispatch, canUndo: state.past.length > 0, canRedo: state.future.length > 0 }), [state, loaded]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useLineupStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useLineupStore must be used inside LineupStoreProvider');
  return context;
}

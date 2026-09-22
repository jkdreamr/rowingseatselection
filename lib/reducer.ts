import {
  createSeats,
  getBoatClass,
  type AppData,
  type Boat,
  type BoatClassId,
  type Rower,
  type SeatSource,
  type Session,
  type Side,
} from './types';

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
  | { type: 'CLEAR_BOAT'; sessionId: string; boatId: string }
  | {
      type: 'ASSIGN_SEAT';
      sessionId: string;
      boatId: string;
      seatNumber: number;
      rowerId: string;
      source?: SeatSource;
    }
  | { type: 'CLEAR_SEAT'; sessionId: string; boatId: string; seatNumber: number }
  | {
      type: 'SWAP_SEATS';
      sessionId: string;
      first: { boatId: string; seatNumber: number };
      second: { boatId: string; seatNumber: number };
    }
  | { type: 'SET_SEAT_SIDE'; sessionId: string; boatId: string; seatNumber: number; side: Side }
  | {
      type: 'RIG_PRESET';
      sessionId: string;
      boatId: string;
      preset: 'standard-port' | 'standard-starboard' | 'flip' | 'bucket';
    }
  | { type: 'ASSIGN_COX'; sessionId: string; boatId: string; rowerId: string; source?: SeatSource }
  | { type: 'CLEAR_COX'; sessionId: string; boatId: string };

export interface HistoryState {
  present: AppData;
  past: AppData[];
  future: AppData[];
}

function updateSession(
  data: AppData,
  sessionId: string,
  updater: (session: Session) => Session,
): AppData {
  return {
    ...data,
    sessions: data.sessions.map((session) =>
      session.id === sessionId ? updater(session) : session,
    ),
  };
}

function updateBoat(
  data: AppData,
  sessionId: string,
  boatId: string,
  updater: (boat: Boat) => Boat,
): AppData {
  return updateSession(data, sessionId, (session) => ({
    ...session,
    boats: session.boats.map((boat) => (boat.id === boatId ? updater(boat) : boat)),
    updatedAt: new Date().toISOString(),
  }));
}

function getSession(data: AppData, sessionId: string): Session | undefined {
  return data.sessions.find((session) => session.id === sessionId);
}

function findRowerLocation(data: AppData, sessionId: string, rowerId: string): SeatSource | null {
  const session = getSession(data, sessionId);
  for (const boat of session?.boats ?? []) {
    const seat = boat.seats.find((item) => item.rowerId === rowerId);
    if (seat) return { boatId: boat.id, seatNumber: seat.number };
    if (boat.coxswainId === rowerId) return { boatId: boat.id, cox: true };
  }
  return null;
}

function isSeatSource(source: SeatSource): source is { boatId: string; seatNumber: number } {
  return 'seatNumber' in source;
}

function clearRower(data: AppData, sessionId: string, rowerId: string): AppData {
  return updateSession(data, sessionId, (session) => ({
    ...session,
    boats: session.boats.map((boat) => ({
      ...boat,
      coxswainId: boat.coxswainId === rowerId ? null : boat.coxswainId,
      seats: boat.seats.map((seat) =>
        seat.rowerId === rowerId ? { ...seat, rowerId: null } : seat,
      ),
    })),
  }));
}

function setSeat(boat: Boat, seatNumber: number, rowerId: string | null): Boat {
  return {
    ...boat,
    seats: boat.seats.map((seat) => (seat.number === seatNumber ? { ...seat, rowerId } : seat)),
  };
}

function setCox(boat: Boat, rowerId: string | null): Boat {
  return { ...boat, coxswainId: rowerId };
}

function reduceData(
  data: AppData,
  action: Exclude<Action, { type: 'INIT' | 'UNDO' | 'REDO' }>,
): AppData {
  switch (action.type) {
    case 'ADD_ROWER':
      return { ...data, rowers: [...data.rowers, action.rower] };
    case 'UPDATE_ROWER':
      return {
        ...data,
        rowers: data.rowers.map((rower) =>
          rower.id === action.rowerId
            ? { ...rower, ...action.patch, updatedAt: new Date().toISOString() }
            : rower,
        ),
      };
    case 'DELETE_ROWER':
      return {
        ...data,
        rowers: data.rowers.filter((rower) => rower.id !== action.rowerId),
        sessions: data.sessions.map((session) => ({
          ...session,
          boats: session.boats.map((boat) => ({
            ...boat,
            coxswainId: boat.coxswainId === action.rowerId ? null : boat.coxswainId,
            seats: boat.seats.map((seat) =>
              seat.rowerId === action.rowerId ? { ...seat, rowerId: null } : seat,
            ),
          })),
        })),
      };
    case 'CREATE_SESSION':
    case 'DUPLICATE_SESSION':
      return { ...data, sessions: [...data.sessions, action.session] };
    case 'DELETE_SESSION':
      return {
        ...data,
        sessions: data.sessions.filter((session) => session.id !== action.sessionId),
      };
    case 'UPDATE_SESSION':
      return updateSession(data, action.sessionId, (session) => ({
        ...session,
        ...action.patch,
        updatedAt: new Date().toISOString(),
      }));
    case 'ADD_BOAT':
      return updateSession(data, action.sessionId, (session) => ({
        ...session,
        boats: [...session.boats, action.boat],
      }));
    case 'REMOVE_BOAT':
      return updateSession(data, action.sessionId, (session) => ({
        ...session,
        boats: session.boats.filter((boat) => boat.id !== action.boatId),
      }));
    case 'RENAME_BOAT':
      return updateBoat(data, action.sessionId, action.boatId, (boat) => ({
        ...boat,
        name: action.name,
      }));
    case 'REORDER_BOATS':
      return updateSession(data, action.sessionId, (session) => {
        const boats = [...session.boats];
        const [moved] = boats.splice(action.from, 1);
        boats.splice(action.to, 0, moved);
        return { ...session, boats };
      });
    case 'SET_CLASS':
      return updateBoat(data, action.sessionId, action.boatId, (boat) => {
        const classInfo = getBoatClass(action.classId);
        const oldSeats = new Map(boat.seats.map((seat) => [seat.number, seat.rowerId]));
        const seats = createSeats(action.classId).map((seat) => ({
          ...seat,
          rowerId: oldSeats.get(seat.number) ?? null,
        }));
        return {
          ...boat,
          classId: action.classId,
          seats,
          coxswainId: classInfo.coxed ? boat.coxswainId : null,
        };
      });
    case 'SET_COX_POSITION':
      return updateBoat(data, action.sessionId, action.boatId, (boat) => ({
        ...boat,
        coxPosition: action.position,
      }));
    case 'SET_BOAT_NOTES':
      return updateBoat(data, action.sessionId, action.boatId, (boat) => ({
        ...boat,
        notes: action.notes,
      }));
    case 'CLEAR_BOAT':
      return updateBoat(data, action.sessionId, action.boatId, (boat) => ({
        ...boat,
        seats: boat.seats.map((seat) => ({ ...seat, rowerId: null })),
        coxswainId: null,
      }));
    case 'ASSIGN_SEAT': {
      const source = action.source ?? findRowerLocation(data, action.sessionId, action.rowerId);
      const targetBoat = getSession(data, action.sessionId)?.boats.find(
        (boat) => boat.id === action.boatId,
      );
      const displaced =
        targetBoat?.seats.find((seat) => seat.number === action.seatNumber)?.rowerId ?? null;
      const sameSeat =
        source &&
        isSeatSource(source) &&
        source.boatId === action.boatId &&
        source.seatNumber === action.seatNumber;
      const shouldSwap = source !== null && displaced !== null && !sameSeat && isSeatSource(source);
      let next = clearRower(data, action.sessionId, action.rowerId);
      next = updateBoat(next, action.sessionId, action.boatId, (boat) =>
        setSeat(boat, action.seatNumber, action.rowerId),
      );
      if (shouldSwap && displaced) {
        next = updateBoat(next, action.sessionId, source.boatId, (boat) =>
          setSeat(boat, source.seatNumber, displaced),
        );
      }
      return next;
    }
    case 'CLEAR_SEAT':
      return updateBoat(data, action.sessionId, action.boatId, (boat) =>
        setSeat(boat, action.seatNumber, null),
      );
    case 'SWAP_SEATS': {
      const session = getSession(data, action.sessionId);
      const firstBoat = session?.boats.find((boat) => boat.id === action.first.boatId);
      const secondBoat = session?.boats.find((boat) => boat.id === action.second.boatId);
      const first =
        firstBoat?.seats.find((seat) => seat.number === action.first.seatNumber)?.rowerId ?? null;
      const second =
        secondBoat?.seats.find((seat) => seat.number === action.second.seatNumber)?.rowerId ?? null;
      return updateBoat(
        updateBoat(data, action.sessionId, action.first.boatId, (boat) =>
          setSeat(boat, action.first.seatNumber, second),
        ),
        action.sessionId,
        action.second.boatId,
        (boat) => setSeat(boat, action.second.seatNumber, first),
      );
    }
    case 'SET_SEAT_SIDE':
      return updateBoat(data, action.sessionId, action.boatId, (boat) => ({
        ...boat,
        seats: boat.seats.map((seat) =>
          seat.number === action.seatNumber ? { ...seat, side: action.side } : seat,
        ),
      }));
    case 'RIG_PRESET':
      return updateBoat(data, action.sessionId, action.boatId, (boat) => {
        if (getBoatClass(boat.classId).sculling) return boat;
        const count = boat.seats.length;
        if (action.preset === 'bucket' && count !== 8 && count !== 4) return boat;
        let sides: Side[];
        if (action.preset === 'bucket' && count === 8) {
          sides = [
            'port',
            'starboard',
            'port',
            'starboard',
            'port',
            'starboard',
            'starboard',
            'port',
          ];
        } else if (action.preset === 'bucket' && count === 4) {
          sides = ['port', 'starboard', 'starboard', 'port'];
        } else if (action.preset === 'flip') {
          sides = boat.seats.map((seat) => (seat.side === 'port' ? 'starboard' : 'port'));
        } else {
          const stroke = action.preset === 'standard-starboard' ? 'starboard' : 'port';
          sides = createSeats(boat.classId, stroke).map((seat) => seat.side ?? stroke);
        }
        return {
          ...boat,
          seats: boat.seats.map((seat, index) => ({ ...seat, side: sides[index] })),
        };
      });
    case 'ASSIGN_COX': {
      const source = action.source ?? findRowerLocation(data, action.sessionId, action.rowerId);
      const targetBoat = getSession(data, action.sessionId)?.boats.find(
        (boat) => boat.id === action.boatId,
      );
      const displaced = targetBoat?.coxswainId ?? null;
      const shouldSwap =
        source !== null &&
        !isSeatSource(source) &&
        source.boatId !== action.boatId &&
        displaced !== null;
      let next = clearRower(data, action.sessionId, action.rowerId);
      next = updateBoat(next, action.sessionId, action.boatId, (boat) =>
        setCox(boat, action.rowerId),
      );
      if (shouldSwap && displaced) {
        next = updateBoat(next, action.sessionId, source.boatId, (boat) => setCox(boat, displaced));
      }
      return next;
    }
    case 'CLEAR_COX':
      return updateBoat(data, action.sessionId, action.boatId, (boat) => setCox(boat, null));
  }
}

export function lineupReducer(state: HistoryState, action: Action): HistoryState {
  if (action.type === 'INIT') return { present: action.data, past: [], future: [] };
  if (action.type === 'UNDO') {
    const previous = state.past[state.past.length - 1];
    return previous
      ? {
          present: previous,
          past: state.past.slice(0, -1),
          future: [state.present, ...state.future].slice(0, 50),
        }
      : state;
  }
  if (action.type === 'REDO') {
    const next = state.future[0];
    return next
      ? {
          present: next,
          past: [...state.past, state.present].slice(-50),
          future: state.future.slice(1),
        }
      : state;
  }
  const next = reduceData(state.present, action);
  if (JSON.stringify(next) === JSON.stringify(state.present)) return state;
  return {
    present: next,
    past: [...state.past, state.present].slice(-50),
    future: [],
  };
}

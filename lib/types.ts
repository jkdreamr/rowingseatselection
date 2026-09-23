export type Side = 'port' | 'starboard';
export type SidePreference = Side | 'both' | 'scull';
export type RowerStatus = 'available' | 'unavailable';
export type SeatSource = { boatId: string; seatNumber: number } | { boatId: string; cox: true };

export interface Rower {
  id: string;
  name: string;
  sidePreference: SidePreference;
  isCoxswain: boolean;
  canCox: boolean;
  weightLbs?: number;
  ergTwoKSeconds?: number;
  status: RowerStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type BoatClassId = '8+' | '4+' | '4-' | '4x' | '4x+' | '2-' | '2x' | '2+' | '1x' | '8x+';

export interface BoatClass {
  id: BoatClassId;
  label: string;
  seats: number;
  coxed: boolean;
  sculling: boolean;
}

export interface Seat {
  number: number;
  side: Side | null;
  rowerId: string | null;
}

export interface Boat {
  id: string;
  classId: BoatClassId;
  name: string;
  seats: Seat[];
  coxswainId: string | null;
  coxPosition: 'stern' | 'bow';
  notes: string;
  privateNotes?: PrivateNotes;
  color?: string;
}

/** Keyed by coach id; only the matching coach's entry is ever shown. */
export type PrivateNotes = Record<string, string>;

export type SessionKind = 'session' | 'playground';

/**
 * One lineup. Alternative lineups for the same practice share a `groupId`
 * and are distinguished by `variant` ("Lineup A", "Lineup B"...).
 * Playground lineups have `kind: 'playground'` and an empty `date`.
 */
export interface Session {
  id: string;
  date: string;
  label: string;
  groupId: string;
  variant: string;
  kind: SessionKind;
  boats: Boat[];
  notes: string;
  privateNotes?: PrivateNotes;
  unassignedNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Coach {
  id: string;
  name: string;
}

export interface AppData {
  version: 1;
  rowers: Rower[];
  sessions: Session[];
}

export const BOAT_CLASSES: BoatClass[] = [
  { id: '8+', label: 'Eight', seats: 8, coxed: true, sculling: false },
  { id: '4+', label: 'Coxed four', seats: 4, coxed: true, sculling: false },
  { id: '4-', label: 'Straight four', seats: 4, coxed: false, sculling: false },
  { id: '4x', label: 'Quad', seats: 4, coxed: false, sculling: true },
  { id: '4x+', label: 'Coxed quad', seats: 4, coxed: true, sculling: true },
  { id: '2-', label: 'Pair', seats: 2, coxed: false, sculling: false },
  { id: '2x', label: 'Double', seats: 2, coxed: false, sculling: true },
  { id: '2+', label: 'Coxed pair', seats: 2, coxed: true, sculling: false },
  { id: '1x', label: 'Single', seats: 1, coxed: false, sculling: true },
  { id: '8x+', label: 'Octuple', seats: 8, coxed: true, sculling: true },
];

export const ROWER_STATUSES: RowerStatus[] = ['available', 'unavailable'];

export function getBoatClass(id: BoatClassId) {
  return BOAT_CLASSES.find((boatClass) => boatClass.id === id) ?? BOAT_CLASSES[0];
}

export function standardSide(number: number, seats: number, stroke: Side = 'port'): Side {
  const fromStroke = seats - number;
  return fromStroke % 2 === 0 ? stroke : stroke === 'port' ? 'starboard' : 'port';
}

export function createSeats(classId: BoatClassId, stroke: Side = 'port'): Seat[] {
  const boatClass = getBoatClass(classId);
  return Array.from({ length: boatClass.seats }, (_, index) => ({
    number: index + 1,
    side: boatClass.sculling ? null : standardSide(index + 1, boatClass.seats, stroke),
    rowerId: null,
  }));
}

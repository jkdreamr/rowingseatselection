import {
  createSeats,
  type Boat,
  type BoatClassId,
  type Session,
  type SessionKind,
} from './types';
import { today } from './format';
import { uid } from './ids';

export function newBoat(index: number, classId: BoatClassId = '8+'): Boat {
  return {
    id: uid('boat'),
    classId,
    name: `Boat ${index}`,
    seats: createSeats(classId),
    coxswainId: null,
    coxPosition: 'stern',
    notes: '',
  };
}

export function newSession(
  date = today(),
  label = 'AM',
  options: { kind?: SessionKind; groupId?: string; variant?: string } = {},
): Session {
  const timestamp = new Date().toISOString();
  const id = uid('session');
  return {
    id,
    date: options.kind === 'playground' ? '' : date,
    label,
    groupId: options.groupId ?? id,
    variant: options.variant ?? 'Lineup A',
    kind: options.kind ?? 'session',
    boats: [],
    notes: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/** Next variant name in a group: Lineup A, Lineup B, ... Lineup Z, Lineup 27... */
export function nextVariantName(existing: string[]): string {
  for (let i = 0; i < 26; i++) {
    const candidate = `Lineup ${String.fromCharCode(65 + i)}`;
    if (!existing.includes(candidate)) return candidate;
  }
  return `Lineup ${existing.length + 1}`;
}

/** Deep copy of a boat with a fresh id. Private notes are never copied. */
export function cloneBoat(boat: Boat, options: { withRowers?: boolean; name?: string } = {}): Boat {
  const withRowers = options.withRowers ?? true;
  return {
    ...structuredClone(boat),
    id: uid('boat'),
    name: options.name ?? boat.name,
    privateNotes: undefined,
    coxswainId: withRowers ? boat.coxswainId : null,
    seats: boat.seats.map((seat) => ({ ...seat, rowerId: withRowers ? seat.rowerId : null })),
  };
}

/**
 * Deep copy of a lineup with fresh ids. Public notes are kept; private notes
 * are never copied. Pass `groupId` to make the copy an alternative lineup of
 * an existing session, otherwise it starts its own group.
 */
export function cloneSession(
  source: Session,
  overrides: Partial<Pick<Session, 'date' | 'label' | 'kind' | 'groupId' | 'variant'>> & {
    withRowers?: boolean;
  } = {},
): Session {
  const timestamp = new Date().toISOString();
  const id = uid('session');
  const kind = overrides.kind ?? source.kind;
  return {
    id,
    kind,
    date: kind === 'playground' ? '' : (overrides.date ?? source.date),
    label: overrides.label ?? source.label,
    groupId: overrides.groupId ?? id,
    variant: overrides.variant ?? 'Lineup A',
    boats: source.boats.map((boat) => cloneBoat(boat, { withRowers: overrides.withRowers })),
    notes: source.notes,
    unassignedNote: source.unassignedNote,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

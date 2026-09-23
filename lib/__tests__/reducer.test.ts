import { describe, expect, it } from 'vitest';
import { lineupReducer, type Action } from '../store';
import { createSeats, type AppData, type Boat, type Rower, type Session } from '../types';
import { normalizeImportedData, seedRoster, stanfordRoster } from '../storage';
import { cloneSession } from '../factories';

const rower = (id: string): Rower => ({
  id,
  name: id,
  sidePreference: 'both',
  isCoxswain: false,
  canCox: false,
  status: 'available',
  createdAt: '',
  updatedAt: '',
});
const boat = (id: string, classId: Boat['classId'] = '4+'): Boat => ({
  id,
  classId,
  name: id,
  seats: createSeats(classId),
  coxswainId: null,
  coxPosition: 'stern',
  notes: '',
});
const session = (boats: Boat[]): Session => ({
  id: 'session',
  date: '2025-01-01',
  label: 'AM',
  groupId: 'session',
  variant: 'Lineup A',
  kind: 'session',
  boats,
  notes: '',
  createdAt: '',
  updatedAt: '',
});
const data = (boats: Boat[] = [boat('boat')]): AppData => ({
  version: 1,
  rowers: [rower('a'), rower('b'), rower('c')],
  sessions: [session(boats)],
});
const reduce = (value: AppData, action: Action) =>
  lineupReducer({ present: value, past: [], future: [] }, action).present;

describe('lineup reducer', () => {
  it('provides the Stanford roster with four coxswains and no performance stats', () => {
    const roster = stanfordRoster();
    expect(roster).toHaveLength(39);
    expect(roster.filter((item) => item.isCoxswain).map((item) => item.name)).toEqual([
      'Kannan Alford',
      'Ginger Bernstein',
      'Josh Koo',
      'Gabrielle Zammit',
    ]);
    expect(roster.every((item) => item.weightLbs === undefined)).toBe(true);
    expect(roster.every((item) => item.ergTwoKSeconds === undefined)).toBe(true);
  });

  it('moves a rower out of their previous seat when assigning', () => {
    const initial = data();
    initial.sessions[0].boats[0].seats[0].rowerId = 'a';
    const next = reduce(initial, {
      type: 'ASSIGN_SEAT',
      sessionId: 'session',
      boatId: 'boat',
      seatNumber: 2,
      rowerId: 'a',
    });
    expect(next.sessions[0].boats[0].seats.map((seat) => seat.rowerId)).toEqual([
      null,
      'a',
      null,
      null,
    ]);
  });

  it('swaps when dragging from a seat onto an occupied seat', () => {
    const initial = data();
    initial.sessions[0].boats[0].seats[0].rowerId = 'a';
    initial.sessions[0].boats[0].seats[1].rowerId = 'b';
    const next = reduce(initial, {
      type: 'ASSIGN_SEAT',
      sessionId: 'session',
      boatId: 'boat',
      seatNumber: 2,
      rowerId: 'a',
      source: { boatId: 'boat', seatNumber: 1 },
    });
    expect(next.sessions[0].boats[0].seats.slice(0, 2).map((seat) => seat.rowerId)).toEqual([
      'b',
      'a',
    ]);
  });

  it('preserves overlapping seats and clears cox on an uncoxed class', () => {
    const initial = data();
    initial.sessions[0].boats[0].seats[0].rowerId = 'a';
    initial.sessions[0].boats[0].coxswainId = 'c';
    const next = reduce(initial, {
      type: 'SET_CLASS',
      sessionId: 'session',
      boatId: 'boat',
      classId: '2-',
    });
    expect(next.sessions[0].boats[0].seats.map((seat) => seat.rowerId)).toEqual(['a', null]);
    expect(next.sessions[0].boats[0].coxswainId).toBeNull();
  });

  it('creates exact eight-seat bucket and supports flip', () => {
    const initial = data([boat('boat', '8+')]);
    let next = reduce(initial, {
      type: 'RIG_PRESET',
      sessionId: 'session',
      boatId: 'boat',
      preset: 'bucket',
    });
    expect(next.sessions[0].boats[0].seats.map((seat) => seat.side)).toEqual([
      'port',
      'starboard',
      'port',
      'starboard',
      'port',
      'starboard',
      'starboard',
      'port',
    ]);
    next = reduce(next, {
      type: 'RIG_PRESET',
      sessionId: 'session',
      boatId: 'boat',
      preset: 'flip',
    });
    expect(next.sessions[0].boats[0].seats.map((seat) => seat.side)).toEqual([
      'starboard',
      'port',
      'starboard',
      'port',
      'starboard',
      'port',
      'port',
      'starboard',
    ]);
  });

  it('creates the exact standard-starboard pattern', () => {
    const next = reduce(data([boat('boat', '8+')]), {
      type: 'RIG_PRESET',
      sessionId: 'session',
      boatId: 'boat',
      preset: 'standard-starboard',
    });
    expect(next.sessions[0].boats[0].seats.map((seat) => seat.side)).toEqual([
      'port',
      'starboard',
      'port',
      'starboard',
      'port',
      'starboard',
      'port',
      'starboard',
    ]);
  });

  it('clears a rower from a cox slot when assigning a seat', () => {
    const initial = data();
    initial.sessions[0].boats[0].coxswainId = 'a';
    const next = reduce(initial, {
      type: 'ASSIGN_SEAT',
      sessionId: 'session',
      boatId: 'boat',
      seatNumber: 1,
      rowerId: 'a',
    });
    expect(next.sessions[0].boats[0].coxswainId).toBeNull();
    expect(next.sessions[0].boats[0].seats[0].rowerId).toBe('a');
  });

  it('clears a rower from a seat when assigning a cox slot', () => {
    const initial = data();
    initial.sessions[0].boats[0].seats[0].rowerId = 'a';
    const next = reduce(initial, {
      type: 'ASSIGN_COX',
      sessionId: 'session',
      boatId: 'boat',
      rowerId: 'a',
    });
    expect(next.sessions[0].boats[0].seats[0].rowerId).toBeNull();
    expect(next.sessions[0].boats[0].coxswainId).toBe('a');
  });

  it('swaps coxes when dragging between occupied cox slots', () => {
    const initial = data([boat('first'), boat('second')]);
    initial.sessions[0].boats[0].coxswainId = 'a';
    initial.sessions[0].boats[1].coxswainId = 'b';
    const next = reduce(initial, {
      type: 'ASSIGN_COX',
      sessionId: 'session',
      boatId: 'second',
      rowerId: 'a',
      source: { boatId: 'first', cox: true },
    });
    expect(next.sessions[0].boats.map((item) => item.coxswainId)).toEqual(['b', 'a']);
  });

  it('clears an entire boat in one undo step', () => {
    const initial = data();
    initial.sessions[0].boats[0].seats[0].rowerId = 'a';
    initial.sessions[0].boats[0].coxswainId = 'b';
    const changed = lineupReducer(
      { present: initial, past: [], future: [] },
      { type: 'CLEAR_BOAT', sessionId: 'session', boatId: 'boat' },
    );
    expect(changed.past).toHaveLength(1);
    const undone = lineupReducer(changed, { type: 'UNDO' });
    expect(undone.present.sessions[0].boats[0].seats[0].rowerId).toBe('a');
    expect(undone.present.sessions[0].boats[0].coxswainId).toBe('b');
  });

  it('normalizes duplicated boats without assigned rowers', () => {
    const source = boat('source');
    source.seats[0].rowerId = 'a';
    source.coxswainId = 'b';
    const next = reduce(data([source]), {
      type: 'ADD_BOAT',
      sessionId: 'session',
      boat: {
        ...structuredClone(source),
        id: 'copy',
        seats: source.seats.map((seat) => ({ ...seat, rowerId: null })),
        coxswainId: null,
      },
    });
    expect(next.sessions[0].boats[1].seats.every((seat) => seat.rowerId === null)).toBe(true);
    expect(next.sessions[0].boats[1].coxswainId).toBeNull();
  });

  it('maps legacy imported availability statuses to unavailable', () => {
    const imported = {
      ...data(),
      rowers: [{ ...rower('legacy'), status: 'injured', group: 'Varsity' }],
    } as never;
    const normalized = normalizeImportedData(imported);
    expect(normalized.rowers[0].status).toBe('unavailable');
    expect('group' in normalized.rowers[0]).toBe(false);
  });

  it('seeds an empty roster with Stanford rowers', () => {
    const seeded = seedRoster({ version: 1, rowers: [], sessions: [] });
    expect(seeded.rowers).toHaveLength(39);
  });

  it('replaces sample rowers and clears their boat assignments', () => {
    const initial = data();
    initial.rowers = [rower('sample-rower-1'), rower('sample-cox-1')];
    initial.sessions[0].boats[0].seats[0].rowerId = 'sample-rower-1';
    initial.sessions[0].boats[0].coxswainId = 'sample-cox-1';
    const seeded = seedRoster(initial);
    expect(seeded.rowers).toHaveLength(39);
    expect(seeded.sessions[0].boats[0].seats[0].rowerId).toBeNull();
    expect(seeded.sessions[0].boats[0].coxswainId).toBeNull();
  });

  it('leaves a non-sample roster unchanged', () => {
    const initial = data();
    expect(seedRoster(initial)).toBe(initial);
  });

  it('renames every variant in a group', () => {
    const first = session([boat('first')]);
    const second = { ...session([boat('second')]), id: 'second', variant: 'Lineup B' };
    const initial = {
      ...data(),
      sessions: [
        { ...first, groupId: 'group' },
        { ...second, groupId: 'group' },
      ],
    };
    const next = reduce(initial, { type: 'RENAME_GROUP', groupId: 'group', label: 'PM' });
    expect(next.sessions.map((item) => item.label)).toEqual(['PM', 'PM']);
  });

  it('sets and clears boat private notes', () => {
    const initial = data();
    const set = reduce(initial, {
      type: 'SET_BOAT_PRIVATE_NOTES',
      sessionId: 'session',
      boatId: 'boat',
      coachId: 'coach',
      notes: 'Bring rigging cards',
    });
    expect(set.sessions[0].boats[0].privateNotes).toEqual({ coach: 'Bring rigging cards' });
    const cleared = reduce(set, {
      type: 'SET_BOAT_PRIVATE_NOTES',
      sessionId: 'session',
      boatId: 'boat',
      coachId: 'coach',
      notes: '',
    });
    expect(cleared.sessions[0].boats[0].privateNotes).toBeUndefined();
  });

  it('clears a seat', () => {
    const initial = data();
    initial.sessions[0].boats[0].seats[0].rowerId = 'a';
    const next = reduce(initial, {
      type: 'CLEAR_SEAT',
      sessionId: 'session',
      boatId: 'boat',
      seatNumber: 1,
    });
    expect(next.sessions[0].boats[0].seats[0].rowerId).toBeNull();
  });

  it('clears the cox', () => {
    const initial = data([boat('boat', '4+')]);
    initial.sessions[0].boats[0].coxswainId = 'a';
    const next = reduce(initial, {
      type: 'CLEAR_COX',
      sessionId: 'session',
      boatId: 'boat',
    });
    expect(next.sessions[0].boats[0].coxswainId).toBeNull();
  });

  it('clones sessions with fresh ids and no private notes', () => {
    const source = session([boat('boat')]);
    source.privateNotes = { coach: 'private' };
    source.boats[0].privateNotes = { coach: 'boat private' };
    const cloned = cloneSession(source);
    expect(cloned.id).not.toBe(source.id);
    expect(cloned.boats[0].id).not.toBe(source.boats[0].id);
    expect(cloned.privateNotes).toBeUndefined();
    expect(cloned.boats[0].privateNotes).toBeUndefined();
  });

  it('clones a dated lineup into a playground group as a playground lineup', () => {
    const cloned = cloneSession(session([boat('boat')]), {
      kind: 'playground',
      groupId: 'scratch',
      variant: 'Lineup B',
    });
    expect(cloned.kind).toBe('playground');
    expect(cloned.date).toBe('');
    expect(cloned.groupId).toBe('scratch');
    expect(cloned.boats).toHaveLength(1);
  });

  it('supports undo and redo history', () => {
    const initial = data();
    const changed = lineupReducer(
      { present: initial, past: [], future: [] },
      { type: 'CLEAR_SEAT', sessionId: 'session', boatId: 'boat', seatNumber: 1 },
    );
    const undone = lineupReducer(changed, { type: 'UNDO' });
    expect(undone.present).toEqual(initial);
    const redone = lineupReducer(undone, { type: 'REDO' });
    expect(redone.present).toEqual(changed.present);
  });
});

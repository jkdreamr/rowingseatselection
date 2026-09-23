import type { AppData, Boat, Coach, Rower, Session } from './types';

export const STORAGE_KEY = 'rowingseatselection:v1';
export const COACH_KEY = 'rowingseatselection:coach';
export const CLIPBOARD_KEY = 'rowingseatselection:clipboard';
export const STANFORD_COACHES = ['Ted Sobolewski', 'Niles Garratt', 'John Pojednic'] as const;

export interface StorageAdapter {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
}

export const emptyData = (): AppData => ({ version: 1, rowers: [], sessions: [] });

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidData(value: unknown): value is AppData {
  if (
    !isObject(value) ||
    value.version !== 1 ||
    !Array.isArray(value.rowers) ||
    !Array.isArray(value.sessions)
  ) {
    return false;
  }
  return (
    value.rowers.every(
      (rower) => isObject(rower) && typeof rower.id === 'string' && typeof rower.name === 'string',
    ) &&
    value.sessions.every(
      (session) =>
        isObject(session) && typeof session.id === 'string' && Array.isArray(session.boats),
    )
  );
}

/**
 * Fills in fields added after v1 shipped so older saves and imports load
 * cleanly: binary rower status, and per-session `groupId`/`variant`/`kind`.
 */
export function normalizeImportedData(data: AppData): AppData {
  return {
    ...data,
    rowers: data.rowers.map((rower) => {
      const { group: _legacyGroup, ...withoutGroup } = rower as Rower & { group?: unknown };
      return {
        ...withoutGroup,
        status: rower.status === 'available' ? 'available' : 'unavailable',
      };
    }),
    sessions: data.sessions.map((session) => ({
      ...session,
      groupId:
        typeof session.groupId === 'string' && session.groupId ? session.groupId : session.id,
      variant:
        typeof session.variant === 'string' && session.variant ? session.variant : 'Lineup A',
      kind: session.kind === 'playground' || !session.date ? 'playground' : 'session',
      date: session.kind === 'playground' ? '' : (session.date ?? ''),
      notes: typeof session.notes === 'string' ? session.notes : '',
      boats: session.boats.map((boat) => ({
        ...boat,
        notes: typeof boat.notes === 'string' ? boat.notes : '',
      })),
    })),
  };
}

export function seedRoster(data: AppData): AppData {
  const replacingSamples =
    data.rowers.length > 0 && data.rowers.every((rower) => rower.id.startsWith('sample-'));
  if (data.rowers.length > 0 && !replacingSamples) return data;

  return {
    ...data,
    rowers: stanfordRoster(),
    sessions: replacingSamples
      ? data.sessions.map((session) => ({
          ...session,
          boats: session.boats.map((boat) => ({
            ...boat,
            seats: boat.seats.map((seat) => ({
              ...seat,
              rowerId: seat.rowerId?.startsWith('sample-') ? null : seat.rowerId,
            })),
            coxswainId: boat.coxswainId?.startsWith('sample-') ? null : boat.coxswainId,
          })),
        }))
      : data.sessions,
  };
}

/** Copied lineup or boat, shared across tabs via localStorage. */
export type LineupClipboard =
  | { kind: 'session'; session: Session; copiedAt: string }
  | { kind: 'boat'; boat: Boat; copiedAt: string };

export function loadClipboard(): LineupClipboard | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CLIPBOARD_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed)) return null;
    if (parsed.kind === 'session' && isObject(parsed.session)) return parsed as LineupClipboard;
    if (parsed.kind === 'boat' && isObject(parsed.boat)) return parsed as LineupClipboard;
    return null;
  } catch {
    return null;
  }
}

export function saveClipboard(clipboard: LineupClipboard | null) {
  if (typeof window === 'undefined') return;
  if (clipboard) window.localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(clipboard));
  else window.localStorage.removeItem(CLIPBOARD_KEY);
}

export function loadCoach(): Coach | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(COACH_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isObject(parsed) && typeof parsed.id === 'string' && typeof parsed.name === 'string'
      ? { id: parsed.id, name: parsed.name }
      : null;
  } catch {
    return null;
  }
}

export function saveCoach(coach: Coach) {
  if (typeof window !== 'undefined') window.localStorage.setItem(COACH_KEY, JSON.stringify(coach));
}

export class LocalStorageAdapter implements StorageAdapter {
  async load(): Promise<AppData> {
    if (typeof window === 'undefined') return emptyData();
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return seedRoster(emptyData());
      const parsed: unknown = JSON.parse(raw);
      return isValidData(parsed)
        ? seedRoster(normalizeImportedData(parsed))
        : seedRoster(emptyData());
    } catch {
      return emptyData();
    }
  }

  async save(data: AppData) {
    if (typeof window !== 'undefined')
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

export function parseTwoK(value: string): number | undefined {
  const match = value.trim().match(/^(\d+):([0-5]\d)(?:\.(\d))?$/);
  if (!match) return undefined;
  return Number(match[1]) * 60 + Number(match[2]) + Number(`0.${match[3] ?? '0'}`);
}

export function exportFileName(date = new Date().toISOString().slice(0, 10)) {
  return `lineups-${date}.json`;
}

export function downloadJson(data: AppData, filename = exportFileName()) {
  if (typeof document === 'undefined') return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function stanfordRoster(): Rower[] {
  const names = [
    ['Kannan Alford', true],
    ['Marcus Albrecht', false],
    ['Zander Auth', false],
    ['Ginger Bernstein', true],
    ['Callen Berwick', false],
    ['Barron Celli', false],
    ['Tom Corbett', false],
    ['Elliott Donovan-Davies', false],
    ['Braun Endicott', false],
    ['Maxim Ericson', false],
    ['Augie Freijo', false],
    ['Jack Frye', false],
    ['Gabe George', false],
    ['Jack Griffin', false],
    ['Leo Hainlein', false],
    ['Ferdi Hainlein', false],
    ['Matteo Hanna-Amodio', false],
    ['Hylton Harvey', false],
    ['Theo Herzog', false],
    ['Josh Koo', true],
    ['Finn Lorgen', false],
    ['Tony Madigan', false],
    ['Chris Muehl', false],
    ['Tyler Murphy', false],
    ['Andrew Orio', false],
    ['Tom Pakulis', false],
    ['George Petrow', false],
    ['John Piersma', false],
    ['Dom Pucinelli', false],
    ['Kalen Routley', false],
    ['John Salvi', false],
    ['Sandro Scalfi', false],
    ['Raph Skottowe', false],
    ['Luke Smith', false],
    ['Danny Stephenson', false],
    ['Ody Tubidis', false],
    ['Charlie Vachris', false],
    ['Philip Wolfensberger', false],
    ['Gabrielle Zammit', true],
  ] as const;
  const now = new Date().toISOString();
  return names.map(([name, isCoxswain], index) => ({
    id: `stanford-rower-${index + 1}`,
    name,
    sidePreference: 'both' as const,
    isCoxswain,
    canCox: isCoxswain,
    status: 'available' as const,
    notes: '',
    createdAt: now,
    updatedAt: now,
  }));
}

export function validateImportedData(value: unknown): value is AppData {
  return isValidData(value);
}

export type SessionDraft = Pick<Session, 'date' | 'label'>;

import type { AppData, Rower, Session } from './types';

export const STORAGE_KEY = 'rowingseatselection:v1';

export interface StorageAdapter {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
}

export const emptyData = (): AppData => ({ version: 1, rowers: [], sessions: [] });

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidData(value: unknown): value is AppData {
  if (!isObject(value) || value.version !== 1 || !Array.isArray(value.rowers) || !Array.isArray(value.sessions)) {
    return false;
  }
  return value.rowers.every((rower) => isObject(rower) && typeof rower.id === 'string' && typeof rower.name === 'string')
    && value.sessions.every((session) => isObject(session) && typeof session.id === 'string' && Array.isArray(session.boats));
}

export class LocalStorageAdapter implements StorageAdapter {
  async load(): Promise<AppData> {
    if (typeof window === 'undefined') return emptyData();
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyData();
      const parsed: unknown = JSON.parse(raw);
      return isValidData(parsed) ? parsed : emptyData();
    } catch {
      return emptyData();
    }
  }

  async save(data: AppData) {
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

export function parseTwoK(value: string): number | undefined {
  const match = value.trim().match(/^(\d+):([0-5]\d)(?:\.(\d))?$/);
  if (!match) return undefined;
  return Number(match[1]) * 60 + Number(match[2]) + Number(`0.${match[3] ?? '0'}`);
}

export function formatTwoK(seconds?: number): string {
  if (seconds === undefined) return '';
  const minutes = Math.floor(seconds / 60);
  const remainder = (seconds % 60).toFixed(1).padStart(4, '0');
  return `${minutes}:${remainder}`;
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

export function sampleRowers(): Rower[] {
  const names = [
    ['Maya Chen', 'port', 'Varsity'], ['Sofia Martinez', 'starboard', 'Varsity'],
    ['Avery Brooks', 'both', 'Varsity'], ['Jordan Kim', 'port', 'Varsity'],
    ['Riley Thompson', 'starboard', 'Varsity'], ['Nora Patel', 'both', 'Varsity'],
    ['Quinn Davis', 'port', 'Novice'], ['Elena Rossi', 'starboard', 'Novice'],
    ['Grace Lee', 'scull', 'Lightweight'], ['Sam Wilson', 'both', 'Lightweight'],
    ['Taylor Nguyen', 'port', 'Novice'], ['Casey Brown', 'starboard', 'Novice'],
    ['Jamie Smith', 'both', 'Varsity'], ['Morgan Reed', 'port', 'Varsity'],
    ['Cameron Diaz', 'starboard', 'Novice'], ['Parker Jones', 'scull', 'Novice'],
  ] as const;
  const now = new Date().toISOString();
  return names.map(([name, sidePreference, group], index) => ({
    id: `sample-rower-${index + 1}`,
    name,
    sidePreference,
    isCoxswain: false,
    canCox: false,
    weightLbs: 135 + (index % 7) * 4,
    ergTwoKSeconds: 420 + (index % 6) * 5,
    group,
    status: 'available',
    notes: '',
    createdAt: now,
    updatedAt: now,
  }));
}

export function sampleCoxswains(): Rower[] {
  const now = new Date().toISOString();
  return ['Alex Morgan', 'Chris Taylor'].map((name, index) => ({
    id: `sample-cox-${index + 1}`,
    name,
    sidePreference: 'both' as const,
    isCoxswain: true,
    canCox: true,
    group: 'Coxswains',
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

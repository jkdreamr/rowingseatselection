'use client';

import { useRef, useState } from 'react';
import { useLineupStore } from '@/lib/store';
import { downloadJson, normalizeImportedData, validateImportedData } from '@/lib/storage';

export default function SettingsPage() {
  const { present, loaded, dispatch, coach, setCoachName } = useLineupStore();
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  if (!loaded)
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="card h-96 animate-pulse" />
      </main>
    );
  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-editorial">Settings</h1>
      <div className="mt-6 space-y-4">
        <section className="card p-5">
          <p className="label-caps">You</p>
          <h2 className="mt-2 text-lg font-semibold">Coach name</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Private notes are kept under this identity on this device. Shared sign-in comes later;
            your private notes will move with you.
          </p>
          <input
            value={coach.name}
            onChange={(event) => setCoachName(event.target.value)}
            placeholder="e.g. Coach Smith"
            className="focus-ring mt-4 w-full max-w-sm border border-line px-3 py-2 text-sm"
          />
        </section>
        <section className="card p-5">
          <p className="label-caps">Data portability</p>
          <h2 className="mt-2 text-lg font-semibold">Your data stays in this browser</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Export JSON for backup or move it to another device.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="button-primary px-4 py-2" onClick={() => downloadJson(present)}>
              Export JSON
            </button>
            <button
              className="button-secondary px-4 py-2"
              onClick={() => inputRef.current?.click()}
            >
              Import JSON
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  const parsed: unknown = JSON.parse(await file.text());
                  if (!validateImportedData(parsed)) throw new Error('Invalid lineup file');
                  if (window.confirm('Replace all current roster and sessions?')) {
                    dispatch({ type: 'INIT', data: normalizeImportedData(parsed) });
                    setMessage('Imported successfully.');
                  }
                } catch {
                  setMessage('Could not import that file.');
                }
                event.target.value = '';
              }}
            />
          </div>
          {message && <p className="mt-3 text-xs text-ink-soft">{message}</p>}
        </section>
        <section className="card p-5">
          <p className="label-caps">Danger zone</p>
          <h2 className="mt-2 text-lg font-semibold">Clear all data</h2>
          <p className="mt-2 text-sm text-ink-soft">
            This removes every rower and lineup from local storage.
          </p>
          <button
            className="button-secondary mt-4 px-4 py-2 text-cardinal"
            onClick={() => {
              if (
                window.confirm('Clear all data? This cannot be undone.') &&
                window.confirm(
                  'Really delete every rower and lineup? Export a backup first if unsure.',
                )
              ) {
                dispatch({ type: 'INIT', data: { version: 1, rowers: [], sessions: [] } });
              }
            }}
          >
            Clear all data
          </button>
        </section>
      </div>
    </main>
  );
}

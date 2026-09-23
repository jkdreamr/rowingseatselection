'use client';

import { useState } from 'react';
import { formatDate } from '@/lib/format';
import type { LineupClipboard } from '@/lib/storage';
import type { Action } from '@/lib/reducer';
import type { Coach, Session } from '@/lib/types';

interface Props {
  mode: 'session' | 'playground';
  session: Session;
  variants: Session[];
  rowerCount: number;
  coach: Coach;
  clipboard: LineupClipboard | null;
  dispatch: React.Dispatch<Action>;
  onDelete: () => void;
  onAddBoat: () => void;
  onSelectVariant: (session: Session) => void;
  onCreateAlternative: () => void;
  onCopyLineup: () => void;
  onPasteAlternative: () => void;
  onCopyToDay: (date: string, label: string) => void;
  copyFeedback?: string;
  pasteBoat?: () => void;
}

export function SessionHeader({
  mode,
  session,
  variants,
  rowerCount,
  coach,
  clipboard,
  dispatch,
  onDelete,
  onAddBoat,
  onSelectVariant,
  onCreateAlternative,
  onCopyLineup,
  onPasteAlternative,
  onCopyToDay,
  copyFeedback,
  pasteBoat,
}: Props) {
  const [editingVariant, setEditingVariant] = useState(false);
  const [copyDate, setCopyDate] = useState(new Date().toISOString().slice(0, 10));
  const [copyLabel, setCopyLabel] = useState(session.label);
  const [showCopyToDay, setShowCopyToDay] = useState(false);
  const privateNote = session.privateNotes?.[coach.id] ?? '';
  const [notesTab, setNotesTab] = useState<'public' | 'private'>('public');
  const updateNotes = (notes: string) => {
    if (notesTab === 'public') {
      dispatch({ type: 'UPDATE_SESSION', sessionId: session.id, patch: { notes } });
    } else {
      dispatch({
        type: 'SET_SESSION_PRIVATE_NOTES',
        sessionId: session.id,
        coachId: coach.id,
        notes,
      });
    }
  };
  const deleteLabel =
    variants.length > 1 ? `Delete ${session.variant}?` : `Delete ${session.label}?`;
  return (
    <>
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={session.label}
              onChange={(event) =>
                dispatch({
                  type: 'RENAME_GROUP',
                  groupId: session.groupId,
                  label: event.target.value,
                })
              }
              className="focus-ring min-w-0 max-w-[230px] bg-transparent text-xl font-semibold tracking-tight"
            />
            {variants.length > 1 && (
              <div className="flex items-center gap-1 border-b border-line">
                {variants.map((variant) => (
                  <span key={variant.id} className="relative">
                    {editingVariant && variant.id === session.id ? (
                      <input
                        autoFocus
                        value={variant.variant}
                        onChange={(event) =>
                          dispatch({
                            type: 'UPDATE_SESSION',
                            sessionId: variant.id,
                            patch: { variant: event.target.value },
                          })
                        }
                        onBlur={() => setEditingVariant(false)}
                        onKeyDown={(event) => event.key === 'Enter' && setEditingVariant(false)}
                        className="focus-ring w-24 border-b border-cardinal bg-paper px-2 py-1 text-xs"
                      />
                    ) : (
                      <button
                        className={`border-b-2 px-2 py-1 text-xs ${
                          variant.id === session.id
                            ? 'border-cardinal text-cardinal'
                            : 'border-transparent text-ink-muted'
                        }`}
                        onClick={() => onSelectVariant(variant)}
                        onDoubleClick={() => {
                          if (variant.id === session.id) setEditingVariant(true);
                        }}
                      >
                        {variant.variant}
                      </button>
                    )}
                  </span>
                ))}
                <button
                  className="button-secondary border-0 px-2 py-1 text-xs"
                  onClick={onCreateAlternative}
                >
                  +
                </button>
              </div>
            )}
            {variants.length === 1 && (
              <button className="button-secondary px-2 py-1 text-xs" onClick={onCreateAlternative}>
                + Alternative lineup
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            {mode === 'playground' ? 'Playground' : formatDate(session.date)} ·{' '}
            {session.boats.length} boats · {rowerCount} rowers seated
          </p>
          {variants.length > 1 && (
            <a
              className="mt-1 inline-block text-xs text-cardinal underline"
              href={`/compare?ids=${variants.map((item) => item.id).join(',')}`}
            >
              Compare lineups
            </a>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="button-secondary px-3 py-2" onClick={onCopyLineup}>
            Copy lineup
          </button>
          {clipboard?.kind === 'session' && (
            <button className="button-secondary px-3 py-2" onClick={onPasteAlternative}>
              Paste as alternative
            </button>
          )}
          {mode === 'playground' && (
            <div className="relative">
              <button
                className="button-secondary px-3 py-2"
                onClick={() => {
                  setCopyLabel(session.label);
                  setShowCopyToDay(!showCopyToDay);
                }}
              >
                Copy to a day…
              </button>
              {showCopyToDay && (
                <div className="absolute right-0 top-11 z-30 w-64 rounded-lg border border-line bg-paper p-3">
                  <input
                    type="date"
                    value={copyDate}
                    onChange={(event) => setCopyDate(event.target.value)}
                    className="focus-ring w-full rounded-lg border border-line px-2 py-1 text-xs"
                  />
                  <input
                    value={copyLabel}
                    onChange={(event) => setCopyLabel(event.target.value)}
                    className="focus-ring mt-2 w-full rounded-lg border border-line px-2 py-1 text-xs"
                  />
                  <button
                    className="button-primary mt-2 w-full px-3 py-2 text-xs"
                    onClick={() => {
                      onCopyToDay(copyDate, copyLabel);
                      setShowCopyToDay(false);
                    }}
                  >
                    Copy
                  </button>
                </div>
              )}
            </div>
          )}
          {pasteBoat && clipboard?.kind === 'boat' && (
            <button className="button-secondary px-3 py-2" onClick={pasteBoat}>
              Paste boat
            </button>
          )}
          <button
            className="button-secondary px-3 py-2"
            onClick={() => {
              if (window.confirm(deleteLabel)) {
                dispatch({ type: 'DELETE_SESSION', sessionId: session.id });
                onDelete();
              }
            }}
          >
            Delete
          </button>
          <button className="button-primary px-3 py-2" onClick={onAddBoat}>
            + Add boat
          </button>
        </div>
      </div>
      {copyFeedback && <p className="text-xs text-cardinal">{copyFeedback}</p>}
      <div className="card p-3">
        <div className="mb-2 flex gap-3">
          {(['public', 'private'] as const).map((tab) => (
            <button
              key={tab}
              className={`label-caps border-b-2 pb-1 ${
                notesTab === tab ? 'border-cardinal text-cardinal' : 'border-transparent'
              }`}
              onClick={() => setNotesTab(tab)}
            >
              {tab === 'public' ? 'Public' : 'Private'}
              {(tab === 'public' ? session.notes : privateNote) && (
                <span className="ml-1 text-cardinal">•</span>
              )}
            </button>
          ))}
        </div>
        <textarea
          value={notesTab === 'public' ? session.notes : privateNote}
          onChange={(event) => updateNotes(event.target.value)}
          rows={1}
          className="focus-ring w-full resize-none bg-transparent text-sm"
          placeholder={
            notesTab === 'private' ? 'Private notes (only you see these)' : 'Session notes'
          }
        />
        {notesTab === 'private' && !coach.name && (
          <p className="mt-1 text-[10px] text-ink-muted">
            Set your name in{' '}
            <a className="text-cardinal underline" href="/settings">
              Settings
            </a>{' '}
            so other coaches can tell notes apart later.
          </p>
        )}
      </div>
    </>
  );
}

'use client';

import { formatDate } from '@/lib/format';
import type { Session } from '@/lib/types';
import type { Action } from '@/lib/reducer';

interface Props {
  session: Session;
  rowerCount: number;
  dispatch: React.Dispatch<Action>;
  onDelete: () => void;
  onAddBoat: () => void;
}

export function SessionHeader({ session, rowerCount, dispatch, onDelete, onAddBoat }: Props) {
  return (
    <>
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <input
            value={session.label}
            onChange={(event) =>
              dispatch({
                type: 'UPDATE_SESSION',
                sessionId: session.id,
                patch: { label: event.target.value },
              })
            }
            className="focus-ring min-w-0 max-w-[230px] bg-transparent text-xl font-semibold tracking-tight"
          />
          <p className="mt-1 text-xs text-ink-muted">
            {formatDate(session.date)} · {session.boats.length} boats · {rowerCount} rowers seated
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="button-secondary px-3 py-2"
            onClick={() => {
              if (window.confirm(`Delete ${session.label}?`)) {
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
      <textarea
        value={session.notes}
        onChange={(event) =>
          dispatch({
            type: 'UPDATE_SESSION',
            sessionId: session.id,
            patch: { notes: event.target.value },
          })
        }
        onInput={(event) => {
          event.currentTarget.style.height = 'auto';
          event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
        }}
        rows={1}
        className="focus-ring card max-h-32 min-h-10 w-full resize-none overflow-hidden p-3 text-sm"
        placeholder="Session notes"
      />
    </>
  );
}

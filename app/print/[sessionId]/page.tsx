'use client';

import { useParams } from 'next/navigation';
import { useLineupStore } from '@/lib/store';
import { getBoatClass } from '@/lib/types';

export default function PrintPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { present, loaded } = useLineupStore();
  const session = present.sessions.find((item) => item.id === sessionId);
  if (!loaded) return <main className="p-8">Loading…</main>;
  if (!session) return <main className="p-8">Session not found.</main>;
  return (
    <main className="mx-auto max-w-4xl px-6 py-8 print:max-w-none print:px-0">
      <div className="mb-8 flex items-start justify-between print:mb-4">
        <div>
          <p className="text-sm font-semibold text-cardinal print:text-black">Stanford Rowing</p>
          <h1 className="mt-1 text-3xl font-semibold print:text-2xl">
            {session.label} · {session.date}
          </h1>
        </div>
        <button onClick={() => window.print()} className="button-primary px-4 py-2 print:hidden">
          Print
        </button>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {session.boats.map((boat) => (
          <section
            key={boat.id}
            className="rounded-xl border border-line p-4 print:break-inside-avoid print:border-black"
          >
            <div className="flex items-baseline justify-between border-b border-line pb-2 print:border-black">
              <h2 className="font-semibold">
                {boat.name}{' '}
                <span className="text-sm font-normal">
                  ({boat.classId} · {getBoatClass(boat.classId).label})
                </span>
              </h2>
              {getBoatClass(boat.classId).coxed && (
                <span className="text-xs text-ink-muted print:text-black">
                  {boat.coxPosition} cox
                </span>
              )}
            </div>
            {boat.coxswainId && (
              <p className="border-b border-line py-2 text-sm print:border-black">
                <strong>C:</strong>{' '}
                {present.rowers.find((rower) => rower.id === boat.coxswainId)?.name ?? '—'}
              </p>
            )}
            <ol className="divide-y divide-line print:divide-black">
              {boat.seats
                .slice()
                .sort((a, b) => b.number - a.number)
                .map((seat) => (
                  <li key={seat.number} className="flex justify-between py-2 text-sm">
                    <span>
                      <strong>{seat.number === 1 ? 'B' : seat.number}</strong>
                      {seat.side ? ` (${seat.side[0].toUpperCase()})` : ''}
                    </span>
                    <span>
                      {present.rowers.find((rower) => rower.id === seat.rowerId)?.name ?? '—'}
                    </span>
                  </li>
                ))}
            </ol>
            {boat.notes && (
              <p className="mt-3 text-xs">
                <strong>Notes:</strong> {boat.notes}
              </p>
            )}
          </section>
        ))}
      </div>
      {session.notes && (
        <p className="mt-6 text-sm">
          <strong>Session notes:</strong> {session.notes}
        </p>
      )}
      <style jsx global>{`
        @media print {
          header {
            display: none !important;
          }
        }
      `}</style>
    </main>
  );
}

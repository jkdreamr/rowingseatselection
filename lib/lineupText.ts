import { formatDate } from './format';
import type { Boat, Rower, Session } from './types';

export function sessionTitle(session: Session, variantCount = 1): string {
  const base =
    session.kind === 'playground'
      ? session.label
      : `${formatDate(session.date)} — ${session.label}`;
  return variantCount > 1 ? `${base} (${session.variant})` : base;
}

export function seatLabel(seatNumber: number): string {
  return seatNumber === 1 ? 'B' : String(seatNumber);
}

export function boatToLines(boat: Boat, rowers: Rower[]): string[] {
  const name = (id: string | null) => rowers.find((rower) => rower.id === id)?.name ?? '—';
  const lines = [`Boat ${boat.name} (${boat.classId})`];
  if (boat.coxswainId) lines.push(`C: ${name(boat.coxswainId)}`);
  boat.seats
    .slice()
    .sort((a, b) => b.number - a.number)
    .forEach((seat) => {
      lines.push(
        `${seatLabel(seat.number)} (${seat.side ? seat.side[0].toUpperCase() : '—'}): ${name(seat.rowerId)}`,
      );
    });
  return lines;
}

/** Plain-text lineup for clipboard / messaging. Public notes only. */
export function sessionToText(session: Session, rowers: Rower[], variantCount = 1): string {
  const lines = [sessionTitle(session, variantCount)];
  for (const boat of session.boats) {
    lines.push('', ...boatToLines(boat, rowers));
    if (boat.notes.trim()) lines.push(`Notes: ${boat.notes.trim()}`);
  }
  if (session.notes.trim()) lines.push('', `Session notes: ${session.notes.trim()}`);
  return lines.join('\n');
}

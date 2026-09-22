export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTwoK(seconds?: number): string {
  if (seconds === undefined) return '';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export function displayName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2 || name.length < 17) return name;
  return `${parts[parts.length - 1]} ${parts[0][0]}.`;
}

export function sideLetter(side: string): string {
  return side === 'starboard' ? 'S' : side === 'port' ? 'P' : side === 'scull' ? 'X' : 'B';
}

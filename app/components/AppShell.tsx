'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LineupStoreProvider } from '@/lib/store';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <LineupStoreProvider>
      <header className="sticky top-0 z-40 border-b border-line bg-paper">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/lineups"
            className="focus-ring flex items-center gap-2 text-sm font-semibold"
          >
            <span className="h-2.5 w-2.5 bg-cardinal" />
            <span>Stanford Rowing · Lineups</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            {[
              ['/lineups', 'Lineups'],
              ['/playground', 'Playground'],
              ['/compare', 'Compare'],
              ['/roster', 'Roster'],
              ['/settings', 'Settings'],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className={`focus-ring border-b-2 px-0.5 py-1 transition ${pathname.startsWith(href) ? 'border-cardinal text-cardinal' : 'border-transparent text-ink-soft hover:border-line-strong hover:text-ink'}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {children}
    </LineupStoreProvider>
  );
}

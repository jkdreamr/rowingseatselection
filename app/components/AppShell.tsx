'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LineupStoreProvider } from '@/lib/store';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <LineupStoreProvider>
      <header className="glass sticky top-0 z-40 border-b border-white/[.07]">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/lineups" className="focus-ring flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-coral text-sm font-bold text-white">SR</span>
            <span>
              <span className="block text-sm font-semibold tracking-tight">Lineup Builder</span>
              <span className="label-caps">Stanford Rowing</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1 rounded-full border border-white/[.08] bg-white/[.03] p-1 text-sm">
            {[['/lineups', 'Lineups'], ['/roster', 'Roster'], ['/settings', 'Settings']].map(([href, label]) => (
              <Link key={href} href={href} className={`focus-ring rounded-full px-3 py-1.5 transition ${pathname === href ? 'bg-coral text-white' : 'text-charcoal-soft hover:bg-white/[.06] hover:text-charcoal'}`}>
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

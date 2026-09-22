import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import AppShell from './components/AppShell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lineup Builder | Stanford Rowing',
  description: 'Build and share Stanford rowing boat lineups.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

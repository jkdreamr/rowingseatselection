'use client';

import { useMemo, useState } from 'react';
import { useLineupStore } from '@/lib/store';
import { parseTwoK } from '@/lib/storage';
import type { Rower, SidePreference, RowerStatus } from '@/lib/types';

const uid = () => `rower-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const now = () => new Date().toISOString();

export default function RosterPage() {
  const { present, loaded, dispatch } = useLineupStore();
  const [sort, setSort] = useState('name');
  const [quickNames, setQuickNames] = useState('');
  const [csv, setCsv] = useState('');
  const sorted = useMemo(() => [...present.rowers].sort((a, b) => {
    if (sort === 'weight') return (a.weightLbs ?? 0) - (b.weightLbs ?? 0);
    if (sort === 'side') return a.sidePreference.localeCompare(b.sidePreference);
    if (sort === '2k') return (a.ergTwoKSeconds ?? 9999) - (b.ergTwoKSeconds ?? 9999);
    return a.name.localeCompare(b.name);
  }), [present.rowers, sort]);
  if (!loaded) return <main className="mx-auto max-w-5xl px-4 py-10"><div className="card h-96 animate-pulse" /></main>;
  const addRower = (name: string, sidePreference: SidePreference = 'both') => dispatch({ type: 'ADD_ROWER', rower: { id: uid(), name: name.trim(), sidePreference, isCoxswain: false, canCox: false, status: 'available', createdAt: now(), updatedAt: now() } });
  return <main className="mx-auto max-w-[1500px] px-4 pb-24 pt-6 sm:px-6">
    <div className="mb-5"><p className="label-caps text-coral">People and preferences</p><h1 className="mt-1 text-3xl font-semibold tracking-editorial">Roster</h1><p className="mt-2 text-sm text-charcoal-soft">Keep the seat-planning details coaches need close at hand.</p></div>
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <aside className="space-y-4">
        <section className="card p-4"><p className="label-caps">Quick add</p><textarea value={quickNames} onChange={(event) => setQuickNames(event.target.value)} className="focus-ring mt-3 min-h-32 w-full rounded-lg border border-white/10 bg-black/20 p-3 text-sm" placeholder="One name per line" /><button className="focus-ring mt-2 w-full rounded-full bg-coral px-3 py-2 text-sm font-semibold" onClick={() => { quickNames.split('\n').map((name) => name.trim()).filter(Boolean).forEach((name) => addRower(name)); setQuickNames(''); }}>Add names</button></section>
        <section className="card p-4"><p className="label-caps">CSV import</p><p className="mt-2 text-xs text-charcoal-muted">name,side,weight,2k,group</p><textarea value={csv} onChange={(event) => setCsv(event.target.value)} className="focus-ring mt-3 min-h-32 w-full rounded-lg border border-white/10 bg-black/20 p-3 font-mono text-xs" placeholder="Maya Chen,port,140,7:10.2,Varsity" /><button className="focus-ring mt-2 w-full rounded-full border border-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/[.06]" onClick={() => { csv.split('\n').map((line) => line.split(',')).filter((cells) => cells[0]?.trim()).forEach(([name, side, weight, erg, group]) => dispatch({ type: 'ADD_ROWER', rower: { id: uid(), name: name.trim(), sidePreference: (['port', 'starboard', 'both', 'scull'].includes(side?.trim()) ? side.trim() : 'both') as SidePreference, isCoxswain: false, canCox: false, weightLbs: Number(weight) || undefined, ergTwoKSeconds: erg ? parseTwoK(erg) : undefined, group: group?.trim(), status: 'available', createdAt: now(), updatedAt: now() } })); setCsv(''); }}>Import CSV</button></section>
      </aside>
      <section className="card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.07] p-4"><div><span className="label-caps">Roster table</span><p className="mt-1 text-sm text-charcoal-soft">{sorted.length} rowers</p></div><select value={sort} onChange={(event) => setSort(event.target.value)} className="focus-ring rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs"><option value="name">Sort by name</option><option value="side">Sort by side</option><option value="weight">Sort by weight</option><option value="2k">Sort by 2k</option></select></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-white/[.025] text-[10px] uppercase tracking-[.12em] text-charcoal-muted"><tr><th className="px-4 py-3">Name</th><th className="px-3 py-3">Side</th><th className="px-3 py-3">Cox</th><th className="px-3 py-3">Weight</th><th className="px-3 py-3">2k</th><th className="px-3 py-3">Group</th><th className="px-3 py-3">Status</th><th className="px-3 py-3" /></tr></thead><tbody>{sorted.map((rower) => <RowerRow key={rower.id} rower={rower} dispatch={dispatch} />)}</tbody></table>{!sorted.length && <p className="p-12 text-center text-sm text-charcoal-muted">No rowers yet. Use quick add or load sample roster from Lineups.</p>}</div></section>
    </div>
  </main>;
}

function RowerRow({ rower, dispatch }: { rower: Rower; dispatch: ReturnType<typeof useLineupStore>['dispatch'] }) {
  const cell = (patch: Partial<Rower>, value: string | number | undefined) => dispatch({ type: 'UPDATE_ROWER', rowerId: rower.id, patch });
  return <tr className="border-t border-white/[.06]"><td className="px-4 py-2"><input value={rower.name} onChange={(event) => cell({ name: event.target.value }, event.target.value)} className="focus-ring w-40 rounded bg-transparent px-1 py-1 font-medium" /></td><td className="px-3 py-2"><select value={rower.sidePreference} onChange={(event) => cell({ sidePreference: event.target.value as SidePreference }, event.target.value)} className="focus-ring rounded bg-transparent py-1"><option value="port">Port</option><option value="starboard">Starboard</option><option value="both">Both</option><option value="scull">Scull</option></select></td><td className="px-3 py-2"><label className="flex items-center gap-1"><input type="checkbox" checked={rower.canCox} onChange={(event) => cell({ canCox: event.target.checked, isCoxswain: event.target.checked }, event.target.checked ? 1 : 0)} /> <span>yes</span></label></td><td className="px-3 py-2"><input type="number" value={rower.weightLbs ?? ''} onChange={(event) => cell({ weightLbs: Number(event.target.value) || undefined }, event.target.value)} className="focus-ring w-16 rounded bg-transparent px-1 py-1" /></td><td className="px-3 py-2"><input value={rower.ergTwoKSeconds ? `${Math.floor(rower.ergTwoKSeconds / 60)}:${(rower.ergTwoKSeconds % 60).toFixed(1).padStart(4, '0')}` : ''} onChange={(event) => cell({ ergTwoKSeconds: parseTwoK(event.target.value) }, event.target.value)} className="focus-ring w-20 rounded bg-transparent px-1 py-1" placeholder="7:10.2" /></td><td className="px-3 py-2"><input value={rower.group ?? ''} onChange={(event) => cell({ group: event.target.value }, event.target.value)} className="focus-ring w-24 rounded bg-transparent px-1 py-1" /></td><td className="px-3 py-2"><select value={rower.status} onChange={(event) => cell({ status: event.target.value as RowerStatus }, event.target.value)} className="focus-ring rounded bg-transparent py-1"><option value="available">Available</option><option value="limited">Limited</option><option value="injured">Injured</option><option value="sick">Sick</option><option value="away">Away</option></select></td><td className="px-3 py-2 text-right"><button onClick={() => { if (window.confirm(`Delete ${rower.name}?`)) dispatch({ type: 'DELETE_ROWER', rowerId: rower.id }); }} className="text-red-300 hover:text-red-200">Delete</button></td></tr>;
}

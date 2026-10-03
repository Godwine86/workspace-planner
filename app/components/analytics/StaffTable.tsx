'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StaffRow {
  id: string
  name: string
  role: string | null
  office: number
  remote: number
  leave: number
  other: number
  officePct: number
  otherPct: number
}

interface Props {
  rows: StaffRow[]
}

type SortKey = 'name' | 'office' | 'other' | 'remote' | 'leave' | 'officePct'

const COLS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'name', label: 'Name' },
  { key: 'office', label: 'Office', numeric: true },
  { key: 'other', label: 'Other site', numeric: true },
  { key: 'remote', label: 'Remote', numeric: true },
  { key: 'leave', label: 'Leave', numeric: true },
  { key: 'officePct', label: 'In-office share' },
]

export function StaffTable({ rows }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'office', dir: -1 })

  if (!rows.length) {
    return <div className="text-center text-sm text-ink-3 py-10">No staff data for this period.</div>
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sort.key], bv = b[sort.key]
    return (typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)) * sort.dir
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            {COLS.map(c => {
              const active = sort.key === c.key
              return (
                <th
                  key={c.key}
                  aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
                  className={cn('px-4 py-2.5 border-b border-line bg-[var(--panel-2)]', c.numeric ? 'text-right' : 'text-left')}
                >
                  <button
                    onClick={() => setSort(s => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : (c.numeric || c.key === 'officePct' ? -1 : 1) }))}
                    className={cn('inline-flex items-center gap-1 eyebrow hover:text-ink transition-colors', active && 'text-ink')}
                  >
                    {c.label}
                    {active && (sort.dir === 1 ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />)}
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map(row => (
            <tr key={row.id} className="transition-colors duration-150 hover:bg-[var(--panel-2)]">
              <td className="px-4 py-2.5 border-b border-line">
                <div className="font-medium text-ink">{row.name}</div>
                {row.role && <div className="text-[12px] text-ink-3">{row.role}</div>}
              </td>
              <td className="px-4 py-2.5 border-b border-line text-right font-mono tabular-nums font-semibold text-ink">{row.office}</td>
              <td className="px-4 py-2.5 border-b border-line text-right font-mono tabular-nums text-ink-2">{row.other || '—'}</td>
              <td className="px-4 py-2.5 border-b border-line text-right font-mono tabular-nums text-ink-2">{row.remote}</td>
              <td className="px-4 py-2.5 border-b border-line text-right font-mono tabular-nums text-ink-3">{row.leave || '—'}</td>
              <td className="px-4 py-2.5 border-b border-line min-w-[200px]">
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex h-2 rounded-full overflow-hidden gap-[2px] bg-[var(--panel-2)]" aria-hidden>
                    <div style={{ width: `${row.officePct}%`, background: 'var(--office)' }} />
                    {row.otherPct > 0 && <div style={{ width: `${row.otherPct}%`, background: 'var(--other)' }} />}
                  </div>
                  <span className="font-mono tabular-nums text-[12px] text-ink-2 w-20 text-right">
                    {row.officePct}%{row.otherPct > 0 && <span className="text-ink-3"> +{row.otherPct}</span>}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

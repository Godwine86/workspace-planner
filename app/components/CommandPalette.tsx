'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Search, Calendar, BarChart2, Clock, Settings, CalendarDays, User, SunMoon, CornerDownLeft } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmt, weekStart, todayDate } from '@/lib/schedule'

export interface PaletteStaff { id: string; name: string; role: string | null }

interface Item { id: string; label: string; hint?: string; group: string; icon: LucideIcon; run: () => void }

const MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

/** Jump to a page, a week, or a person. Mounted only while open (⌘K / Ctrl+K in TopNav). */
export function CommandPalette({ staff, isAdmin, onClose }: {
  staff: PaletteStaff[]
  isAdmin: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const items = useMemo<Item[]>(() => {
    const go = (href: string) => () => { onClose(); router.push(href) }
    const pages: Item[] = [
      { id: 'p-s', label: 'Schedule', group: 'Pages', icon: Calendar, run: go('/schedule') },
      { id: 'p-a', label: 'Analytics', group: 'Pages', icon: BarChart2, run: go('/analytics') },
      { id: 'p-h', label: 'History', group: 'Pages', icon: Clock, run: go('/history') },
      ...(isAdmin ? [{ id: 'p-x', label: 'Settings', group: 'Pages', icon: Settings, run: go('/settings') }] : []),
    ]
    const ws = weekStart(todayDate())
    const weeks: Item[] = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map(off => {
      const d = new Date(ws); d.setDate(d.getDate() + off * 7)
      const e = new Date(d); e.setDate(d.getDate() + 4)
      const rel = off === 0 ? 'This week' : off === 1 ? 'Next week' : off === -1 ? 'Last week' : off > 0 ? `In ${off} weeks` : `${-off} weeks ago`
      return {
        id: `w${off}`, group: 'Weeks', icon: CalendarDays, label: rel,
        hint: `${d.getDate()} ${MONTH[d.getMonth()]} – ${e.getDate()} ${MONTH[e.getMonth()]}`,
        run: go(`/schedule?week=${fmt(d)}`),
      }
    })
    const people: Item[] = staff.map(m => ({
      id: `s${m.id}`, group: 'People', icon: User, label: m.name, hint: m.role ?? undefined,
      run: go(`/schedule?focus=${encodeURIComponent(m.id)}`),
    }))
    const actions: Item[] = [{
      id: 'theme', group: 'Actions', icon: SunMoon, label: `Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`,
      run: () => { setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'); onClose() },
    }]
    return [...pages, ...weeks, ...people, ...actions]
  }, [staff, isAdmin, router, resolvedTheme, setTheme, onClose])

  const q = query.trim().toLowerCase()
  const results = q
    ? items.filter(i => `${i.label} ${i.hint ?? ''} ${i.group}`.toLowerCase().includes(q))
    : items.filter(i => i.group !== 'People').slice(0, 14)
  const activeIdx = Math.min(active, Math.max(0, results.length - 1))

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(activeIdx + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(activeIdx - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); results[activeIdx]?.run() }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  let lastGroup = ''
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onClose()} />
      <div className="relative w-full max-w-xl panel panel-glow bg-[var(--panel-solid)] overflow-hidden enter" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-3 px-4 h-14 border-b border-line">
          <Search size={18} className="text-ink-3" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={e => { setQuery(e.target.value); setActive(0) }}
            placeholder="Jump to a page, week or person…"
            className="flex-1 bg-transparent outline-none text-[15px] text-ink placeholder:text-ink-3"
            aria-label="Search"
            aria-controls="palette-list"
            aria-activedescendant={results[activeIdx] ? `pal-${results[activeIdx].id}` : undefined}
          />
          <span className="kbd">Esc</span>
        </div>
        <ul id="palette-list" ref={listRef} role="listbox" className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-8 text-center text-[13px] text-ink-3">No matches for “{query}”</li>}
          {results.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null
            lastGroup = it.group
            const Icon = it.icon
            return (
              <li key={it.id}>
                {header && <div className="eyebrow px-3 pt-3 pb-1.5">{header}</div>}
                <button
                  id={`pal-${it.id}`}
                  data-idx={i}
                  role="option"
                  aria-selected={i === activeIdx}
                  onMouseMove={() => setActive(i)}
                  onClick={it.run}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 h-10 rounded-lg text-left text-[13.5px] transition-colors duration-100',
                    i === activeIdx ? 'bg-accent-soft text-ink' : 'text-ink-2',
                  )}
                >
                  <Icon size={16} className={i === activeIdx ? 'text-accent' : 'text-ink-3'} aria-hidden />
                  <span className="flex-1 truncate">{it.label}</span>
                  {it.hint && <span className="text-[12px] text-ink-3 truncate max-w-[45%]">{it.hint}</span>}
                  {i === activeIdx && <CornerDownLeft size={14} className="text-ink-3" aria-hidden />}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

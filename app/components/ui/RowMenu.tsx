'use client'

import { useEffect, useRef, useState } from 'react'
import { Ellipsis } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface RowMenuItem { label: string; icon: LucideIcon; onSelect: () => void; danger?: boolean }

/** "⋯" menu for per-row actions, keeping destructive ones out of the main row. */
export function RowMenu({ items, label }: { items: RowMenuItem[]; label: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={() => setOpen(o => !o)} className="btn btn-sm btn-icon" aria-label={label} aria-haspopup="menu" aria-expanded={open}>
        <Ellipsis size={16} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-9 z-30 w-48 panel bg-[var(--panel-solid)] p-1.5 enter">
          {items.map((it, i) => {
            const Icon = it.icon
            return (
              <div key={it.label}>
                {it.danger && i > 0 && <div className="my-1 h-px bg-[var(--line)]" />}
                <button
                  role="menuitem"
                  onClick={() => { setOpen(false); it.onSelect() }}
                  className={cn(
                    'w-full flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-left text-[13px] transition-colors duration-100',
                    it.danger ? 'text-[var(--danger-fg)] hover:bg-[var(--danger-bg)]' : 'text-ink-2 hover:bg-[var(--panel-2)] hover:text-ink',
                  )}
                >
                  <Icon size={15} aria-hidden /> {it.label}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

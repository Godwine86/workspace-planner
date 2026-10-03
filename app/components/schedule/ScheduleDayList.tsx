'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getScheduleStatus, isLocked, fmt, todayDate, hasLeft } from '@/lib/schedule'
import type { EntryCache } from '@/lib/schedule'
import type { Staff, Group } from '@/types/database'
import { StatusChip } from '@/components/ui/StatusChip'
import { capacityState } from './ScheduleTable'

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const CAP_VAR = { ok: 'var(--cap-ok)', full: 'var(--cap-full)', over: 'var(--cap-over)' } as const

interface Props {
  staff: Staff[]
  groups: Group[]
  workDays: Date[]
  seatsFor: (day: Date) => number
  cache: EntryCache
  holidayMap: Record<string, string>
  canEdit: boolean
  onCycleStatus: (staffId: string, dateStr: string) => void
}

/** Phone layout: pick a day, then a vertical list of people for that day. */
export function ScheduleDayList({ staff, groups, workDays, seatsFor, cache, holidayMap, canEdit, onCycleStatus }: Props) {
  const today = todayDate()
  const initial = Math.max(0, workDays.findIndex(d => d.getTime() === today.getTime()))
  const [idx, setIdx] = useState(initial)
  const day = workDays[Math.min(idx, workDays.length - 1)]
  if (!day) return null
  const dateStr = fmt(day)
  const holName = holidayMap[dateStr]

  const byGroup = [...groups.map(g => ({ id: g.id, name: g.name, color: g.color })), { id: '__ug', name: 'Unassigned', color: '#8C95B5' }]
    .map(g => ({ ...g, members: staff.filter(m => (g.id === '__ug' ? !m.group_id || !groups.some(x => x.id === m.group_id) : m.group_id === g.id) && !hasLeft(m, dateStr)) }))
    .filter(g => g.members.length)

  return (
    <div className="enter">
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 snap-x" role="tablist" aria-label="Day">
        {workDays.map((d, i) => {
          const ds = fmt(d)
          const n = holidayMap[ds] ? 0 : staff.filter(m => getScheduleStatus(m, d, cache) === 'office').length
          const st = capacityState(n, seatsFor(d))
          const active = i === idx
          return (
            <button
              key={ds}
              role="tab"
              aria-selected={active}
              onClick={() => setIdx(i)}
              className={cn(
                'snap-start shrink-0 w-14 py-2 rounded-xl border text-center transition-colors duration-150',
                active ? 'border-transparent text-white' : 'border-line bg-[var(--panel)] text-ink-2',
              )}
              style={active ? { background: 'var(--brand-grad)' } : undefined}
            >
              <div className="text-[10.5px] font-semibold uppercase">{DAY[d.getDay()]}</div>
              <div className="font-display text-[17px] font-semibold leading-tight">{d.getDate()}</div>
              <div className="mx-auto mt-1 h-1 w-6 rounded-full" style={{ background: holidayMap[ds] ? 'var(--holiday-fg)' : CAP_VAR[st] }} />
            </button>
          )
        })}
      </div>

      {holName ? (
        <div className="panel p-6 text-center"><StatusChip status="holiday" /> <div className="mt-2 text-ink-2">{holName}</div></div>
      ) : (
        <div className="flex flex-col gap-3">
          {byGroup.map(g => (
            <section key={g.id} className="panel overflow-hidden">
              <h3 className="flex items-center gap-2 px-4 h-10 bg-[var(--panel-2)] border-b border-line font-display text-[13.5px] font-semibold">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: g.color }} />{g.name}
              </h3>
              <ul>
                {g.members.map(m => {
                  const st = getScheduleStatus(m, day, cache)
                  const locked = isLocked(m, day, cache, holidayMap)
                  return (
                    <li key={m.id} className="flex items-center gap-3 px-4 min-h-[52px] border-b border-line last:border-b-0">
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-medium text-ink truncate">{m.name}</div>
                        {m.role && <div className="text-[12px] text-ink-3 truncate">{m.role}</div>}
                      </div>
                      {locked && <Lock size={13} className="text-ink-3" aria-label="Locked" />}
                      <button
                        onClick={() => { if (canEdit && !locked) onCycleStatus(m.id, dateStr) }}
                        aria-disabled={!canEdit || locked}
                        className="min-h-[44px] flex items-center"
                        aria-label={`${m.name}: ${st ?? 'not set'}. Tap to change`}
                      >
                        <StatusChip key={st ?? 'none'} status={st} className="pop h-8 min-w-[96px]" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

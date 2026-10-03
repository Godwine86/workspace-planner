'use client'

import { useState } from 'react'
import { ChevronDown, CircleCheck, PencilLine, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmt, hasLeft, employedSince, orderStaffByGroup } from '@/lib/schedule'
import type { Staff, Group } from '@/types/database'
import type { Status } from '@/types/database'
import { StatusChip } from '@/components/ui/StatusChip'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu']
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const CAP_VAR = { ok: 'var(--cap-ok)', full: 'var(--cap-full)', over: 'var(--cap-over)' } as const

export interface WeekData {
  weekStart: string
  status: 'published' | 'draft'
  publishedAt: string | null
  /** Seats snapshotted at publish; null for drafts (use the current setting) */
  seats: number | null
  entries: { staff_id: string; entry_date: string; status: string }[]
}

interface Props {
  weeks: WeekData[]
  staff: Staff[]
  groups: Group[]
  seats: number
  holidayMap: Record<string, string>
}

function getStatus(
  staffId: string,
  dateStr: string,
  staff: Staff,
  entryMap: Record<string, string>,
): Status | null {
  if (hasLeft(staff, dateStr)) return null
  const raw = entryMap[`${staffId}__${dateStr}`]
  if (raw) return raw as Status
  if (staff.start_date && dateStr < staff.start_date) return null
  // History view uses pattern fallback (same as schedule — not analytics)
  const [y, mo, d] = dateStr.split('-').map(Number)
  const dow = new Date(y, mo - 1, d).getDay()
  return (staff.pattern?.[dow] as Status | null) ?? null
}

export function HistoryView({ weeks, staff, groups, seats, holidayMap }: Props) {
  // Most recent week starts expanded
  const [open, setOpen] = useState<Record<string, boolean>>(() => (weeks[0] ? { [weeks[0].weekStart]: true } : {}))

  if (!weeks.length) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="panel flex flex-col items-center gap-3 text-center p-10 max-w-md">
          <span className="grid place-items-center w-14 h-14 rounded-2xl bg-accent-soft text-accent"><History size={26} aria-hidden /></span>
          <div className="font-display text-[17px] font-semibold text-ink">No weeks yet</div>
          <div className="text-sm text-ink-2">Use <strong>Publish</strong> on the Schedule page to lock and archive a week.</div>
        </div>
      </div>
    )
  }

  const published = weeks.filter(w => w.status === 'published').length

  return (
    <div className="flex flex-col flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-5 sm:pb-8">
      <div className="mb-5">
        <span className="eyebrow">History</span>
        <h1 className="mt-1 font-display text-[24px] sm:text-[28px] font-semibold tracking-tight text-ink">Past weeks</h1>
        <p className="mt-1 text-[13px] text-ink-3">
          {weeks.length} week{weeks.length !== 1 ? 's' : ''} · {published} published (locked) · {weeks.length - published} draft (still editable)
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {weeks.map((week, wi) => {
          const ws = new Date(week.weekStart + 'T00:00:00')
          const workDates = Array.from({ length: 5 }, (_, i) => {
            const d = new Date(ws); d.setDate(ws.getDate() + i); return d
          })
          const we = new Date(ws); we.setDate(ws.getDate() + 4)
          const label = `${ws.getDate()} ${MONTH_NAMES[ws.getMonth()]} – ${we.getDate()} ${MONTH_NAMES[we.getMonth()]} ${we.getFullYear()}`

          const entryMap: Record<string, string> = {}
          week.entries.forEach(e => { entryMap[`${e.staff_id}__${e.entry_date}`] = e.status })

          const isPublished = week.status === 'published'
          const weekSeats = week.seats ?? seats
          // Anyone who left before this week started isn't listed; earlier weeks still show them
          const weekStaff = orderStaffByGroup(employedSince(staff, week.weekStart), groups)
          const pubDate = week.publishedAt
            ? new Date(week.publishedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
            : null

          const daily = workDates.map(d => {
            const dateStr = fmt(d)
            const hol = holidayMap[dateStr]
            const count = (s: Status) => hol ? 0 : weekStaff.filter(m => getStatus(m.id, dateStr, m, entryMap) === s).length
            const office = count('office')
            return { d, dateStr, hol, office, other: count('other'), state: office > weekSeats ? 'over' as const : office === weekSeats ? 'full' as const : 'ok' as const }
          })
          const workingDays = daily.filter(x => !x.hol)
          const util = workingDays.length && weekSeats ? Math.round(workingDays.reduce((a, x) => a + x.office, 0) / (workingDays.length * weekSeats) * 100) : 0
          const isOpen = !!open[week.weekStart]

          return (
            <section key={week.weekStart} className="panel overflow-hidden enter" style={{ animationDelay: `${Math.min(wi, 8) * 30}ms` }}>
              {/* Summary row */}
              <button
                onClick={() => setOpen(o => ({ ...o, [week.weekStart]: !o[week.weekStart] }))}
                aria-expanded={isOpen}
                className="w-full flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 text-left hover:bg-[var(--panel-2)] transition-colors duration-150"
              >
                <div className="flex items-center gap-3 min-w-[230px]">
                  <ChevronDown size={16} className={cn('text-ink-3 transition-transform duration-200', !isOpen && '-rotate-90')} aria-hidden />
                  <div>
                    <div className="font-display text-[16px] font-semibold text-ink">{label}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[12px] text-ink-3">
                      <span className={cn('inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-[11px] font-semibold', isPublished ? 'chip-office' : 'chip-leave')}>
                        {isPublished ? <CircleCheck size={11} aria-hidden /> : <PencilLine size={11} aria-hidden />}
                        {isPublished ? 'Published' : 'Draft'}
                      </span>
                      {pubDate && <span>{pubDate}</span>}
                    </div>
                  </div>
                </div>

                {/* Attendance strip */}
                <div className="flex items-end gap-1.5 flex-1 min-w-[260px]" aria-label="Seats used per day">
                  {daily.map(x => (
                    <div key={x.dateStr} className="flex-1 min-w-[44px] text-center">
                      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">{DAY_NAMES[x.d.getDay()]}</div>
                      {x.hol ? (
                        <div className="mt-1 text-[11px] font-semibold" style={{ color: 'var(--holiday-fg)' }}>Holiday</div>
                      ) : (
                        <>
                          <div className="mt-0.5 font-mono tabular-nums text-[12px]" style={{ color: x.state === 'ok' ? 'var(--ink-2)' : CAP_VAR[x.state] }}>
                            {x.office}<span className="text-ink-3">/{weekSeats}</span>
                          </div>
                          <div className="mt-1 h-1 rounded-full bg-[var(--panel-2)] overflow-hidden" aria-hidden>
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, x.office / Math.max(1, weekSeats) * 100)}%`, background: CAP_VAR[x.state] }} />
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <div className="text-right ml-auto">
                  <div className="font-display text-[22px] font-semibold leading-none tabular-nums text-ink">{util}%</div>
                  <div className="text-[11.5px] text-ink-3 mt-1">seat use</div>
                </div>
              </button>

              {/* Detail table */}
              {isOpen && (
                <div className="overflow-x-auto border-t border-line">
                  <table className="w-full border-separate border-spacing-0 text-[13px]">
                    <thead>
                      <tr>
                        <th className="px-5 py-2.5 text-left border-b border-line bg-[var(--panel-2)] min-w-[180px]"><span className="eyebrow">Team</span></th>
                        {workDates.map(d => (
                          <th key={fmt(d)} className="px-2 py-2.5 text-center border-b border-line bg-[var(--panel-2)] min-w-[100px]">
                            <span className="eyebrow">{DAY_NAMES[d.getDay()]} {d.getDate()}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {weekStaff.map(m => (
                        <tr key={m.id} className="hover:bg-[var(--panel-2)] transition-colors duration-150">
                          <td className="px-5 py-2 border-b border-line">
                            <span className="font-medium text-ink">{m.name}</span>
                            {m.role && <span className="ml-2 text-[12px] text-ink-3">{m.role}</span>}
                          </td>
                          {workDates.map(d => {
                            const dateStr = fmt(d)
                            const hol = holidayMap[dateStr]
                            const st = getStatus(m.id, dateStr, m, entryMap)
                            return (
                              <td key={dateStr} className="px-1 py-1.5 text-center border-b border-line">
                                {hol ? <StatusChip status="holiday" title={hol} className="opacity-80" />
                                  : st ? <StatusChip status={st} className="min-w-[84px]" />
                                  : <span className="text-ink-3">—</span>}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                      <tr className="bg-[var(--panel-2)]">
                        <td className="px-5 py-2.5 text-[12.5px] font-semibold text-ink-2">Other site</td>
                        {daily.map(x => (
                          <td key={x.dateStr} className="text-center py-2.5 font-mono tabular-nums text-[12.5px] text-ink-2">
                            {x.hol ? '—' : x.other || '—'}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

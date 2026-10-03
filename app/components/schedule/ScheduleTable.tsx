'use client'

import { Fragment } from 'react'
import type React from 'react'
import { ChevronDown, Lock, LockOpen, Building2, House } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getScheduleStatus, isLocked, fmt, todayDate, countsAsOffice, hasLeft } from '@/lib/schedule'
import { WORKDAYS_PER_WEEK } from '@/lib/utils'
import type { Staff, Group, Status } from '@/types/database'
import type { EntryCache } from '@/lib/schedule'
import { StatusChip, STATUS_HOTKEY } from '@/components/ui/StatusChip'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

interface Props {
  staff: Staff[]
  groups: Group[]
  workDays: Date[]
  /** Seat count for a given day (published weeks keep their own snapshot) */
  seatsFor: (day: Date) => number
  cache: EntryCache
  holidayMap: Record<string, string>
  collapsed: Record<string, boolean>
  canEdit: boolean
  view: 'week' | 'month'
  onToggleGroup: (gid: string) => void
  onCycleStatus: (staffId: string, dateStr: string) => void
  onSetStatus: (staffId: string, dateStr: string, status: Status | null) => void
  onToggleLock: (staffId: string, dateStr: string) => void
}

const HOTKEY_STATUS: Record<string, Status> = Object.fromEntries(
  Object.entries(STATUS_HOTKEY).map(([s, k]) => [k.toLowerCase(), s as Status])
)

/** Capacity state for a day: drives the header bar colour and its label. */
export function capacityState(n: number, seats: number): 'ok' | 'full' | 'over' {
  return n > seats ? 'over' : n === seats ? 'full' : 'ok'
}
const CAP_VAR = { ok: 'var(--cap-ok)', full: 'var(--cap-full)', over: 'var(--cap-over)' } as const

export function ScheduleTable({
  staff, groups, workDays, seatsFor, cache, holidayMap,
  collapsed, canEdit, view,
  onToggleGroup, onCycleStatus, onSetStatus, onToggleLock,
}: Props) {
  const today = todayDate()
  const wip = view === 'week' ? 1 : workDays.length / WORKDAYS_PER_WEEK
  const compact = view === 'month'

  // Build group → members map
  const gmap: Record<string, Staff[]> = {}
  groups.forEach(g => { gmap[g.id] = [] })
  gmap['__ug'] = []
  staff.forEach(m => {
    const gid = m.group_id ?? '__ug'
    ;(gmap[gid] ?? gmap['__ug']).push(m)
  })
  const order = [...groups.map(g => g.id), ...(gmap['__ug'].length ? ['__ug'] : [])]

  // Keyboard: arrows move between cells, O/R/L/X set a status, Delete clears to the
  // default pattern, K toggles the lock. Enter/Space cycle (native button click).
  function onGridKey(e: React.KeyboardEvent<HTMLTableElement>) {
    const el = e.target as HTMLElement
    const r = el.dataset.row, c = el.dataset.col
    if (r == null || c == null) return
    const row = Number(r), col = Number(c)
    const move: Record<string, [number, number]> = {
      ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
    }
    if (move[e.key]) {
      e.preventDefault()
      const [dr, dc] = move[e.key]
      const next = e.currentTarget.querySelector<HTMLElement>(`[data-row="${row + dr}"][data-col="${col + dc}"]`)
      next?.focus()
      return
    }
    if (!canEdit || e.metaKey || e.ctrlKey || e.altKey) return
    const staffId = el.dataset.staff!, dateStr = el.dataset.date!
    const key = e.key.toLowerCase()
    if (HOTKEY_STATUS[key]) { e.preventDefault(); onSetStatus(staffId, dateStr, HOTKEY_STATUS[key]) }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onSetStatus(staffId, dateStr, null) }
    else if (key === 'k') { e.preventDefault(); onToggleLock(staffId, dateStr) }
  }

  let rowIndex = 0

  return (
    <div className="panel overflow-hidden enter">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[13px]" onKeyDown={onGridKey}>
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 bg-[var(--panel-solid)] px-4 py-3 text-left border-b border-line min-w-[200px]">
                <span className="eyebrow">Team</span>
              </th>
              {workDays.map(day => {
                const key = fmt(day)
                const isToday = day.getTime() === today.getTime()
                const holName = holidayMap[key]
                const seats = seatsFor(day)
                const n = holName ? 0 : staff.filter(m => getScheduleStatus(m, day, cache) === 'office').length
                const state = capacityState(n, seats)
                const pct = seats > 0 ? Math.min(100, (n / seats) * 100) : 0
                return (
                  <th
                    key={key}
                    className={cn(
                      'px-2 pt-2.5 pb-2 text-center border-b border-line align-top bg-[var(--panel-solid)]',
                      compact ? 'min-w-[48px]' : 'min-w-[104px]',
                      isToday && 'bg-[color-mix(in_oklab,var(--panel-solid),var(--ring)_8%)]',
                    )}
                    aria-label={holName ? `${DAY_NAMES[day.getDay()]} ${day.getDate()}: holiday, ${holName}` : `${DAY_NAMES[day.getDay()]} ${day.getDate()}: ${n} of ${seats} seats`}
                  >
                    <div className={cn('text-[11px] font-semibold uppercase tracking-wider', isToday ? 'text-accent' : 'text-ink-3')}>
                      {DAY_NAMES[day.getDay()]}
                    </div>
                    <div className={cn('font-display font-semibold leading-tight', compact ? 'text-[14px]' : 'text-[17px]', isToday ? 'text-accent' : 'text-ink')}>
                      {day.getDate()}
                      {!compact && <span className="ml-1 text-[11px] font-medium text-ink-3">{MONTH_NAMES[day.getMonth()]}</span>}
                    </div>
                    {holName ? (
                      <div className="mt-1.5 mx-auto w-fit max-w-full truncate rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold chip-holiday" title={holName}>
                        {compact ? 'Hol' : holName}
                      </div>
                    ) : (
                      <div className="mt-1.5" title={`${n} of ${seats} seats${state === 'over' ? ' (over capacity)' : state === 'full' ? ' (full)' : ''}`}>
                        <div className="flex items-baseline justify-center font-mono tabular-nums text-[11.5px]" style={{ color: state === 'ok' ? 'var(--ink-2)' : CAP_VAR[state] }}>
                          <span className="font-semibold">{n}</span><span className="text-ink-3">/{seats}</span>
                          {state === 'over' && !compact && <span className="ml-1 text-[10px] font-semibold uppercase">Over</span>}
                        </div>
                        <div className="mt-1 h-1 rounded-full bg-[var(--panel-2)] overflow-hidden" aria-hidden>
                          <div
                            className="h-full rounded-full transition-[width] duration-300 ease-out"
                            style={{ width: `${pct}%`, background: CAP_VAR[state], boxShadow: state !== 'ok' ? `0 0 8px ${CAP_VAR[state]}` : undefined }}
                          />
                        </div>
                      </div>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {order.map(gid => {
              const members = gmap[gid] ?? []
              if (!members.length) return null
              const grp = groups.find(g => g.id === gid)
              const gname = grp?.name ?? 'Unassigned'
              const gcol  = grp?.color ?? '#8C95B5'
              const open  = !collapsed[gid]

              return (
                <Fragment key={gid}>
                  <tr>
                    <td colSpan={workDays.length + 1} className="p-0 border-b border-line bg-[var(--panel-2)]">
                      <button
                        onClick={() => onToggleGroup(gid)}
                        aria-expanded={open}
                        className="sticky left-0 flex items-center gap-2.5 px-4 h-10 text-left"
                      >
                        <ChevronDown size={15} className={cn('text-ink-3 transition-transform duration-200', !open && '-rotate-90')} aria-hidden />
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: gcol, boxShadow: `0 0 10px ${gcol}` }} />
                        <span className="font-display font-semibold text-[13.5px] text-ink">{gname}</span>
                        <span className="text-[12px] text-ink-3">{members.length} {members.length === 1 ? 'person' : 'people'}</span>
                      </button>
                    </td>
                  </tr>

                  {open && members.map(m => {
                    const row = rowIndex++
                    const actualOffice = workDays.filter(d => countsAsOffice(getScheduleStatus(m, d, cache))).length
                    const actualRemote = workDays.filter(d => getScheduleStatus(m, d, cache) === 'remote').length
                    const tgtOffice = m.tgt_office != null ? Math.round(m.tgt_office * wip) : null
                    const tgtRemote = m.tgt_remote != null ? Math.round(m.tgt_remote * wip) : null

                    return (
                      <tr key={m.id} className="group/row transition-colors duration-150 hover:bg-[var(--panel-2)]">
                        <td className="sticky left-0 z-10 bg-[var(--panel-solid)] group-hover/row:bg-[color-mix(in_oklab,var(--panel-solid),var(--ink)_3%)] border-b border-line px-4 py-2 min-w-[200px]">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-ink text-[13.5px] leading-tight truncate">{m.name}</span>
                            {m.end_date && <span className="text-[10.5px] text-ink-3 shrink-0">· last day {m.end_date}</span>}
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-[11.5px] text-ink-3">
                            {m.role && <span className="truncate max-w-[110px]">{m.role}</span>}
                            <TargetMeter icon="office" actual={actualOffice} target={tgtOffice} />
                            <TargetMeter icon="remote" actual={actualRemote} target={tgtRemote} />
                          </div>
                        </td>

                        {workDays.map((day, col) => {
                          const dateStr = fmt(day)
                          const holName = holidayMap[dateStr]
                          const isToday = day.getTime() === today.getTime()
                          const todayCls = isToday && 'bg-[color-mix(in_oklab,transparent,var(--ring)_6%)]'

                          if (hasLeft(m, dateStr)) {
                            return (
                              <td key={dateStr} className={cn('border-b border-line text-center text-[11px] text-ink-3', todayCls)} title={`Left after ${m.end_date}`}>
                                Left
                              </td>
                            )
                          }
                          if (holName) {
                            return (
                              <td key={dateStr} className={cn('border-b border-line text-center px-1', todayCls)}>
                                <StatusChip status="holiday" variant={compact ? 'icon' : 'full'} title={holName} className="opacity-80" />
                              </td>
                            )
                          }

                          const locked = isLocked(m, day, cache, holidayMap)
                          const st = getScheduleStatus(m, day, cache)
                          return (
                            <td key={dateStr} className={cn('border-b border-line text-center px-1 py-1.5', todayCls)}>
                              <div className="group/cell relative inline-flex">
                                <button
                                  data-row={row}
                                  data-col={col}
                                  data-staff={m.id}
                                  data-date={dateStr}
                                  aria-disabled={!canEdit || locked}
                                  onClick={() => { if (canEdit && !locked) onCycleStatus(m.id, dateStr) }}
                                  aria-label={`${m.name}, ${DAY_NAMES[day.getDay()]} ${day.getDate()}: ${st ?? 'not set'}${locked ? ', locked' : ''}`}
                                  className={cn(
                                    'rounded-[10px] transition-transform duration-150 ease-out',
                                    canEdit && !locked ? 'cursor-pointer hover:scale-[1.04] active:scale-95' : 'cursor-default',
                                  )}
                                >
                                  <StatusChip
                                    key={st ?? 'none'}
                                    status={st}
                                    variant={compact ? 'icon' : 'full'}
                                    className={cn('pop', compact ? '' : 'min-w-[84px] h-8', locked && 'border-dashed')}
                                  />
                                </button>
                                {/* Lock badge: always shown when locked; on hover (or always on touch) when editable */}
                                {(locked || canEdit) && (
                                  <button
                                    tabIndex={-1}
                                    disabled={!canEdit}
                                    onClick={() => onToggleLock(m.id, dateStr)}
                                    title={locked ? (canEdit ? 'Unlock this day (K)' : 'Locked') : 'Lock this day (K)'}
                                    aria-label={locked ? 'Unlock this day' : 'Lock this day'}
                                    className={cn(
                                      'absolute -top-1.5 -right-1.5 grid place-items-center w-[18px] h-[18px] rounded-full bg-[var(--panel-solid)] border transition-opacity duration-150',
                                      locked
                                        ? 'border-line-strong text-ink-2'
                                        : 'border-line text-ink-3 opacity-0 group-hover/cell:opacity-100 [@media(hover:none)]:opacity-60',
                                    )}
                                  >
                                    {locked ? <Lock size={10} strokeWidth={2.5} /> : <LockOpen size={10} strokeWidth={2.5} />}
                                  </button>
                                )}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TargetMeter({ icon, actual, target }: { icon: 'office' | 'remote'; actual: number; target: number | null }) {
  const Icon = icon === 'office' ? Building2 : House
  const off = target != null && actual !== target
  const color = target == null || !off ? undefined : actual > target ? 'var(--cap-over)' : 'var(--cap-full)'
  const label = `${icon === 'office' ? 'Office' : 'Remote'} ${actual}${target != null ? ` of ${target}` : ''} days`
  return (
    <span className="inline-flex items-center gap-1 font-mono tabular-nums" style={{ color }} title={label} aria-label={label}>
      <Icon size={12} aria-hidden />
      <span>{actual}{target != null && <span className="text-ink-3">/{target}</span>}</span>
    </span>
  )
}

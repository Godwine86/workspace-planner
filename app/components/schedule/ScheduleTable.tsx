'use client'

import { cn } from '@/lib/utils'
import { STATUS_META, getScheduleStatus, isLocked, fmt, todayDate } from '@/lib/schedule'
import { WORKDAYS_PER_WEEK } from '@/lib/utils'
import type { Staff, Group } from '@/types/database'
import type { Status } from '@/types/database'
import type { EntryCache } from '@/lib/schedule'
import type React from 'react'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

interface Props {
  staff: Staff[]
  groups: Group[]
  workDays: Date[]
  seats: number
  cache: EntryCache
  holidayMap: Record<string, string>
  collapsed: Record<string, boolean>
  canEdit: boolean
  view: 'week' | 'month'
  onToggleGroup: (gid: string) => void
  onCycleStatus: (staffId: string, dateStr: string) => void
  onToggleLock: (staffId: string, dateStr: string) => void
}

const STATUS_CELL_CLS: Record<Status, string> = {
  office: 'border text-[10px] font-semibold tracking-wide',
  remote: 'border text-[10px] font-semibold tracking-wide',
  leave:  'border text-[10px] font-semibold tracking-wide',
  other:  'border text-[10px] font-semibold tracking-wide',
}

const STATUS_CELL_STYLE: Record<Status, React.CSSProperties> = {
  office: { background: 'rgba(57,181,74,0.15)',  color: '#1a7a2a', borderColor: 'rgba(57,181,74,0.35)'  },
  remote: { background: 'rgba(41,171,226,0.15)', color: '#0f6fa0', borderColor: 'rgba(41,171,226,0.35)' },
  leave:  { background: 'rgba(148,163,184,0.12)', color: '#64748b', borderColor: 'rgba(148,163,184,0.3)' },
  other:  { background: 'rgba(247,148,29,0.15)',  color: '#b05a00', borderColor: 'rgba(247,148,29,0.35)'  },
}

export function ScheduleTable({
  staff, groups, workDays, seats, cache, holidayMap,
  collapsed, canEdit, view,
  onToggleGroup, onCycleStatus, onToggleLock,
}: Props) {
  const today = todayDate()
  const wip = view === 'week' ? 1 : workDays.length / WORKDAYS_PER_WEEK

  // Build group → members map
  const gmap: Record<string, Staff[]> = {}
  groups.forEach(g => { gmap[g.id] = [] })
  gmap['__ug'] = []
  staff.forEach(m => {
    const gid = m.group_id ?? '__ug'
    ;(gmap[gid] ?? gmap['__ug']).push(m)
  })
  const order = [...groups.map(g => g.id), ...(gmap['__ug'].length ? ['__ug'] : [])]

  return (
    <div className="overflow-x-auto rounded-xl border border-white/40 dark:border-white/5 glass shadow-sm" style={{ boxShadow: '0 2px 16px rgba(27,43,107,0.07)' }}>
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white/70 dark:bg-gray-900/70 backdrop-blur px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 border-b border-r border-gray-200/50 dark:border-gray-700/50 min-w-[160px]">
              Name &amp; targets
            </th>
            {workDays.map(day => {
              const key = fmt(day)
              const isToday = day.getTime() === today.getTime()
              const holName = holidayMap[key]
              return (
                <th
                  key={key}
                  className={cn(
                    'px-2 py-2 text-center text-[11px] font-medium border-b border-r border-gray-200/50 dark:border-gray-700/50 min-w-[58px] bg-white/50 dark:bg-transparent',
                    isToday
                      ? 'text-[var(--primary)] dark:text-blue-300'
                      : holName
                        ? 'text-[var(--pink)] dark:text-pink-400'
                        : 'text-gray-500 dark:text-gray-400'
                  )}
                >
                  <div>{DAY_NAMES[day.getDay()]}</div>
                  <div className="font-normal text-[10px]">
                    {day.getDate()} {MONTH_NAMES[day.getMonth()]}
                  </div>
                  {holName && (
                    <div className="text-[8px] font-semibold text-[var(--pink)] dark:text-pink-400 truncate max-w-[52px]">
                      {holName.length > 5 ? holName.slice(0, 4) + '…' : holName}
                    </div>
                  )}
                </th>
              )
            })}
            <th className="bg-white/50 dark:bg-transparent border-b border-gray-200/50 dark:border-gray-700/50 w-12" />
          </tr>
        </thead>
        <tbody>
          {order.map((gid, gIdx) => {
            const members = gmap[gid] ?? []
            if (!members.length) return null
            const grp = groups.find(g => g.id === gid)
            const gname = grp?.name ?? 'Unassigned'
            const gcol  = grp?.color ?? '#999'
            const open  = !collapsed[gid]

            return (
              <>
                {gIdx > 0 && (
                  <tr key={`spacer-${gid}`}>
                    <td colSpan={workDays.length + 2} className="h-2 bg-gray-100/40 dark:bg-white/[0.02]" />
                  </tr>
                )}

                {/* Group header row */}
                <tr key={`grp-${gid}`}>
                  <td
                    colSpan={workDays.length + 2}
                    className="px-4 py-2 bg-white/40 dark:bg-white/5 border-b border-gray-200/50 dark:border-gray-700/50 cursor-pointer select-none"
                    onClick={() => onToggleGroup(gid)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: gcol }} />
                      <span className="font-medium text-gray-800 dark:text-gray-200 text-[13px]">{gname}</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-[10px]">
                        {members.length} member{members.length !== 1 ? 's' : ''}
                      </span>
                      <span className="ml-auto text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
                    </div>
                  </td>
                </tr>

                {open && (
                  <>
                    {members.map(m => {
                      const actualOffice = workDays.filter(d => getScheduleStatus(m, d, cache) === 'office').length
                      const actualRemote = workDays.filter(d => getScheduleStatus(m, d, cache) === 'remote').length
                      const tgtOffice = m.tgt_office != null ? Math.round(m.tgt_office * wip) : null
                      const tgtRemote = m.tgt_remote != null ? Math.round(m.tgt_remote * wip) : null

                      return (
                        <tr key={m.id} className="border-b border-gray-100/60 dark:border-gray-800/50 hover:bg-white/40 dark:hover:bg-white/5 transition-colors duration-100">
                          {/* Name cell */}
                          <td className="sticky left-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-r border-gray-200/50 dark:border-gray-700/50 px-4 py-2 min-w-[160px]">
                            <div className="font-medium text-gray-900 dark:text-gray-100 text-[13px] leading-tight">{m.name}</div>
                            {m.role && <div className="text-[11px] text-gray-400 leading-tight">{m.role}</div>}
                            <div className="flex gap-1.5 mt-1 flex-wrap">
                              <TargetPill
                                label="🏢"
                                actual={actualOffice}
                                target={tgtOffice}
                              />
                              <TargetPill
                                label="🏠"
                                actual={actualRemote}
                                target={tgtRemote}
                              />
                            </div>
                          </td>

                          {/* Day cells */}
                          {workDays.map(day => {
                            const dateStr = fmt(day)
                            const holName = holidayMap[dateStr]
                            const isToday = day.getTime() === today.getTime()
                            const locked  = isLocked(m, day, cache, holidayMap)
                            const st      = getScheduleStatus(m, day, cache)

                            if (holName) {
                              return (
                                <td key={dateStr} className="px-1 py-1.5 text-center border-r border-gray-100 dark:border-gray-800" style={{ background: 'rgba(236,0,140,0.06)' }}>
                                  <span className="text-[9px] font-semibold text-[var(--pink)] dark:text-pink-400">
                                    {holName.length > 5 ? holName.slice(0, 4) + '…' : holName}
                                  </span>
                                </td>
                              )
                            }

                            return (
                              <td
                                key={dateStr}
                                className={cn(
                                  'px-1 py-1.5 text-center border-r border-gray-100 dark:border-gray-800',
                                  isToday && 'bg-blue-50/30 dark:bg-blue-950/10',
                                )}
                              >
                                <div className="flex flex-col items-center gap-0.5">
                                  <button
                                    disabled={!canEdit || locked}
                                    onClick={() => onCycleStatus(m.id, dateStr)}
                                    className={cn(
                                      'w-11 h-7 rounded border text-[10px] font-semibold tracking-wide transition-all duration-100',
                                      !st && 'border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600',
                                      locked && 'opacity-60 cursor-not-allowed border-dashed',
                                      !locked && canEdit && st && 'hover:opacity-80 cursor-pointer hover:scale-105',
                                      !canEdit && 'cursor-default',
                                    )}
                                    style={st ? STATUS_CELL_STYLE[st] : undefined}
                                    title={locked ? 'Locked' : (st ? STATUS_META[st].label : 'Not set')}
                                  >
                                    {st ? STATUS_META[st].short : '·'}
                                  </button>

                                  {canEdit && (
                                    <button
                                      onClick={() => onToggleLock(m.id, dateStr)}
                                      className="text-[10px] opacity-30 hover:opacity-80 transition-opacity leading-none"
                                      title={locked ? 'Unlock' : 'Lock'}
                                    >
                                      {locked ? '🔒' : '🔓'}
                                    </button>
                                  )}
                                </div>
                              </td>
                            )
                          })}

                          {/* Actions */}
                          <td className="px-1 py-1.5 text-center w-12" />
                        </tr>
                      )
                    })}

                    {/* Count row */}
                    <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/60">
                      <td className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 px-4 py-1.5 text-[10.5px] text-gray-400">
                        In office / seats
                      </td>
                      {workDays.map(day => {
                        const dateStr = fmt(day)
                        if (holidayMap[dateStr]) {
                          return (
                            <td key={dateStr} className="text-center border-r border-gray-100 dark:border-gray-800 text-[9px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 py-1">
                              Holiday
                            </td>
                          )
                        }
                        const n = members.filter(m => getScheduleStatus(m, day, cache) === 'office').length
                        return (
                          <td
                            key={dateStr}
                            className={cn(
                              'text-center border-r border-gray-100 dark:border-gray-800 text-[10px] font-medium py-1',
                              n > seats  ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950' :
                              n === seats ? 'text-amber-600 dark:text-amber-400' :
                                           'text-gray-500 dark:text-gray-400'
                            )}
                          >
                            {n}{n > seats ? '⚠' : ''}/{seats}
                          </td>
                        )
                      })}
                      <td className="w-12 border-r border-gray-100 dark:border-gray-800" />
                    </tr>
                  </>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TargetPill({ label, actual, target }: { label: string; actual: number; target: number | null }) {
  const over  = target != null && actual > target
  const under = target != null && actual < target
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium border',
      over  ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-400' :
      under ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-400' :
              'bg-gray-100 border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
    )}>
      {label} {actual}{target != null ? `/${target}d` : 'd'}
    </span>
  )
}

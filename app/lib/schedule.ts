import type { Staff, ScheduleEntry, Holiday } from '@/types/database'
import type { Status } from '@/types/database'
import { WORKDAYS_PER_WEEK, WORK_DOW } from './utils'

// ─── Constants ────────────────────────────────────────────────────────────────

export const CYCLE: (Status | null)[] = [null, 'office', 'remote', 'leave', 'other']

export const STATUS_META: Record<Status, { label: string; short: string }> = {
  office: { label: 'Office',    short: 'OFF' },
  remote: { label: 'Remote',    short: 'REM' },
  leave:  { label: 'Off/Leave', short: 'LVE' },
  other:  { label: 'Other',     short: 'OTH' },
}

// ─── Cache key ────────────────────────────────────────────────────────────────

export function entryKey(staffId: string, date: Date): string {
  return `${staffId}__${fmt(date)}`
}

export function fmt(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ─── Entry cache type ─────────────────────────────────────────────────────────

export type EntryCache = Record<string, { status: Status; is_locked: boolean }>

export function buildEntryCache(rows: Pick<ScheduleEntry, 'staff_id' | 'entry_date' | 'status' | 'is_locked'>[]): EntryCache {
  const cache: EntryCache = {}
  for (const r of rows) {
    // Parse date as local to avoid UTC shift
    const [y, mo, d] = r.entry_date.split('-').map(Number)
    const date = new Date(y, mo - 1, d)
    cache[entryKey(r.staff_id, date)] = { status: r.status as Status, is_locked: !!r.is_locked }
  }
  return cache
}

// ─── Status resolution ────────────────────────────────────────────────────────

/** Schedule view: DB entry → pattern fallback → null */
export function getScheduleStatus(
  staff: Staff,
  date: Date,
  cache: EntryCache,
): Status | null {
  const entry = cache[entryKey(staff.id, date)]
  if (entry) return entry.status
  return (staff.pattern?.[date.getDay()] as Status | undefined) ?? null
}

/** Analytics view: DB entry only — never pattern fallback */
export function getAnalyticsStatus(
  staff: Staff,
  date: Date,
  cache: EntryCache,
): Status | null {
  return cache[entryKey(staff.id, date)]?.status ?? null
}

export function isLocked(
  staff: Staff,
  date: Date,
  cache: EntryCache,
  holidayMap: Record<string, string>,
): boolean {
  if (holidayMap[fmt(date)]) return true
  return !!cache[entryKey(staff.id, date)]?.is_locked
}

export function nextCycleStatus(current: Status | null): Status | null {
  const idx = CYCLE.indexOf(current)
  return CYCLE[(idx + 1) % CYCLE.length]
}

/** Fairness accounting: working from another office still counts as "in office", not remote. */
export function countsAsOffice(status: Status | null): boolean {
  return status === 'office' || status === 'other'
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function todayDate(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function weekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - d.getDay()) // back to Sunday
  return d
}

export function weekDays(date: Date): Date[] {
  const start = weekStart(date)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d
  })
}

export function monthDays(date: Date): Date[] {
  const days: Date[] = []
  const cursor = new Date(date.getFullYear(), date.getMonth(), 1)
  while (cursor.getMonth() === date.getMonth()) {
    days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

export function getViewDays(view: 'week' | 'month', navDate: Date): Date[] {
  return view === 'week' ? weekDays(navDate) : monthDays(navDate)
}

export function getWorkDays(view: 'week' | 'month', navDate: Date): Date[] {
  return getViewDays(view, navDate).filter(d => WORK_DOW.includes(d.getDay()))
}

export function periodLabel(view: 'week' | 'month', navDate: Date): string {
  if (view === 'month') {
    return navDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }
  const days = weekDays(navDate)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${days[0].toLocaleDateString('en-US', opts)} – ${days[6].toLocaleDateString('en-US', opts)}, ${days[0].getFullYear()}`
}

// ─── Reshuffle ────────────────────────────────────────────────────────────────

export interface ReshuffleChange {
  staff_id: string
  entry_date: string
  action: 'upsert' | 'delete'
  status?: Status
}

/**
 * Fair weekly rotation:
 * For each work day, score unlocked candidates by (targetRatio - weeklyOfficeCount/WORKDAYS_PER_WEEK).
 * Highest scorers get office slots up to seat capacity.
 * No cross-week debt — purely in-week fairness.
 */
export function computeReshuffle(
  staff: Staff[],
  workDays: Date[],
  seats: number,
  cache: EntryCache,
  holidayMap: Record<string, string>,
): { changes: ReshuffleChange[]; updatedCache: EntryCache } {
  const weekOff: Record<string, number> = {}
  staff.forEach(m => {
    weekOff[m.id] = workDays.filter(day =>
      isLocked(m, day, cache, holidayMap) &&
      countsAsOffice(getScheduleStatus(m, day, cache))
    ).length
  })

  const changes: ReshuffleChange[] = []
  const updatedCache = { ...cache }

  workDays.forEach(day => {
    const dayFmt = fmt(day)
    const dow = day.getDay()

    if (holidayMap[dayFmt]) return

    const candidates = staff.filter(m => {
      if (isLocked(m, day, cache, holidayMap)) return false
      const cached = cache[entryKey(m.id, day)]
      if (cached && (cached.status === 'leave' || cached.status === 'other')) return false
      if (!cached) {
        const pat = (m.pattern?.[dow] as Status | null) ?? null
        if (!pat || pat === 'leave' || pat === 'other') return false
      }
      return true
    })

    if (!candidates.length) return

    const lockedOffice = staff.filter(m =>
      isLocked(m, day, cache, holidayMap) &&
      getScheduleStatus(m, day, cache) === 'office'
    ).length
    const slots = Math.min(Math.max(0, seats - lockedOffice), candidates.length)

    const scored = candidates
      .map(m => {
        const tO = m.tgt_office ?? 0
        const tR = m.tgt_remote ?? 0
        const tot = tO + tR
        const targetRatio = tot > 0 ? tO / tot : 0.5
        return { m, score: targetRatio - (weekOff[m.id] ?? 0) / WORKDAYS_PER_WEEK }
      })
      .sort((a, b) => b.score - a.score)

    scored.forEach(({ m }, i) => {
      const status: Status = i < slots ? 'office' : 'remote'
      if (status === 'office') weekOff[m.id] = (weekOff[m.id] ?? 0) + 1

      const patternDefault = (m.pattern?.[dow] as Status | null) ?? null
      const k = entryKey(m.id, day)

      if (status === patternDefault) {
        changes.push({ staff_id: m.id, entry_date: dayFmt, action: 'delete' })
        delete updatedCache[k]
      } else {
        changes.push({ staff_id: m.id, entry_date: dayFmt, action: 'upsert', status })
        updatedCache[k] = { status, is_locked: false }
      }
    })
  })

  return { changes, updatedCache }
}

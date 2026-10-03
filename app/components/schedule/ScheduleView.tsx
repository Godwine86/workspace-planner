'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Shuffle, Download, Pin, PinOff, Keyboard, CircleCheck, PencilLine } from 'lucide-react'
import * as XLSX from 'xlsx-js-style'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Staff, Group, Role } from '@/types/database'
import type { Status } from '@/types/database'
import {
  buildEntryCache, getScheduleStatus, isLocked, nextCycleStatus,
  fmt, weekStart, getWorkDays, periodLabel, computeReshuffle,
  todayDate, entryKey, orderStaffByGroup, hasLeft, employedSince,
} from '@/lib/schedule'
import type { EntryCache } from '@/lib/schedule'
import type { SyncState } from './SyncBadge'
import { SyncBadge } from './SyncBadge'
import { KPIRow } from './KPIRow'
import { ScheduleTable } from './ScheduleTable'
import { ScheduleDayList } from './ScheduleDayList'

interface Props {
  staff: Staff[]
  groups: Group[]
  seats: number
  weekPlans: Record<string, { status: string; seats: number | null }>
  holidayMap: Record<string, string>
  role: Role
}

const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Qiddiya-themed cell styles for the weekly schedule export
const STATUS_XLSX: Record<Status | 'holiday', { label: string; fill: string; font: string }> = {
  office:  { label: 'Office',    fill: 'D9F2DD', font: '1A7A2A' },
  remote:  { label: 'Remote',    fill: 'D6F0FA', font: '0F6FA0' },
  leave:   { label: 'Off/Leave', fill: 'FFF3CD', font: '9C6500' },
  other:   { label: 'Other',     fill: 'FDEBD3', font: 'B05A00' },
  holiday: { label: 'Holiday',   fill: 'FBDCEF', font: 'A3006B' },
}

export function ScheduleView({ staff, groups, seats: initialSeats, weekPlans: initialWeekPlans, holidayMap, role }: Props) {
  const canEdit = role === 'admin' || role === 'editor'

  const params = useSearchParams()
  const [view, setView]       = useState<'week' | 'month'>('week')
  // ?week=YYYY-MM-DD (from the command palette) opens that week
  const [navDate, setNavDate] = useState(() => {
    const w = params.get('week')
    if (w && /^\d{4}-\d{2}-\d{2}$/.test(w)) { const [y, m, d] = w.split('-').map(Number); return new Date(y, m - 1, d) }
    return todayDate()
  })
  const [showKeys, setShowKeys] = useState(false)
  const [cache, setCache]     = useState<EntryCache>({})
  const [weekPlans, setWeekPlans] = useState(initialWeekPlans)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [sync, setSyncState]  = useState<{ state: SyncState; msg: string }>({ state: 'idle', msg: 'All changes save automatically' })
  const [, startTransition]   = useTransition()

  const supabase = createClient()

  const workDays = getWorkDays(view, navDate)
  // Same order for the table and its export: by group, then each person's position within it.
  // People who left before this period aren't shown.
  const orderedStaff = orderStaffByGroup(employedSince(staff, fmt(workDays[0] ?? navDate)), groups)

  // Published weeks keep the seat count they were published with; drafts use the current setting
  const seatsFor = (day: Date) => weekPlans[fmt(weekStart(day))]?.seats ?? initialSeats

  function setSync(state: SyncState, msg: string) {
    setSyncState({ state, msg })
  }

  // ─── Load entries for current period ─────────────────────────────────────

  const loadEntries = useCallback(async (v: 'week' | 'month', nd: Date) => {
    const days = getWorkDays(v, nd)
    if (!days.length) return
    const from = fmt(days[0])
    const to   = fmt(days[days.length - 1])

    const { data, error } = await supabase
      .from('schedule_entries')
      .select('staff_id,entry_date,status,is_locked')
      .gte('entry_date', from)
      .lte('entry_date', to)

    if (error) {
      setSync('error', 'Failed to load schedule: ' + error.message)
      return
    }
    setCache(buildEntryCache(data ?? []))
    setSync('ok', 'All changes save automatically')
  }, [])

  useEffect(() => { loadEntries(view, navDate) }, [view, navDate, loadEntries])

  // ?focus=<staffId> (from the command palette) scrolls to that person's first day
  const focusId = params.get('focus')
  useEffect(() => {
    if (!focusId) return
    const cell = document.querySelector<HTMLElement>(`[data-staff="${CSS.escape(focusId)}"]`)
    cell?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    cell?.focus({ preventScroll: true })
  }, [focusId])

  // ─── Navigation ──────────────────────────────────────────────────────────

  function navigate(dir: -1 | 1) {
    setNavDate(prev => {
      const d = new Date(prev)
      if (view === 'week') d.setDate(d.getDate() + dir * 7)
      else d.setMonth(d.getMonth() + dir)
      return d
    })
  }

  function switchView(v: 'week' | 'month') {
    setView(v)
    startTransition(() => { loadEntries(v, navDate) })
  }

  // ─── Week publish ─────────────────────────────────────────────────────────

  const weekKey = fmt(weekStart(navDate))
  const isPublished = weekPlans[weekKey]?.status === 'published'

  async function togglePublish() {
    if (!canEdit) return
    if (isPublished) {
      if (!confirm('Unpublish this week?\n\nThe schedule will be editable and reshuffleable again.')) return
      setSync('syncing', 'Unpublishing…')
      const { error } = await supabase.from('week_plans')
        .update({ status: 'draft', published_by: null, published_at: null })
        .eq('week_start', weekKey)
      if (error) { setSync('error', 'Failed: ' + error.message); return }
      setWeekPlans(p => ({ ...p, [weekKey]: { status: 'draft', seats: null } }))
      setSync('ok', 'Week unpublished — schedule is editable again')
    } else {
      if (!confirm('Publish this week?\n\nThe schedule will be locked. You can unpublish it later if needed.')) return
      setSync('syncing', 'Publishing…')
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('week_plans')
        .upsert({ week_start: weekKey, status: 'published', published_by: user?.id, published_at: new Date().toISOString() }, { onConflict: 'week_start' })
      if (error) { setSync('error', 'Failed: ' + error.message); return }
      setWeekPlans(p => ({ ...p, [weekKey]: { status: 'published', seats: initialSeats } }))
      setSync('ok', 'Week published and locked')
    }
  }

  // ─── Cycle status ─────────────────────────────────────────────────────────

  function handleCycleStatus(staffId: string, dateStr: string) {
    const [y, mo, d] = dateStr.split('-').map(Number)
    const m = staff.find(x => x.id === staffId)
    if (!m) return
    handleSetStatus(staffId, dateStr, nextCycleStatus(getScheduleStatus(m, new Date(y, mo - 1, d), cache)))
  }

  /** Set a day to `next`; null (or the person's default pattern) clears the override. */
  async function handleSetStatus(staffId: string, dateStr: string, next: Status | null) {
    if (!canEdit) return
    const [y, mo, d] = dateStr.split('-').map(Number)
    const day = new Date(y, mo - 1, d)
    const m = staff.find(x => x.id === staffId)
    if (!m || isLocked(m, day, cache, holidayMap) || hasLeft(m, dateStr)) return

    const patDefault = (m.pattern?.[day.getDay()] as Status | null) ?? null
    const k = entryKey(staffId, day)

    // Optimistic update
    setCache(prev => {
      const next2 = { ...prev }
      if (next === null || next === patDefault) delete next2[k]
      else next2[k] = { status: next as Status, is_locked: false }
      return next2
    })

    setSync('syncing', 'Saving…')
    try {
      if (next === null || next === patDefault) {
        await supabase.from('schedule_entries').delete()
          .eq('staff_id', staffId).eq('entry_date', dateStr)
      } else {
        await supabase.from('schedule_entries')
          .upsert({ staff_id: staffId, entry_date: dateStr, status: next, is_locked: false }, { onConflict: 'staff_id,entry_date' })
      }
      setSync('ok', 'Saved ' + new Date().toLocaleTimeString())
    } catch (err: unknown) {
      setSync('error', 'Save failed: ' + (err instanceof Error ? err.message : String(err)))
      // Reload to restore consistent state
      loadEntries(view, navDate)
    }
  }

  // ─── Toggle lock ──────────────────────────────────────────────────────────

  async function handleToggleLock(staffId: string, dateStr: string) {
    if (!canEdit) return
    const [y, mo, d] = dateStr.split('-').map(Number)
    const day = new Date(y, mo - 1, d)
    const m = staff.find(x => x.id === staffId)
    if (!m || hasLeft(m, dateStr)) return

    const cur = getScheduleStatus(m, day, cache)
    const wasLocked = isLocked(m, day, cache, holidayMap)
    const newLocked = !wasLocked
    const status: Status = cur ?? (m.pattern?.[day.getDay()] as Status | null) ?? 'office'
    const k = entryKey(staffId, day)

    setCache(prev => ({ ...prev, [k]: { status, is_locked: newLocked } }))
    setSync('syncing', 'Saving lock…')

    const { data: { user } } = await supabase.auth.getUser()
    try {
      await supabase.from('schedule_entries')
        .upsert({
          staff_id: staffId, entry_date: dateStr, status, is_locked: newLocked,
          locked_by: newLocked ? user?.id : null,
        }, { onConflict: 'staff_id,entry_date' })
      setSync('ok', newLocked ? 'Day locked' : 'Day unlocked')
    } catch (err: unknown) {
      setSync('error', 'Lock failed: ' + (err instanceof Error ? err.message : String(err)))
      loadEntries(view, navDate)
    }
  }

  // ─── Reshuffle ────────────────────────────────────────────────────────────

  async function handleReshuffle() {
    if (!canEdit) return
    if (isPublished) {
      alert('This week is published.\n\nUnpublish it first if you want to reshuffle.')
      return
    }
    if (!confirm('Reshuffle this week based on targets?\n\nLocked days will not be changed.')) return

    setSync('syncing', 'Reshuffling…')
    const { changes, updatedCache } = computeReshuffle(staff, workDays, initialSeats, cache, holidayMap)
    setCache(updatedCache)

    try {
      const upserts = changes.filter(c => c.action === 'upsert')
      const deletes = changes.filter(c => c.action === 'delete')

      if (upserts.length) {
        await supabase.from('schedule_entries')
          .upsert(upserts.map(c => ({ staff_id: c.staff_id, entry_date: c.entry_date, status: c.status!, is_locked: false })), { onConflict: 'staff_id,entry_date' })
      }
      for (const d of deletes) {
        await supabase.from('schedule_entries').delete()
          .eq('staff_id', d.staff_id).eq('entry_date', d.entry_date)
      }
      setSync('ok', 'Reshuffled & saved')
    } catch (err: unknown) {
      setSync('error', 'Reshuffle failed: ' + (err instanceof Error ? err.message : String(err)))
      loadEntries(view, navDate)
    }
  }

  // ─── Group collapse ───────────────────────────────────────────────────────

  function toggleGroup(gid: string) {
    setCollapsed(prev => ({ ...prev, [gid]: !prev[gid] }))
  }

  // ─── Export weekly schedule ───────────────────────────────────────────────

  function exportSchedule() {
    const ws0 = weekStart(navDate)
    const days = getWorkDays('week', ws0)
    const rows = employedSince(orderedStaff, fmt(ws0))

    const header = ['Staff', 'Office', 'Remote', ...days.map(d => FULL_DAY_NAMES[d.getDay()])]
    const aoa: unknown[][] = [header]

    rows.forEach(m => {
      const dayStatuses = days.map(d => {
        const dateStr = fmt(d)
        if (holidayMap[dateStr]) return 'holiday' as const
        return getScheduleStatus(m, d, cache)
      })
      const officeCount = dayStatuses.filter(s => s === 'office' || s === 'other').length
      const remoteCount = dayStatuses.filter(s => s === 'remote').length
      aoa.push([
        m.name, officeCount, remoteCount,
        ...dayStatuses.map(s => s ? STATUS_XLSX[s].label : ''),
      ])
    })

    const inOfficeRow: unknown[] = ['In Office', '', '']
    const remoteRow: unknown[] = ['Remote', '', '']
    days.forEach(d => {
      const dateStr = fmt(d)
      if (holidayMap[dateStr]) { inOfficeRow.push(0); remoteRow.push(0); return }
      inOfficeRow.push(staff.filter(m => getScheduleStatus(m, d, cache) === 'office').length)
      remoteRow.push(staff.filter(m => getScheduleStatus(m, d, cache) === 'remote').length)
    })
    aoa.push(inOfficeRow, remoteRow)

    const sheet = XLSX.utils.aoa_to_sheet(aoa)

    // Header row
    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '1B2B6B' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    }
    for (let c = 0; c < header.length; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c })
      if (sheet[addr]) sheet[addr].s = headerStyle
    }

    // Status cells
    rows.forEach((m, i) => {
      const r = i + 1
      days.forEach((d, j) => {
        const dateStr = fmt(d)
        const st = holidayMap[dateStr] ? 'holiday' : getScheduleStatus(m, d, cache)
        if (!st) return
        const addr = XLSX.utils.encode_cell({ r, c: 3 + j })
        const meta = STATUS_XLSX[st]
        if (sheet[addr]) {
          sheet[addr].s = {
            fill: { fgColor: { rgb: meta.fill } },
            font: { color: { rgb: meta.font }, bold: true },
            alignment: { horizontal: 'center' },
          }
        }
      })
    })

    // Totals rows
    const totalsStart = rows.length + 1
    for (let r = totalsStart; r <= totalsStart + 1; r++) {
      for (let c = 0; c < header.length; c++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        if (sheet[addr]) {
          sheet[addr].s = {
            font: { bold: true },
            fill: { fgColor: { rgb: 'F2F2F2' } },
            alignment: { horizontal: c >= 3 ? 'center' : 'left' },
          }
        }
      }
    }

    sheet['!cols'] = [{ wch: 22 }, { wch: 8 }, { wch: 8 }, ...days.map(() => ({ wch: 12 }))]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, sheet, 'Schedule')
    XLSX.writeFile(wb, `schedule-${fmt(ws0)}.xlsx`)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-5 sm:pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="eyebrow">Schedule</span>
            <span
              className={cn('inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11.5px] font-semibold', isPublished ? 'chip-office' : 'chip-leave')}
            >
              {isPublished ? <CircleCheck size={12} aria-hidden /> : <PencilLine size={12} aria-hidden />}
              {isPublished ? 'Published' : 'Draft'}
            </span>
          </div>
          <h1 className="mt-1 font-display text-[24px] sm:text-[28px] font-semibold tracking-tight text-ink">
            {periodLabel(view, navDate)}
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="btn btn-icon" aria-label={view === 'week' ? 'Previous week' : 'Previous month'}><ChevronLeft size={16} /></button>
            <button onClick={() => setNavDate(todayDate())} className="btn">Today</button>
            <button onClick={() => navigate(1)} className="btn btn-icon" aria-label={view === 'week' ? 'Next week' : 'Next month'}><ChevronRight size={16} /></button>
          </div>
          <div className="seg" role="group" aria-label="View">
            {(['week', 'month'] as const).map(v => (
              <button key={v} aria-pressed={view === v} onClick={() => switchView(v)} className="capitalize">{v}</button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <SyncBadge state={sync.state} message={sync.msg} />
          <div className="relative hidden sm:block">
            <button onClick={() => setShowKeys(k => !k)} className="btn btn-icon" aria-label="Keyboard shortcuts" aria-expanded={showKeys} title="Keyboard shortcuts">
              <Keyboard size={16} />
            </button>
            {showKeys && <ShortcutHelp onClose={() => setShowKeys(false)} />}
          </div>
          <button onClick={exportSchedule} title="Export this week's schedule" className="btn">
            <Download size={15} /> <span className="hidden sm:inline">Export</span>
          </button>
          {canEdit && (
            <>
              <button onClick={handleReshuffle} title="Reshuffle based on targets" className="btn">
                <Shuffle size={15} /> <span className="hidden sm:inline">Reshuffle</span>
              </button>
              <button onClick={togglePublish} className={cn('btn', isPublished ? 'btn-danger' : 'btn-primary')}>
                {isPublished ? <><PinOff size={15} /> Unpublish</> : <><Pin size={15} /> Publish</>}
              </button>
            </>
          )}
        </div>
      </div>

      <KPIRow staff={staff} workDays={workDays} seats={initialSeats} seatsFor={seatsFor} cache={cache} holidayMap={holidayMap} />

      {/* Grid on larger screens, day list on phones */}
      <div className="hidden sm:block">
        <ScheduleTable
          staff={orderedStaff}
          groups={groups}
          workDays={workDays}
          seatsFor={seatsFor}
          cache={cache}
          holidayMap={holidayMap}
          collapsed={collapsed}
          canEdit={canEdit}
          view={view}
          onToggleGroup={toggleGroup}
          onCycleStatus={handleCycleStatus}
          onSetStatus={handleSetStatus}
          onToggleLock={handleToggleLock}
        />
        {canEdit && (
          <p className="mt-3 text-[12px] text-ink-3">
            Click a day to cycle its status, or use the keyboard: arrows to move, <span className="kbd">O</span> <span className="kbd">R</span> <span className="kbd">L</span> <span className="kbd">X</span> to set, <span className="kbd">K</span> to lock.
          </p>
        )}
      </div>
      <div className="sm:hidden">
        <ScheduleDayList
          key={workDays.length ? fmt(workDays[0]) : 'none'}
          staff={orderedStaff}
          groups={groups}
          workDays={workDays}
          seatsFor={seatsFor}
          cache={cache}
          holidayMap={holidayMap}
          canEdit={canEdit}
          onCycleStatus={handleCycleStatus}
        />
      </div>
    </div>
  )
}

function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const rows: [string[], string][] = [
    [['←', '↑', '→', '↓'], 'Move between days'],
    [['Enter'], 'Cycle status'],
    [['O'], 'Office'], [['R'], 'Remote'], [['L'], 'Leave'], [['X'], 'Other site'],
    [['Del'], 'Back to default pattern'],
    [['K'], 'Lock / unlock day'],
    [['⌘', 'K'], 'Command palette'],
  ]
  return (
    <div className="absolute right-0 top-11 z-40 w-64 panel p-3 enter" role="dialog" aria-label="Keyboard shortcuts" onKeyDown={e => e.key === 'Escape' && onClose()}>
      <div className="eyebrow mb-2">Keyboard</div>
      <ul className="flex flex-col gap-1.5">
        {rows.map(([keys, label]) => (
          <li key={label} className="flex items-center justify-between gap-3 text-[12.5px] text-ink-2">
            {label}
            <span className="flex gap-1">{keys.map(k => <span key={k} className="kbd">{k}</span>)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

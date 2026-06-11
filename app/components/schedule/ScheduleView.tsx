'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { ChevronLeft, ChevronRight, Shuffle, Download, Pin, PinOff } from 'lucide-react'
import * as XLSX from 'xlsx-js-style'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Staff, Group, Role } from '@/types/database'
import type { Status } from '@/types/database'
import {
  buildEntryCache, getScheduleStatus, isLocked, nextCycleStatus,
  fmt, weekStart, getWorkDays, periodLabel, computeReshuffle,
  todayDate, entryKey,
} from '@/lib/schedule'
import type { EntryCache } from '@/lib/schedule'
import type { SyncState } from './SyncBadge'
import { SyncBadge } from './SyncBadge'
import { KPIRow } from './KPIRow'
import { Heatmap } from './Heatmap'
import { ScheduleTable } from './ScheduleTable'

interface Props {
  staff: Staff[]
  groups: Group[]
  seats: number
  weekPlans: Record<string, { status: string }>
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

  const [view, setView]       = useState<'week' | 'month'>('week')
  const [navDate, setNavDate] = useState(todayDate)
  const [cache, setCache]     = useState<EntryCache>({})
  const [weekPlans, setWeekPlans] = useState(initialWeekPlans)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [sync, setSyncState]  = useState<{ state: SyncState; msg: string }>({ state: 'idle', msg: 'All changes save automatically' })
  const [, startTransition]   = useTransition()

  const supabase = createClient()

  const workDays = getWorkDays(view, navDate)

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
      setWeekPlans(p => ({ ...p, [weekKey]: { status: 'draft' } }))
      setSync('ok', 'Week unpublished — schedule is editable again')
    } else {
      if (!confirm('Publish this week?\n\nThe schedule will be locked. You can unpublish it later if needed.')) return
      setSync('syncing', 'Publishing…')
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('week_plans')
        .upsert({ week_start: weekKey, status: 'published', published_by: user?.id, published_at: new Date().toISOString() }, { onConflict: 'week_start' })
      if (error) { setSync('error', 'Failed: ' + error.message); return }
      setWeekPlans(p => ({ ...p, [weekKey]: { status: 'published' } }))
      setSync('ok', 'Week published 🔒')
    }
  }

  // ─── Cycle status ─────────────────────────────────────────────────────────

  async function handleCycleStatus(staffId: string, dateStr: string) {
    if (!canEdit) return
    const [y, mo, d] = dateStr.split('-').map(Number)
    const day = new Date(y, mo - 1, d)
    const m = staff.find(x => x.id === staffId)
    if (!m || isLocked(m, day, cache, holidayMap)) return

    const cur = getScheduleStatus(m, day, cache)
    const next = nextCycleStatus(cur)
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
    if (!m) return

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
      setSync('ok', newLocked ? '🔒 Locked' : '🔓 Unlocked')
    } catch (err: unknown) {
      setSync('error', 'Lock failed: ' + (err instanceof Error ? err.message : String(err)))
      loadEntries(view, navDate)
    }
  }

  // ─── Reshuffle ────────────────────────────────────────────────────────────

  async function handleReshuffle() {
    if (!canEdit) return
    if (isPublished) {
      alert('This week is published 🔒\n\nUnpublish it first if you want to reshuffle.')
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

    const header = ['Staff', 'Office', 'Remote', ...days.map(d => FULL_DAY_NAMES[d.getDay()])]
    const aoa: unknown[][] = [header]

    staff.forEach(m => {
      const dayStatuses = days.map(d => {
        const dateStr = fmt(d)
        if (holidayMap[dateStr]) return 'holiday' as const
        return getScheduleStatus(m, d, cache)
      })
      const officeCount = dayStatuses.filter(s => s === 'office').length
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
    staff.forEach((m, i) => {
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
    const totalsStart = staff.length + 1
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
    <div className="flex flex-col flex-1 px-6 py-5">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[200px]">
          {periodLabel(view, navDate)}
        </span>
        <button onClick={() => navigate(1)} className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ChevronRight size={16} />
        </button>

        {/* View toggle */}
        <div className="flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden ml-1">
          {(['week', 'month'] as const).map(v => (
            <button
              key={v}
              onClick={() => switchView(v)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors capitalize',
                view === v
                  ? 'bg-[var(--green)] text-white'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Week status */}
        <div className="flex items-center gap-1.5 ml-1">
          <span className={cn('w-2 h-2 rounded-full', isPublished ? 'bg-[var(--green)]' : 'bg-gray-300')} />
          <span className={cn('text-xs', isPublished ? 'text-[var(--green)]' : 'text-gray-400')}>
            {isPublished ? 'Published' : 'Draft'}
          </span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={exportSchedule}
            title="Export this week's schedule"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Download size={13} /> Export
          </button>
          {canEdit && (
            <>
              <button
                onClick={handleReshuffle}
                title="Reshuffle based on targets"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <Shuffle size={13} /> Reshuffle
              </button>
              <button
                onClick={togglePublish}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  isPublished
                    ? 'border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950'
                    : 'bg-[var(--green)] text-white hover:opacity-90'
                )}
              >
                {isPublished ? <><PinOff size={13} /> Unpublish</> : <><Pin size={13} /> Publish</>}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sync badge */}
      <SyncBadge state={sync.state} message={sync.msg} />

      {/* KPIs */}
      <KPIRow staff={staff} workDays={workDays} seats={initialSeats} cache={cache} holidayMap={holidayMap} />

      {/* Heatmap */}
      <Heatmap staff={staff} workDays={workDays} seats={initialSeats} cache={cache} holidayMap={holidayMap} />

      {/* Schedule table */}
      <ScheduleTable
        staff={staff}
        groups={groups}
        workDays={workDays}
        seats={initialSeats}
        cache={cache}
        holidayMap={holidayMap}
        collapsed={collapsed}
        canEdit={canEdit}
        view={view}
        onToggleGroup={toggleGroup}
        onCycleStatus={handleCycleStatus}
        onToggleLock={handleToggleLock}
      />
    </div>
  )
}

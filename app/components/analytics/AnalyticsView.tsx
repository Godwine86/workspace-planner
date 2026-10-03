'use client'

import { useState, useEffect, useCallback } from 'react'
import { Download, Lock, ChartNoAxesColumn, CircleAlert } from 'lucide-react'
import * as XLSX from 'xlsx-js-style'
import { createClient } from '@/lib/supabase/client'
import { fmt, weekStart } from '@/lib/schedule'
import { computeAnalytics } from '@/lib/analytics'
import { AnalyticsKPIs } from './AnalyticsKPIs'
import { WeeklyUtilChart, DowChart, GroupChart } from './Charts'
import { StaffTable } from './StaffTable'
import type { Staff, Group } from '@/types/database'

interface Props {
  staff: Staff[]
  groups: Group[]
  seats: number
  holidayMap: Record<string, string>
}

const RANGE_OPTIONS = [
  { value: 4,  label: 'Last 4 weeks' },
  { value: 8,  label: 'Last 8 weeks' },
  { value: 12, label: 'Last 12 weeks' },
  { value: 26, label: 'Last 6 months' },
]

export function AnalyticsView({ staff, groups, seats, holidayMap }: Props) {
  const [range, setRange]       = useState(8)
  const [groupId, setGroupId]   = useState('')
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [data, setData]         = useState<ReturnType<typeof computeAnalytics> | null>(null)
  const [exporting, setExporting] = useState(false)
  const [groupData, setGroupData] = useState<{ name: string; color: string; office: number; other: number; remote: number }[]>([])

  const supabase = createClient()

  const filteredStaff = groupId ? staff.filter(m => m.group_id === groupId) : staff

  const load = useCallback(async (weeks: number, gid: string) => {
    setLoading(true)
    setError(null)

    const endDate = new Date()
    const rangeStart = new Date(endDate)
    rangeStart.setDate(rangeStart.getDate() - weeks * 7)

    try {
      const { data: allPubW, error: wErr } = await supabase
        .from('week_plans')
        .select('week_start,seats')
        .eq('status', 'published')
        .order('week_start', { ascending: true })

      if (wErr) throw wErr

      const pubInRange = (allPubW as { week_start: string; seats: number | null }[] ?? []).filter(w => {
        const we = new Date(w.week_start + 'T00:00:00'); we.setDate(we.getDate() + 6)
        return we >= rangeStart  // only filter how far back; future published weeks are included
      })

      if (!pubInRange.length) {
        setData(computeAnalytics([], seats, [], [], holidayMap))
        setLoading(false)
        return
      }

      const sorted = [...pubInRange].sort((a, b) => a.week_start.localeCompare(b.week_start))
      const effStart = sorted[0].week_start
      const lastWs = new Date(sorted[sorted.length - 1].week_start + 'T00:00:00')
      const effEnd = new Date(lastWs); effEnd.setDate(lastWs.getDate() + 4)

      const { data: entries, error: eErr } = await supabase
        .from('schedule_entries')
        .select('staff_id,entry_date,status')
        .gte('entry_date', effStart)
        .lte('entry_date', fmt(effEnd))

      if (eErr) throw eErr

      const rows = (entries as { staff_id: string; entry_date: string; status: string }[] | null) ?? []
      const activeStaff = gid ? staff.filter(m => m.group_id === gid) : staff
      const result = computeAnalytics(activeStaff, seats, pubInRange, rows, holidayMap)
      setData(result)

      // Average days per person per week, for each group
      const weeksWorked = result.publishedWorkDays / 5
      setGroupData(groups.map(g => {
        const d = computeAnalytics(staff.filter(m => m.group_id === g.id), seats, pubInRange, rows, holidayMap)
        const people = d.staffRows.length
        const per = (n: number) => people && weeksWorked ? Math.round(n / people / weeksWorked * 10) / 10 : 0
        return { name: g.name, color: g.color, office: per(d.totalOffice), other: per(d.totalOther), remote: per(d.totalRemote) }
      }).filter(g => g.office + g.other + g.remote > 0))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [staff, groups, seats])

  useEffect(() => { load(range, groupId) }, [range, groupId, load])

  async function exportReport(scope: 'range' | 'all') {
    setExporting(true)
    try {
      let pubWeeks: { week_start: string; published_at?: string; seats?: number | null }[]

      if (scope === 'all') {
        const { data } = await supabase.from('week_plans')
          .select('week_start,published_at,seats')
          .eq('status', 'published')
          .order('week_start', { ascending: true })
          .limit(52)
        pubWeeks = (data as typeof pubWeeks ?? [])
      } else {
        const endDate = new Date()
        const rangeStart = new Date(endDate); rangeStart.setDate(rangeStart.getDate() - range * 7)
        const { data: allW } = await supabase.from('week_plans')
          .select('week_start,published_at,seats').eq('status', 'published').order('week_start')
        pubWeeks = (allW as typeof pubWeeks ?? []).filter(w => {
          const ws = new Date(w.week_start + 'T00:00:00')
          const we = new Date(ws); we.setDate(ws.getDate() + 6)
          return we >= rangeStart && ws <= endDate
        })
      }

      if (!pubWeeks.length) { alert('No published weeks to export.'); return }

      const sorted = [...pubWeeks].sort((a, b) => a.week_start.localeCompare(b.week_start))
      const lastWs = new Date(sorted[sorted.length - 1].week_start + 'T00:00:00')
      const effEnd = new Date(lastWs); effEnd.setDate(lastWs.getDate() + 4)

      const { data: entries } = await supabase
        .from('schedule_entries').select('staff_id,entry_date,status')
        .gte('entry_date', sorted[0].week_start).lte('entry_date', fmt(effEnd))

      const d = computeAnalytics(staff, seats, pubWeeks, entries as { staff_id: string; entry_date: string; status: string }[] ?? [], holidayMap)

      const hSt = { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 }, fill: { fgColor: { rgb: '1B5E20' } }, alignment: { horizontal: 'center' } }
      const wb = XLSX.utils.book_new()

      // Sheet 1 — Weekly Summary
      const s1: unknown[][] = [
        ['Workspace Planner — Weekly Summary'],
        ['Generated: ' + new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })],
        [],
        ['Week', 'Published Date', 'Working Days', 'In-Office Days', 'Remote Days', 'Seat Utilization'],
      ]
      sorted.forEach(w => {
        const ws2 = new Date(w.week_start + 'T00:00:00')
        const we2 = new Date(ws2); we2.setDate(ws2.getDate() + 4)
        const weekly = d.weeklyUtil.find(u => u.label === ws2.getDate() + '/' + String(ws2.getMonth() + 1).padStart(2, '0'))
        const pub = w.published_at
          ? new Date(w.published_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
          : 'Draft'
        s1.push([
          ws2.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' – ' + we2.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          pub, '—', '—', '—', weekly ? weekly.util + '%' : '—',
        ])
      })
      const ws1 = XLSX.utils.aoa_to_sheet(s1)
      ws1['!cols'] = [{ wch: 34 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 18 }]
      for (let c = 0; c < 6; c++) { const a = XLSX.utils.encode_cell({ r: 3, c }); if (!ws1[a]) ws1[a] = { t: 's', v: '' }; ws1[a].s = hSt }
      XLSX.utils.book_append_sheet(wb, ws1, 'Weekly Summary')

      // Sheet 2 — Staff Breakdown
      const s2: unknown[][] = [['Workspace Planner — Staff Breakdown'], [], ['Name', 'Role', 'In-Office Days', 'Remote Days', 'Leave Days', 'Office %']]
      d.staffRows.forEach(r => s2.push([r.name, r.role ?? '', r.office, r.remote, r.leave, r.officePct + '%']))
      const ws2sheet = XLSX.utils.aoa_to_sheet(s2)
      ws2sheet['!cols'] = [{ wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 }]
      for (let c = 0; c < 6; c++) { const a = XLSX.utils.encode_cell({ r: 2, c }); if (!ws2sheet[a]) ws2sheet[a] = { t: 's', v: '' }; ws2sheet[a].s = hSt }
      XLSX.utils.book_append_sheet(wb, ws2sheet, 'Staff Breakdown')

      // Sheet 3 — Day of Week
      const s3: unknown[][] = [['Workspace Planner — Attendance by Day of Week'], [], ['Day', 'Avg In-Office', 'Avg Remote', 'Avg Utilization']]
      d.dowData.forEach(r => s3.push([r.day, r.office, r.remote, r.util + '%']))
      const ws3 = XLSX.utils.aoa_to_sheet(s3)
      ws3['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 18 }]
      for (let c = 0; c < 4; c++) { const a = XLSX.utils.encode_cell({ r: 2, c }); if (!ws3[a]) ws3[a] = { t: 's', v: '' }; ws3[a].s = hSt }
      XLSX.utils.book_append_sheet(wb, ws3, 'Day of Week')

      const today = new Date(); const ds = fmt(today)
      XLSX.writeFile(wb, `workspace-analytics-${scope === 'all' ? 'all-time' : 'range'}-${ds}.xlsx`)
    } catch (err) {
      alert('Export failed: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-5 sm:pb-8">
      {/* Header + filters */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 mb-5">
        <div>
          <span className="eyebrow">Analytics</span>
          <h1 className="mt-1 font-display text-[24px] sm:text-[28px] font-semibold tracking-tight text-ink">Attendance & seat use</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="sr-only" htmlFor="an-range">Time range</label>
          <select id="an-range" value={range} onChange={e => setRange(Number(e.target.value))} className="field h-9 w-auto text-[13px] pr-8">
            {RANGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <label className="sr-only" htmlFor="an-group">Group</label>
          <select id="an-group" value={groupId} onChange={e => setGroupId(e.target.value)} className="field h-9 w-auto text-[13px] pr-8">
            <option value="">All groups</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => exportReport('range')} disabled={exporting || !data?.publishedWeekCount} className="btn">
            <Download size={15} /> Export range
          </button>
          <button onClick={() => exportReport('all')} disabled={exporting} className="btn">
            <Download size={15} /> <span className="hidden sm:inline">Export</span> all-time
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl border border-[var(--danger-edge)] bg-[var(--danger-bg)] text-sm text-[var(--danger-fg)]">
          <CircleAlert size={16} aria-hidden /> {error}
          <button onClick={() => load(range, groupId)} className="btn btn-sm ml-auto">Retry</button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div aria-busy="true" aria-label="Loading analytics">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 mb-5">
            {[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-[124px] rounded-2xl" />)}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="skeleton h-[280px] rounded-2xl" /><div className="skeleton h-[280px] rounded-2xl" />
          </div>
        </div>
      )}

      {!loading && !error && data && data.publishedWeekCount === 0 && (
        <div className="panel flex-1 flex flex-col items-center justify-center gap-3 text-center p-10">
          <span className="grid place-items-center w-14 h-14 rounded-2xl bg-accent-soft text-accent"><ChartNoAxesColumn size={26} aria-hidden /></span>
          <div className="font-display text-[17px] font-semibold text-ink">No published weeks in this range</div>
          <div className="text-sm text-ink-2 max-w-sm">
            Use <strong>Publish</strong> on the Schedule page to lock a week. Analytics only counts published weeks.
          </div>
        </div>
      )}

      {!loading && !error && data && data.publishedWeekCount > 0 && (
        <>
          <div className="mb-4 inline-flex w-fit items-center gap-2 h-7 px-3 rounded-full border border-line bg-[var(--panel)] text-[12px] text-ink-2">
            <Lock size={12} className="text-[var(--office-fg)]" aria-hidden />
            Based on <strong className="text-ink">{data.publishedWeekCount} published week{data.publishedWeekCount !== 1 ? 's' : ''}</strong>
            {data.rangeLabel && <span className="text-ink-3">· {data.rangeLabel}</span>}
          </div>

          <AnalyticsKPIs
            totalOffice={data.totalOffice}
            totalRemote={data.totalRemote}
            totalOther={data.totalOther}
            avgDailyOffice={data.avgDailyOffice}
            avgUtilization={data.avgUtilization}
            publishedWorkDays={data.publishedWorkDays}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <section className="panel p-5 enter">
              <h2 className="font-display text-[15px] font-semibold text-ink">Weekly seat utilization</h2>
              <p className="text-[12.5px] text-ink-3 mb-3">Share of seats used per week; dashed line is full capacity</p>
              <WeeklyUtilChart data={data.weeklyUtil} />
            </section>
            <section className="panel p-5 enter" style={{ animationDelay: '40ms' }}>
              <h2 className="font-display text-[15px] font-semibold text-ink">By day of week</h2>
              <p className="text-[12.5px] text-ink-3 mb-3">Average people per day</p>
              <DowChart data={data.dowData} />
            </section>
          </div>

          {!groupId && groupData.length > 1 && (
            <section className="panel p-5 mb-4 enter">
              <h2 className="font-display text-[15px] font-semibold text-ink">By group</h2>
              <p className="text-[12.5px] text-ink-3 mb-3">Average days per person per week</p>
              <GroupChart data={groupData} />
            </section>
          )}

          <section className="panel overflow-hidden enter">
            <div className="px-5 py-4 border-b border-line">
              <h2 className="font-display text-[15px] font-semibold text-ink">Staff attendance</h2>
              <p className="text-[12.5px] text-ink-3">Click a column to sort</p>
            </div>
            <StaffTable rows={data.staffRows} />
          </section>
        </>
      )}
    </div>
  )
}

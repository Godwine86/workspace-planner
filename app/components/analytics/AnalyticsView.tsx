'use client'

import { useState, useEffect, useCallback } from 'react'
import { Download, Lock } from 'lucide-react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { fmt, weekStart } from '@/lib/schedule'
import { computeAnalytics } from '@/lib/analytics'
import { AnalyticsKPIs } from './AnalyticsKPIs'
import { WeeklyUtilChart, DowChart } from './Charts'
import { StaffTable } from './StaffTable'
import type { Staff, Group } from '@/types/database'

interface Props {
  staff: Staff[]
  groups: Group[]
  seats: number
}

const RANGE_OPTIONS = [
  { value: 4,  label: 'Last 4 weeks' },
  { value: 8,  label: 'Last 8 weeks' },
  { value: 12, label: 'Last 12 weeks' },
  { value: 26, label: 'Last 6 months' },
]

export function AnalyticsView({ staff, groups, seats }: Props) {
  const [range, setRange]       = useState(8)
  const [groupId, setGroupId]   = useState('')
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [data, setData]         = useState<ReturnType<typeof computeAnalytics> | null>(null)
  const [exporting, setExporting] = useState(false)

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
        .select('week_start')
        .eq('status', 'published')
        .order('week_start', { ascending: true })

      if (wErr) throw wErr

      const pubInRange = (allPubW as { week_start: string }[] ?? []).filter(w => {
        const ws = new Date(w.week_start + 'T00:00:00')
        const we = new Date(ws); we.setDate(ws.getDate() + 6)
        return we >= rangeStart && ws <= endDate
      })

      if (!pubInRange.length) {
        setData(computeAnalytics([], seats, [], []))
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

      const activeStaff = gid ? staff.filter(m => m.group_id === gid) : staff
      setData(computeAnalytics(activeStaff, seats, pubInRange, entries as { staff_id: string; entry_date: string; status: string }[] ?? []))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [staff, seats])

  useEffect(() => { load(range, groupId) }, [range, groupId, load])

  async function exportReport(scope: 'range' | 'all') {
    setExporting(true)
    try {
      let pubWeeks: { week_start: string; published_at?: string }[]

      if (scope === 'all') {
        const { data } = await supabase.from('week_plans')
          .select('week_start,published_at')
          .eq('status', 'published')
          .order('week_start', { ascending: true })
          .limit(52)
        pubWeeks = (data as typeof pubWeeks ?? [])
      } else {
        const endDate = new Date()
        const rangeStart = new Date(endDate); rangeStart.setDate(rangeStart.getDate() - range * 7)
        const { data: allW } = await supabase.from('week_plans')
          .select('week_start,published_at').eq('status', 'published').order('week_start')
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

      const d = computeAnalytics(staff, seats, pubWeeks, entries as { staff_id: string; entry_date: string; status: string }[] ?? [])

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
      d.dowData.forEach(r => s3.push([r.day, r.office, r.remote, seats > 0 ? Math.round(r.office / seats * 100) + '%' : '—']))
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
    <div className="flex flex-col flex-1 px-6 py-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <select
          value={range}
          onChange={e => setRange(Number(e.target.value))}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--green)]"
        >
          {RANGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select
          value={groupId}
          onChange={e => setGroupId(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--green)]"
        >
          <option value="">All groups</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => exportReport('range')}
            disabled={exporting || !data?.publishedWeekCount}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            <Download size={13} /> Export range
          </button>
          <button
            onClick={() => exportReport('all')}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            <Download size={13} /> Export all-time
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          Loading analytics…
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && data && data.publishedWeekCount === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
          <div className="text-4xl">📊</div>
          <div className="font-semibold text-gray-700 dark:text-gray-300">No published weeks in this range</div>
          <div className="text-sm text-gray-400 max-w-sm">
            Use the <strong>Publish</strong> button on the Schedule page to lock and archive a week.
            Analytics only counts data from published weeks.
          </div>
        </div>
      )}

      {/* Analytics content */}
      {!loading && !error && data && data.publishedWeekCount > 0 && (
        <>
          {/* Info bar */}
          <div className="flex items-center gap-2 mb-5 px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-xs text-gray-500 dark:text-gray-400">
            <Lock size={12} className="text-[var(--green)] flex-shrink-0" />
            <span>
              Based on <strong className="text-gray-700 dark:text-gray-300">{data.publishedWeekCount} published week{data.publishedWeekCount !== 1 ? 's' : ''}</strong>
              {data.rangeLabel && <> &nbsp;·&nbsp; {data.rangeLabel}</>}
            </span>
            <span className="ml-auto text-gray-400">Other-office attendance counted as in-office</span>
          </div>

          {/* KPIs */}
          <AnalyticsKPIs
            totalOffice={data.totalOffice}
            totalRemote={data.totalRemote}
            totalOther={data.totalOther}
            avgDailyOffice={data.avgDailyOffice}
            avgUtilization={data.avgUtilization}
            publishedWorkDays={data.publishedWorkDays}
          />

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Weekly seat utilization
              </h3>
              <WeeklyUtilChart data={data.weeklyUtil} />
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                Average attendance by day of week
              </h3>
              <DowChart data={data.dowData} />
            </div>
          </div>

          {/* Staff table */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Staff attendance breakdown
              </h3>
            </div>
            <StaffTable rows={data.staffRows} />
          </div>
        </>
      )}
    </div>
  )
}

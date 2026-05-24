import type { Staff } from '@/types/database'
import { fmt, weekStart } from './schedule'
import { WORK_DOW } from './utils'

// DB-only status resolution — never falls back to pattern
function effSt(raw: string | undefined): 'office' | 'remote' | 'leave' | 'other' | null {
  if (!raw) return null
  if (raw === 'office' || raw === 'remote' || raw === 'leave' || raw === 'other') return raw
  return null
}

function sunKey(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const date = new Date(y, mo - 1, d)
  return fmt(new Date(y, mo - 1, d - date.getDay()))
}

export interface AnalyticsData {
  // Summary KPIs
  totalOffice: number
  totalRemote: number
  totalOther: number
  avgDailyOffice: number   // rounded to 1dp
  avgUtilization: number   // integer %
  publishedWorkDays: number
  publishedWeekCount: number
  rangeLabel: string

  // Weekly utilization line chart data
  weeklyUtil: { label: string; util: number }[]

  // Day-of-week bar chart data
  dowData: { day: string; office: number; remote: number; other: number }[]

  // Staff breakdown table
  staffRows: {
    id: string
    name: string
    title: string | null
    office: number
    remote: number
    leave: number
    other: number
    officePct: number
    otherPct: number
  }[]
}

export function computeAnalytics(
  staff: Staff[],
  seats: number,
  publishedWeeks: { week_start: string; published_at?: string }[],
  entries: { staff_id: string; entry_date: string; status: string }[],
): AnalyticsData {
  if (!publishedWeeks.length) {
    return {
      totalOffice: 0, totalRemote: 0, totalOther: 0, avgDailyOffice: 0,
      avgUtilization: 0, publishedWorkDays: 0, publishedWeekCount: 0,
      rangeLabel: '', weeklyUtil: [], dowData: [], staffRows: [],
    }
  }

  const sorted = [...publishedWeeks].sort((a, b) => a.week_start.localeCompare(b.week_start))
  const publishedSet = new Set(sorted.map(w => w.week_start))

  // Build entry lookup: "staffId__YYYY-MM-DD" → raw status string
  const lookup: Record<string, string> = {}
  entries.forEach(r => { lookup[`${r.staff_id}__${r.entry_date}`] = r.status })

  // Effective date range: first published week start → last published week Thu (end)
  const firstWs = new Date(sorted[0].week_start + 'T00:00:00')
  const lastWs  = new Date(sorted[sorted.length - 1].week_start + 'T00:00:00')
  const effEnd  = new Date(lastWs)
  effEnd.setDate(lastWs.getDate() + 4)

  // All published working days in range
  const allWorkDays: string[] = []
  const cursor = new Date(firstWs)
  while (cursor <= effEnd) {
    if (WORK_DOW.includes(cursor.getDay())) {
      const ds = fmt(new Date(cursor))
      if (publishedSet.has(sunKey(ds))) allWorkDays.push(ds)
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  // Daily map: dateStr → { office, remote, leave, other }
  const dailyMap: Record<string, { office: number; remote: number; leave: number; other: number }> = {}
  allWorkDays.forEach(ds => {
    dailyMap[ds] = { office: 0, remote: 0, leave: 0, other: 0 }
    staff.forEach(m => {
      const st = effSt(lookup[`${m.id}__${ds}`])
      if (st === 'office') dailyMap[ds].office++
      else if (st === 'remote') dailyMap[ds].remote++
      else if (st === 'leave') dailyMap[ds].leave++
      else if (st === 'other') dailyMap[ds].other++
    })
  })

  // Summary KPIs
  let totalOffice = 0, totalRemote = 0, totalOther = 0
  allWorkDays.forEach(ds => {
    totalOffice += dailyMap[ds].office
    totalRemote += dailyMap[ds].remote
    totalOther  += dailyMap[ds].other
  })
  const n = allWorkDays.length
  const avgDailyOffice = n > 0 ? Math.round(totalOffice / n * 10) / 10 : 0
  const avgUtilization = n > 0 && seats > 0 ? Math.round(totalOffice / n / seats * 100) : 0

  // Weekly utilization for line chart
  const weeklyUtil = sorted.map(({ week_start }) => {
    const ws = new Date(week_start + 'T00:00:00')
    const we = new Date(ws); we.setDate(ws.getDate() + 4)
    let wO = 0, wD = 0
    allWorkDays.forEach(ds => {
      const d = new Date(ds + 'T00:00:00')
      if (d >= ws && d <= we) { wD++; wO += dailyMap[ds].office }
    })
    const util = wD > 0 && seats > 0 ? Math.round(wO / wD / seats * 100) : 0
    const label = ws.getDate() + '/' + String(ws.getMonth() + 1).padStart(2, '0')
    return { label, util }
  })

  // Day-of-week averages for bar chart
  const dowAcc: Record<number, { o: number; r: number; ot: number; n: number }> = {
    0: { o: 0, r: 0, ot: 0, n: 0 }, 1: { o: 0, r: 0, ot: 0, n: 0 }, 2: { o: 0, r: 0, ot: 0, n: 0 },
    3: { o: 0, r: 0, ot: 0, n: 0 }, 4: { o: 0, r: 0, ot: 0, n: 0 },
  }
  allWorkDays.forEach(ds => {
    const dow = new Date(ds + 'T00:00:00').getDay()
    if (dowAcc[dow]) {
      dowAcc[dow].n++
      dowAcc[dow].o  += dailyMap[ds].office
      dowAcc[dow].r  += dailyMap[ds].remote
      dowAcc[dow].ot += dailyMap[ds].other
    }
  })
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu']
  const dowData = WORK_DOW.map((dow, i) => ({
    day: DAY_NAMES[i],
    office: dowAcc[dow].n > 0 ? Math.round(dowAcc[dow].o  / dowAcc[dow].n * 10) / 10 : 0,
    remote: dowAcc[dow].n > 0 ? Math.round(dowAcc[dow].r  / dowAcc[dow].n * 10) / 10 : 0,
    other:  dowAcc[dow].n > 0 ? Math.round(dowAcc[dow].ot / dowAcc[dow].n * 10) / 10 : 0,
  }))

  // Staff totals — DB entries only (no pattern fallback)
  const staffMap: Record<string, { id: string; name: string; title: string | null; office: number; remote: number; leave: number; other: number }> = {}
  staff.forEach(m => { staffMap[m.id] = { id: m.id, name: m.name, title: m.title, office: 0, remote: 0, leave: 0, other: 0 } })
  allWorkDays.forEach(ds => {
    staff.forEach(m => {
      const raw = lookup[`${m.id}__${ds}`]
      if (!raw) return  // no entry = not counted (intentional — analytics ≠ schedule)
      const st = effSt(raw)
      if (st === 'office') staffMap[m.id].office++
      else if (st === 'remote') staffMap[m.id].remote++
      else if (st === 'leave') staffMap[m.id].leave++
      else if (st === 'other') staffMap[m.id].other++
    })
  })
  const staffRows = Object.values(staffMap)
    .sort((a, b) => b.office - a.office)
    .map(s => {
      const total = s.office + s.remote + s.leave + s.other
      return {
        ...s,
        officePct: total > 0 ? Math.round(s.office / total * 100) : 0,
        otherPct:  total > 0 ? Math.round(s.other  / total * 100) : 0,
      }
    })

  // Range label
  const fmtDate = (ds: string) =>
    new Date(ds + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const lastEnd = new Date(sorted[sorted.length - 1].week_start + 'T00:00:00')
  lastEnd.setDate(lastEnd.getDate() + 4)
  const rangeLabel = `${fmtDate(sorted[0].week_start)} – ${lastEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  return {
    totalOffice, totalRemote, totalOther, avgDailyOffice, avgUtilization,
    publishedWorkDays: allWorkDays.length,
    publishedWeekCount: sorted.length,
    rangeLabel,
    weeklyUtil, dowData, staffRows,
  }
}

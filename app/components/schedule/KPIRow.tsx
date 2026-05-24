import { cn } from '@/lib/utils'
import type { Staff } from '@/types/database'
import type { EntryCache } from '@/lib/schedule'
import { getScheduleStatus, todayDate, fmt, entryKey } from '@/lib/schedule'

interface Props {
  staff: Staff[]
  workDays: Date[]
  seats: number
  cache: EntryCache
  holidayMap: Record<string, string>
}

interface KPICardProps {
  label: string
  accent: string
  children: React.ReactNode
}

function KPICard({ label, accent, children }: KPICardProps) {
  return (
    <div
      className="relative flex flex-col gap-1 pl-5 pr-5 py-3.5 glass rounded-xl min-w-[120px] overflow-hidden transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md"
      style={{ boxShadow: '0 2px 12px rgba(27,43,107,0.06)' }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ background: accent }} />
      <div className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">{label}</div>
      {children}
    </div>
  )
}

export function KPIRow({ staff, workDays, seats, cache, holidayMap }: Props) {
  const today = todayDate()

  const todayIsHoliday = !!holidayMap[fmt(today)]
  const todayOffice = todayIsHoliday ? 0 : staff.filter(m => cache[entryKey(m.id, today)]?.status === 'office').length
  const todayPct = seats > 0 ? Math.min(100, Math.round(todayOffice / seats * 100)) : 0

  const todayBarColor =
    todayOffice > seats   ? '#ef4444' :
    todayOffice >= seats * 0.8 ? '#F7941D' :
    'var(--green)'

  const todayTextColor =
    todayOffice > seats   ? 'text-red-600 dark:text-red-400' :
    todayOffice >= seats * 0.8 ? 'text-[var(--amber)]' :
    'text-[var(--green)]'

  let totalOffice = 0, totalRemote = 0, totalLeave = 0, totalOther = 0
  let nonHolidayDays = 0
  workDays.forEach(d => {
    if (holidayMap[fmt(d)]) return
    nonHolidayDays++
    staff.forEach(m => {
      const st = getScheduleStatus(m, d, cache)
      if (st === 'office') totalOffice++
      else if (st === 'remote') totalRemote++
      else if (st === 'leave') totalLeave++
      else if (st === 'other') totalOther++
    })
  })

  const avgDaily = nonHolidayDays > 0 ? totalOffice / nonHolidayDays : 0
  const utilPct = seats > 0 ? Math.round(avgDaily / seats * 100) : 0

  const utilColor =
    utilPct > 100 ? '#ef4444' :
    utilPct >= 80  ? '#F7941D' :
    'var(--primary)'

  return (
    <div className="flex flex-wrap gap-3 mb-5">
      <KPICard label="Available seats" accent="var(--primary)">
        <span className="text-2xl font-semibold text-[var(--primary)] dark:text-blue-300">{seats}</span>
      </KPICard>

      <KPICard label="Today in office" accent="var(--green)">
        <span className={cn('text-2xl font-semibold', todayTextColor)}>
          {todayOffice} / {seats}
        </span>
        <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden mt-1">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${todayPct}%`, background: todayBarColor }}
          />
        </div>
      </KPICard>

      <KPICard label="In office (period)" accent="var(--green)">
        <span className="text-2xl font-semibold text-[var(--green)]">{totalOffice}</span>
      </KPICard>

      <KPICard label="Remote (period)" accent="var(--blue)">
        <span className="text-2xl font-semibold text-[var(--blue)]">{totalRemote}</span>
      </KPICard>

      <KPICard label="Leave" accent="#94a3b8">
        <span className="text-2xl font-semibold text-gray-400">{totalLeave}</span>
      </KPICard>

      <KPICard label="Other location" accent="var(--amber)">
        <span className="text-2xl font-semibold text-[var(--amber)]">{totalOther}</span>
      </KPICard>

      <KPICard label="Seat utilization" accent={utilColor}>
        <span
          className="text-2xl font-semibold"
          style={{ color: utilColor }}
        >
          {utilPct}%
        </span>
      </KPICard>
    </div>
  )
}

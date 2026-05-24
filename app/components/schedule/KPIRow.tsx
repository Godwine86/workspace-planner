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
  children: React.ReactNode
}

function KPICard({ label, children }: KPICardProps) {
  return (
    <div className="flex flex-col gap-1 px-5 py-3.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl min-w-[120px]">
      <div className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">{label}</div>
      {children}
    </div>
  )
}

export function KPIRow({ staff, workDays, seats, cache, holidayMap }: Props) {
  const today = todayDate()

  // Today in office — only count explicit cache entries, never pattern fallback.
  // If today is outside the loaded week, pattern fallback would give wrong counts.
  const todayIsHoliday = !!holidayMap[fmt(today)]
  const todayOffice = todayIsHoliday ? 0 : staff.filter(m => cache[entryKey(m.id, today)]?.status === 'office').length
  const todayPct = seats > 0 ? Math.min(100, Math.round(todayOffice / seats * 100)) : 0
  const todayColor =
    todayOffice > seats ? 'text-red-600 dark:text-red-400' :
    todayOffice >= seats * 0.8 ? 'text-amber-600 dark:text-amber-400' :
    'text-[var(--green)]'

  // Period totals — skip holiday days entirely
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

  return (
    <div className="flex flex-wrap gap-3 mb-5">
      <KPICard label="Available seats">
        <span className="text-2xl font-semibold text-[var(--green)]">{seats}</span>
      </KPICard>

      <KPICard label="Today in office">
        <span className={cn('text-2xl font-semibold', todayColor)}>
          {todayOffice} / {seats}
        </span>
        <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mt-1">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              todayOffice > seats ? 'bg-red-500' :
              todayOffice >= seats * 0.8 ? 'bg-amber-400' : 'bg-[var(--green)]'
            )}
            style={{ width: `${todayPct}%` }}
          />
        </div>
      </KPICard>

      <KPICard label="In office (period)">
        <span className="text-2xl font-semibold text-[var(--green)]">{totalOffice}</span>
      </KPICard>

      <KPICard label="Remote (period)">
        <span className="text-2xl font-semibold text-[var(--blue)]">{totalRemote}</span>
      </KPICard>

      <KPICard label="Leave">
        <span className="text-2xl font-semibold text-gray-400">{totalLeave}</span>
      </KPICard>

      <KPICard label="Other location">
        <span className="text-2xl font-semibold text-[var(--amber)]">{totalOther}</span>
      </KPICard>

      <KPICard label="Seat utilization">
        <span className={cn(
          'text-2xl font-semibold',
          utilPct > 100 ? 'text-red-600 dark:text-red-400' :
          utilPct >= 80  ? 'text-amber-600 dark:text-amber-400' :
          'text-gray-800 dark:text-gray-200'
        )}>
          {utilPct}%
        </span>
      </KPICard>
    </div>
  )
}

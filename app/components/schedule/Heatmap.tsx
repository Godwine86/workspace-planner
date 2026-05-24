import { cn } from '@/lib/utils'
import type { Staff } from '@/types/database'
import type { EntryCache } from '@/lib/schedule'
import { getScheduleStatus, fmt, todayDate } from '@/lib/schedule'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

interface Props {
  staff: Staff[]
  workDays: Date[]
  seats: number
  cache: EntryCache
  holidayMap: Record<string, string>
}

export function Heatmap({ staff, workDays, seats, cache, holidayMap }: Props) {
  const today = todayDate()

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Seat utilization — day by day
        </h3>
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          {[
            { cls: 'bg-[#FBF0DB] border-[#F0A030]', label: 'Low' },
            { cls: 'bg-[#EAF4E4] border-[#8CC87A]', label: 'Good' },
            { cls: 'bg-[#D4EDD4] border-[#5CBD48]', label: 'Full' },
            { cls: 'bg-[#FBEAEA] border-[#E89090]', label: 'Over' },
          ].map(({ cls, label }) => (
            <span key={label} className="flex items-center gap-1">
              <span className={cn('w-3 h-3 rounded-sm border', cls)} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {workDays.map(day => {
          const key = fmt(day)
          const holName = holidayMap[key]
          const isToday = day.getTime() === today.getTime()
          const dayName = DAY_NAMES[day.getDay()]
          const dayNum = day.getDate()
          const monthName = MONTH_NAMES[day.getMonth()]

          if (holName) {
            return (
              <div
                key={key}
                title={`${dayName} ${dayNum} ${monthName}: ${holName}`}
                className={cn(
                  'flex flex-col items-center justify-center w-14 h-14 rounded-lg border text-center cursor-default',
                  'bg-[#FBF0DB] border-[#F0A030] text-[#5A3005]',
                  isToday && 'ring-2 ring-offset-1 ring-[var(--amber)]'
                )}
              >
                <div className="text-[10px] font-medium">{dayName}</div>
                <div className="text-sm font-semibold">{dayNum}</div>
                <div className="text-[8px] font-bold tracking-wide">HOL</div>
              </div>
            )
          }

          const n = staff.filter(m => getScheduleStatus(m, day, cache) === 'office').length
          const pct = seats > 0 ? n / seats : 0
          const isEmpty = n === 0
          const isOver = n > seats
          const isFull = !isOver && pct >= 1
          const isMid  = !isOver && !isFull && pct >= 0.5

          const cellCls = isEmpty ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-400' :
            isOver ? 'bg-[#FBEAEA] border-[#E89090] text-[#6A1010]' :
            isFull ? 'bg-[#D4EDD4] border-[#5CBD48] text-[#1A4A10]' :
            isMid  ? 'bg-[#EAF4E4] border-[#8CC87A] text-[#1A4A10]' :
                     'bg-[#FBF0DB] border-[#F0A030] text-[#5A3005]'

          return (
            <div
              key={key}
              title={`${dayName} ${dayNum} ${monthName}: ${n}/${seats} (${Math.round(pct * 100)}%)`}
              className={cn(
                'flex flex-col items-center justify-center w-14 h-14 rounded-lg border text-center cursor-default',
                cellCls,
                isToday && 'ring-2 ring-offset-1 ring-[var(--green)]'
              )}
            >
              <div className="text-[10px] font-medium">{dayName}</div>
              <div className="text-sm font-semibold">{dayNum}</div>
              <div className="text-[10px]">{isEmpty ? '—' : `${n}/${seats}`}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

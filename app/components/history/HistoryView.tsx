import { cn } from '@/lib/utils'
import { fmt } from '@/lib/schedule'
import { STATUS_META } from '@/lib/schedule'
import type { Staff, Group } from '@/types/database'
import type { Status } from '@/types/database'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu']
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const STATUS_CLS: Record<Status, string> = {
  office: 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300',
  remote: 'bg-blue-100  dark:bg-blue-950  text-blue-800  dark:text-blue-300',
  leave:  'bg-gray-100  dark:bg-gray-800  text-gray-500  dark:text-gray-400',
  other:  'bg-amber-50  dark:bg-amber-950 text-amber-700 dark:text-amber-400',
}

export interface WeekData {
  weekStart: string
  status: 'published' | 'draft'
  publishedAt: string | null
  entries: { staff_id: string; entry_date: string; status: string }[]
}

interface Props {
  weeks: WeekData[]
  staff: Staff[]
  groups: Group[]
  seats: number
}

function getStatus(
  staffId: string,
  dateStr: string,
  staff: Staff,
  entryMap: Record<string, string>,
): Status | null {
  const raw = entryMap[`${staffId}__${dateStr}`]
  if (raw) return raw as Status
  // History view uses pattern fallback (same as schedule — not analytics)
  const [y, mo, d] = dateStr.split('-').map(Number)
  const dow = new Date(y, mo - 1, d).getDay()
  return (staff.pattern?.[dow] as Status | null) ?? null
}

export function HistoryView({ weeks, staff, groups, seats }: Props) {
  if (!weeks.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-12">
        <div className="text-4xl">📋</div>
        <div className="font-semibold text-gray-700 dark:text-gray-300">No published weeks yet</div>
        <div className="text-sm text-gray-400 max-w-sm">
          Use the <strong>Publish</strong> button on the Schedule page to lock and archive a week.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 px-6 py-5">
      <div className="text-xs text-gray-400 mb-4">
        {weeks.length} week{weeks.length !== 1 ? 's' : ''} in history
        &nbsp;·&nbsp; <span className="text-[var(--green)]">🔒 Published</span> weeks are locked
        &nbsp;·&nbsp; <span className="text-gray-400">✏️ Draft</span> weeks are still editable
      </div>

      <div className="flex flex-col gap-4">
        {weeks.map(week => {
          const ws = new Date(week.weekStart + 'T00:00:00')
          const workDates = Array.from({ length: 5 }, (_, i) => {
            const d = new Date(ws); d.setDate(ws.getDate() + i); return d
          })
          const weLabel = new Date(ws); weLabel.setDate(ws.getDate() + 4)
          const label = `${ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weLabel.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

          const entryMap: Record<string, string> = {}
          week.entries.forEach(e => { entryMap[`${e.staff_id}__${e.entry_date}`] = e.status })

          const isPublished = week.status === 'published'
          const pubDate = week.publishedAt
            ? new Date(week.publishedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
            : null

          return (
            <div key={week.weekStart} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
              {/* Week header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex-wrap">
                <span className="font-semibold text-[14px] text-gray-900 dark:text-gray-100">{label}</span>
                <span className={cn(
                  'text-[11px] px-2 py-0.5 rounded-full border font-medium',
                  isPublished
                    ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                )}>
                  {isPublished ? '🔒 Published' : '✏️ Draft'}
                </span>
                {pubDate && (
                  <span className="text-[11px] text-gray-400 ml-auto">Published {pubDate}</span>
                )}
              </div>

              {/* Schedule table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900">
                      <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 min-w-[150px]">
                        Staff
                      </th>
                      {workDates.map(d => (
                        <th key={fmt(d)} className="px-2 py-2 text-center text-[11px] font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 min-w-[60px]">
                          {DAY_NAMES[d.getDay()]}<br />
                          <span className="font-normal text-[10px]">{d.getDate()} {MONTH_NAMES[d.getMonth()]}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map(m => (
                      <tr key={m.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">
                          {m.name}
                          {m.title && <span className="ml-1.5 text-[11px] text-gray-400 font-normal">{m.title}</span>}
                        </td>
                        {workDates.map(d => {
                          const dateStr = fmt(d)
                          const st = getStatus(m.id, dateStr, m, entryMap)
                          return (
                            <td key={dateStr} className="px-1 py-2 text-center border-r border-gray-100 dark:border-gray-800 last:border-r-0">
                              {st ? (
                                <span className={cn('inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold font-mono', STATUS_CLS[st])}>
                                  {STATUS_META[st].short}
                                </span>
                              ) : (
                                <span className="text-gray-300 dark:text-gray-600 text-[10px]">—</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}

                    {/* Count row */}
                    <tr className="bg-gray-50 dark:bg-gray-900/60">
                      <td className="px-4 py-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                        In office
                      </td>
                      {workDates.map(d => {
                        const dateStr = fmt(d)
                        const count = staff.filter(m => {
                          const st = getStatus(m.id, dateStr, m, entryMap)
                          return st === 'office' || st === 'other'
                        }).length
                        return (
                          <td key={dateStr} className={cn(
                            'text-center py-2 text-[12px] font-bold font-mono border-r border-gray-100 dark:border-gray-800 last:border-r-0',
                            count >= seats ? 'text-red-600 dark:text-red-400' : 'text-[var(--green)]'
                          )}>
                            {count}/{seats}
                          </td>
                        )
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

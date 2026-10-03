import { cn } from '@/lib/utils'
import type { Staff, Status } from '@/types/database'
import type { EntryCache } from '@/lib/schedule'
import { getScheduleStatus, todayDate, fmt } from '@/lib/schedule'
import { STATUS_ICON } from '@/components/ui/StatusChip'
import { Gauge } from '@/components/ui/Gauge'
import { capacityState } from './ScheduleTable'

interface Props {
  staff: Staff[]
  workDays: Date[]
  /** Current seats setting */
  seats: number
  /** Seat count for a given day (published weeks keep their own snapshot) */
  seatsFor: (day: Date) => number
  cache: EntryCache
  holidayMap: Record<string, string>
}

const CAP_VAR = { ok: 'var(--cap-ok)', full: 'var(--cap-full)', over: 'var(--cap-over)' } as const
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const SPLIT: { key: Status; label: string; color: string }[] = [
  { key: 'office', label: 'Office',     color: 'var(--office)' },
  { key: 'other',  label: 'Other site', color: 'var(--other)'  },
  { key: 'remote', label: 'Remote',     color: 'var(--remote)' },
  { key: 'leave',  label: 'Leave',      color: 'var(--leave)'  },
]

export function KPIRow({ staff, workDays, seats, seatsFor, cache, holidayMap }: Props) {
  const today = todayDate()
  const days = workDays.filter(d => !holidayMap[fmt(d)])

  const perDay = days.map(d => {
    const counts: Record<Status, number> = { office: 0, remote: 0, leave: 0, other: 0 }
    staff.forEach(m => { const st = getScheduleStatus(m, d, cache); if (st) counts[st]++ })
    return { day: d, counts, seats: seatsFor(d) }
  })

  // Hero: today if it's in view, otherwise the busiest day of the period
  const todayRow = perDay.find(p => p.day.getTime() === today.getTime())
  const busiest = perDay.reduce<typeof perDay[number] | undefined>((a, b) => (!a || b.counts.office > a.counts.office ? b : a), undefined)
  const hero = todayRow ?? busiest
  const heroLabel = todayRow ? 'Today' : busiest ? `Busiest · ${DAY[busiest.day.getDay()]} ${busiest.day.getDate()}` : 'Today'
  const heroOffice = hero?.counts.office ?? 0
  const heroSeats = hero?.seats ?? seats
  const heroState = capacityState(heroOffice, heroSeats)

  const totals: Record<Status, number> = { office: 0, remote: 0, leave: 0, other: 0 }
  let totalSeats = 0
  perDay.forEach(p => { (Object.keys(totals) as Status[]).forEach(k => { totals[k] += p.counts[k] }); totalSeats += p.seats })
  const utilPct = totalSeats > 0 ? Math.round(totals.office / totalSeats * 100) : 0
  const totalAll = totals.office + totals.remote + totals.leave + totals.other

  return (
    <div className="grid gap-3 md:grid-cols-3 mb-5">
      {/* Hero gauge */}
      <section className="panel panel-glow p-5 flex items-center gap-5 enter" aria-label={`${heroLabel}: ${heroOffice} of ${heroSeats} seats in use`}>
        <Gauge value={heroOffice} max={heroSeats} color={CAP_VAR[heroState]} />
        <div className="min-w-0">
          <div className="eyebrow">{heroLabel}</div>
          <div className="mt-1 font-display text-[30px] font-semibold leading-none tabular-nums text-ink">
            {heroOffice}<span className="text-ink-3 text-[20px]"> / {heroSeats}</span>
          </div>
          <div className="mt-1.5 text-[12.5px] text-ink-2">
            seats in use
            {heroState !== 'ok' && (
              <span className="ml-1.5 font-semibold" style={{ color: CAP_VAR[heroState] }}>
                · {heroState === 'over' ? `${heroOffice - heroSeats} over` : 'full'}
              </span>
            )}
          </div>
          {hero && (
            <div className="mt-2 text-[12px] text-ink-3">
              {hero.counts.remote} remote · {hero.counts.other} other site · {hero.counts.leave} leave
            </div>
          )}
        </div>
      </section>

      {/* Utilization + per-day sparkline */}
      <section className="panel p-5 enter" style={{ animationDelay: '40ms' }} aria-label={`Seat utilization ${utilPct}% for this period`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="eyebrow">Seat utilization</div>
            <div className="mt-1 font-display text-[30px] font-semibold leading-none tabular-nums text-ink">{utilPct}%</div>
            <div className="mt-1.5 text-[12.5px] text-ink-2">{totals.office} office days of {totalSeats} seats</div>
          </div>
          <div className="text-right text-[12px] text-ink-3">{seats} seats</div>
        </div>
        <div className="mt-4 flex items-end gap-1 h-10" aria-hidden>
          {perDay.map(p => {
            const st = capacityState(p.counts.office, p.seats)
            const h = p.seats > 0 ? Math.max(6, Math.min(100, p.counts.office / p.seats * 100)) : 6
            return (
              <div key={fmt(p.day)} className="flex-1 min-w-[3px] rounded-t-[3px] transition-[height] duration-300"
                style={{ height: `${h}%`, background: CAP_VAR[st], opacity: st === 'ok' ? 0.75 : 1 }}
                title={`${DAY[p.day.getDay()]} ${p.day.getDate()}: ${p.counts.office}/${p.seats}`}
              />
            )
          })}
        </div>
      </section>

      {/* Split */}
      <section className="panel p-5 enter" style={{ animationDelay: '80ms' }} aria-label="Where people work this period">
        <div className="eyebrow">This period</div>
        <div className="mt-3 flex h-2.5 rounded-full overflow-hidden gap-[2px] bg-[var(--panel-2)]" aria-hidden>
          {SPLIT.map(s => totals[s.key] > 0 && (
            <div key={s.key} style={{ width: `${totals[s.key] / Math.max(1, totalAll) * 100}%`, background: s.color }} />
          ))}
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
          {SPLIT.map(s => {
            const Icon = STATUS_ICON[s.key]
            return (
              <li key={s.key} className="flex items-center gap-2 text-[12.5px] text-ink-2">
                <span className={cn('grid place-items-center w-6 h-6 rounded-md', `chip-${s.key}`)}><Icon size={13} aria-hidden /></span>
                <span className="flex-1">{s.label}</span>
                <span className="font-mono tabular-nums font-semibold text-ink">{totals[s.key]}</span>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

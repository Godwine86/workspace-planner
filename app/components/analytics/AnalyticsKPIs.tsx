import { CalendarCheck, Users } from 'lucide-react'
import { Gauge } from '@/components/ui/Gauge'

interface Props {
  totalOffice: number
  totalRemote: number
  totalOther: number
  avgDailyOffice: number
  avgUtilization: number
  publishedWorkDays: number
}

export function AnalyticsKPIs({ totalOffice, totalRemote, totalOther, avgDailyOffice, avgUtilization, publishedWorkDays }: Props) {
  const total = totalOffice + totalOther + totalRemote
  const split = [
    { label: 'Office',     value: totalOffice, color: 'var(--office)' },
    { label: 'Other site', value: totalOther,  color: 'var(--other)'  },
    { label: 'Remote',     value: totalRemote, color: 'var(--remote)' },
  ]
  const utilColor = avgUtilization > 100 ? 'var(--cap-over)' : avgUtilization >= 90 ? 'var(--cap-full)' : 'var(--cap-ok)'

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 mb-5">
      <section className="panel panel-glow p-5 flex items-center gap-5 xl:col-span-1 enter" aria-label={`Average seat utilization ${avgUtilization}%`}>
        <Gauge value={avgUtilization} max={100} color={utilColor} />
        <div>
          <div className="eyebrow">Avg seat utilization</div>
          <div className="mt-1 font-display text-[32px] font-semibold leading-none tabular-nums text-ink">{avgUtilization}%</div>
          <div className="mt-1.5 text-[12.5px] text-ink-2">of available seats, per day</div>
        </div>
      </section>

      <section className="panel p-5 enter" style={{ animationDelay: '40ms' }}>
        <div className="flex items-center justify-between"><span className="eyebrow">Avg daily in office</span><Users size={16} className="text-ink-3" aria-hidden /></div>
        <div className="mt-2 font-display text-[32px] font-semibold leading-none tabular-nums text-ink">{avgDailyOffice}</div>
        <div className="mt-1.5 text-[12.5px] text-ink-2">people per working day</div>
      </section>

      <section className="panel p-5 enter" style={{ animationDelay: '80ms' }} aria-label="Where people worked">
        <div className="eyebrow">Where people worked</div>
        <div className="mt-3 flex h-2.5 rounded-full overflow-hidden gap-[2px] bg-[var(--panel-2)]" aria-hidden>
          {split.map(s => s.value > 0 && <div key={s.label} style={{ width: `${s.value / Math.max(1, total) * 100}%`, background: s.color }} />)}
        </div>
        <ul className="mt-3 flex flex-col gap-1.5">
          {split.map(s => (
            <li key={s.label} className="flex items-center gap-2 text-[12.5px] text-ink-2">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
              <span className="flex-1">{s.label}</span>
              <span className="font-mono tabular-nums font-semibold text-ink">{s.value}</span>
              <span className="font-mono tabular-nums text-ink-3 w-10 text-right">{total ? Math.round(s.value / total * 100) : 0}%</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel p-5 enter" style={{ animationDelay: '120ms' }}>
        <div className="flex items-center justify-between"><span className="eyebrow">Published work days</span><CalendarCheck size={16} className="text-ink-3" aria-hidden /></div>
        <div className="mt-2 font-display text-[32px] font-semibold leading-none tabular-nums text-ink">{publishedWorkDays}</div>
        <div className="mt-1.5 text-[12.5px] text-ink-2">holidays excluded</div>
      </section>
    </div>
  )
}

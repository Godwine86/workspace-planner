interface Props {
  totalOffice: number
  totalRemote: number
  totalOther: number
  avgDailyOffice: number
  avgUtilization: number
  publishedWorkDays: number
}

interface CardProps { label: string; value: string | number; accent: string }

function Card({ label, value, accent }: CardProps) {
  return (
    <div
      className="relative flex flex-col gap-1 pl-5 pr-5 py-4 glass rounded-xl min-w-[130px] overflow-hidden transition-transform duration-150 hover:-translate-y-0.5"
      style={{ boxShadow: '0 2px 12px rgba(27,43,107,0.06)' }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ background: accent }} />
      <div className="text-2xl font-semibold" style={{ color: accent }}>{value}</div>
      <div className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">{label}</div>
    </div>
  )
}

export function AnalyticsKPIs({ totalOffice, totalRemote, totalOther, avgDailyOffice, avgUtilization, publishedWorkDays }: Props) {
  return (
    <div className="flex flex-wrap gap-3 mb-6">
      <Card label="Total in-office"      value={totalOffice}          accent="var(--green)"   />
      <Card label="Total other location" value={totalOther}           accent="var(--amber)"   />
      <Card label="Total remote"         value={totalRemote}          accent="var(--blue)"    />
      <Card label="Avg daily in-office"  value={avgDailyOffice}       accent="var(--primary)" />
      <Card label="Avg seat utilization" value={`${avgUtilization}%`} accent="var(--primary)" />
      <Card label="Published work days"  value={publishedWorkDays}    accent="#94a3b8"        />
    </div>
  )
}

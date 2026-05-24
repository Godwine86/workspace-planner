interface Props {
  totalOffice: number
  totalRemote: number
  avgDailyOffice: number
  avgUtilization: number
  publishedWorkDays: number
}

interface CardProps { label: string; value: string | number; color?: string }

function Card({ label, value, color }: CardProps) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl min-w-[130px]">
      <div className="text-2xl font-semibold" style={{ color }}>{value}</div>
      <div className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">{label}</div>
    </div>
  )
}

export function AnalyticsKPIs({ totalOffice, totalRemote, avgDailyOffice, avgUtilization, publishedWorkDays }: Props) {
  return (
    <div className="flex flex-wrap gap-3 mb-6">
      <Card label="Total in-office"     value={totalOffice}     color="var(--green)" />
      <Card label="Total remote"        value={totalRemote}     color="var(--blue)"  />
      <Card label="Avg daily in-office" value={avgDailyOffice}                       />
      <Card label="Avg seat utilization" value={`${avgUtilization}%`}                />
      <Card label="Published work days" value={publishedWorkDays}                    />
    </div>
  )
}

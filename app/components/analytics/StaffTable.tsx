interface StaffRow {
  id: string
  name: string
  title: string | null
  office: number
  remote: number
  leave: number
  other: number
  officePct: number
  otherPct: number
}

interface Props {
  rows: StaffRow[]
}

export function StaffTable({ rows }: Props) {
  if (!rows.length) {
    return (
      <div className="text-center text-sm text-gray-400 py-10">
        No staff data for this period.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800">
            {['Name', 'Role', 'Office days', 'Other location', 'Remote days', 'Leave days', 'Office %', 'Other %'].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide bg-gray-50 dark:bg-gray-900">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50">
              <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{row.name}</td>
              <td className="px-4 py-2.5 text-gray-400 text-[12px]">{row.title ?? '—'}</td>
              <td className="px-4 py-2.5 text-center font-mono text-[var(--green)] font-medium">{row.office}</td>
              <td className="px-4 py-2.5 text-center font-mono text-[var(--amber)] font-medium">{row.other || '—'}</td>
              <td className="px-4 py-2.5 text-center font-mono text-[var(--blue)] font-medium">{row.remote}</td>
              <td className="px-4 py-2.5 text-center font-mono text-gray-400">{row.leave}</td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden min-w-[60px]">
                    <div className="h-full bg-[var(--green)] rounded-full" style={{ width: `${row.officePct}%` }} />
                  </div>
                  <span className="font-mono text-[11px] text-gray-500 w-8 text-right">{row.officePct}%</span>
                </div>
              </td>
              <td className="px-4 py-2.5">
                {row.otherPct > 0 ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden min-w-[60px]">
                      <div className="h-full bg-[var(--amber)] rounded-full" style={{ width: `${row.otherPct}%` }} />
                    </div>
                    <span className="font-mono text-[11px] text-gray-500 w-8 text-right">{row.otherPct}%</span>
                  </div>
                ) : (
                  <span className="text-gray-300 dark:text-gray-600 text-[11px] font-mono">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

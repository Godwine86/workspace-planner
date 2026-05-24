import { createClient } from '@/lib/supabase/server'
import { HistoryView } from '@/components/history/HistoryView'
import type { WeekData } from '@/components/history/HistoryView'
import { fmt } from '@/lib/schedule'

export default async function HistoryPage() {
  const supabase = await createClient()

  const [
    { data: plans },
    { data: staff },
    { data: groups },
    { data: settings },
    { data: holidays },
  ] = await Promise.all([
    supabase.from('week_plans').select('week_start,status,published_at').order('week_start', { ascending: false }).limit(52),
    supabase.from('staff').select('*').order('sort_order'),
    supabase.from('groups').select('*').order('sort_order'),
    supabase.from('app_settings').select('*'),
    supabase.from('holidays').select('date,name'),
  ])

  const holidayMap: Record<string, string> = {}
  ;(holidays as { date: string; name: string | null }[] | null ?? []).forEach(h => {
    holidayMap[h.date] = h.name ?? ''
  })

  const seats = parseInt(
    ((settings as { key: string; value: string }[] | null) ?? []).find(s => s.key === 'seats')?.value ?? '7'
  ) || 7

  // Fetch entries for all weeks in parallel
  const weekList = (plans as { week_start: string; status: string; published_at: string | null }[] | null) ?? []

  const weekEntries = await Promise.all(
    weekList.map(async plan => {
      const ws = new Date(plan.week_start + 'T00:00:00')
      const we = new Date(ws); we.setDate(ws.getDate() + 4)
      const { data: entries } = await supabase
        .from('schedule_entries')
        .select('staff_id,entry_date,status')
        .gte('entry_date', plan.week_start)
        .lte('entry_date', fmt(we))
      return {
        weekStart: plan.week_start,
        status: plan.status as 'published' | 'draft',
        publishedAt: plan.published_at,
        entries: (entries as { staff_id: string; entry_date: string; status: string }[] | null) ?? [],
      } satisfies WeekData
    })
  )

  return (
    <HistoryView
      weeks={weekEntries}
      staff={(staff as Parameters<typeof HistoryView>[0]['staff']) ?? []}
      groups={(groups as Parameters<typeof HistoryView>[0]['groups']) ?? []}
      seats={seats}
      holidayMap={holidayMap}
    />
  )
}

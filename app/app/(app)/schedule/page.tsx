import { createClient } from '@/lib/supabase/server'
import { ScheduleView } from '@/components/schedule/ScheduleView'
import type { Role } from '@/types/database'

export default async function SchedulePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: groups },
    { data: staff },
    { data: settings },
    { data: weekPlans },
    { data: holidays },
    { data: roleRow },
  ] = await Promise.all([
    supabase.from('groups').select('*').order('sort_order'),
    supabase.from('staff').select('*').order('sort_order'),
    supabase.from('app_settings').select('*'),
    supabase.from('week_plans').select('week_start,status'),
    supabase.from('holidays').select('date,name').order('date'),
    supabase.from('user_roles').select('role').eq('user_id', user?.id ?? '').maybeSingle(),
  ])

  const settingRows = (settings ?? []) as { key: string; value: string }[]
  const seats = parseInt(settingRows.find(s => s.key === 'seats')?.value ?? '7') || 7

  const weekPlanMap: Record<string, { status: string }> = {}
  ;(weekPlans as { week_start: string; status: string }[] ?? []).forEach(p => { weekPlanMap[p.week_start] = { status: p.status } })

  const holidayMap: Record<string, string> = {}
  ;(holidays as { date: string; name: string | null }[] ?? []).forEach(h => { holidayMap[h.date] = h.name ?? '' })

  const role: Role = ((roleRow as { role: Role } | null)?.role) ?? 'viewer'

  return (
    <ScheduleView
      staff={staff ?? []}
      groups={groups ?? []}
      seats={seats}
      weekPlans={weekPlanMap}
      holidayMap={holidayMap}
      role={role}
    />
  )
}

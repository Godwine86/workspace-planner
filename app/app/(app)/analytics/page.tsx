import { createClient } from '@/lib/supabase/server'
import { AnalyticsView } from '@/components/analytics/AnalyticsView'

export default async function AnalyticsPage() {
  const supabase = await createClient()

  const [
    { data: groups },
    { data: staff },
    { data: settings },
  ] = await Promise.all([
    supabase.from('groups').select('*').order('sort_order'),
    supabase.from('staff').select('*').order('sort_order'),
    supabase.from('app_settings').select('*'),
  ])

  const seats = parseInt(
    ((settings as { key: string; value: string }[] | null) ?? []).find(s => s.key === 'seats')?.value ?? '7'
  ) || 7

  return (
    <AnalyticsView
      staff={(staff as Parameters<typeof AnalyticsView>[0]['staff']) ?? []}
      groups={(groups as Parameters<typeof AnalyticsView>[0]['groups']) ?? []}
      seats={seats}
    />
  )
}

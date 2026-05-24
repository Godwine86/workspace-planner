import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsView } from '@/components/settings/SettingsView'
import type { Role } from '@/types/database'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: roleRow },
    { data: staff },
    { data: groups },
    { data: holidays },
    { data: settings },
  ] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', user?.id ?? '').maybeSingle(),
    supabase.from('staff').select('*').order('sort_order'),
    supabase.from('groups').select('*').order('sort_order'),
    supabase.from('holidays').select('id,date,name').order('date'),
    supabase.from('app_settings').select('*'),
  ])

  const role: Role = ((roleRow as { role: Role } | null)?.role) ?? 'viewer'
  if (role !== 'admin') redirect('/schedule')

  const seats = parseInt(
    ((settings as { key: string; value: string }[] | null) ?? []).find(s => s.key === 'seats')?.value ?? '7'
  ) || 7

  return (
    <SettingsView
      staff={(staff as Parameters<typeof SettingsView>[0]['staff']) ?? []}
      groups={(groups as Parameters<typeof SettingsView>[0]['groups']) ?? []}
      holidays={(holidays as Parameters<typeof SettingsView>[0]['holidays']) ?? []}
      seats={seats}
      role={role}
    />
  )
}

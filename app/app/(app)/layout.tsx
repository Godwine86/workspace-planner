import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopNav } from '@/components/TopNav'
import type { Role } from '@/types/database'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch role — re-checked on every nav so revoked access takes effect on next page load
  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  const role: Role = ((roleRow as { role: Role } | null)?.role) ?? 'viewer'

  // Names for the command palette's people search (current staff only)
  const { data: staffRows } = await supabase
    .from('staff')
    .select('id,name,role,end_date')
    .order('sort_order')
  const today = new Date().toISOString().slice(0, 10)
  const paletteStaff = ((staffRows as { id: string; name: string; role: string | null; end_date: string | null }[] | null) ?? [])
    .filter(s => !s.end_date || s.end_date >= today)
    .map(({ id, name, role }) => ({ id, name, role }))

  // Derive display name from user metadata or email
  const name: string = user.user_metadata?.full_name ?? user.user_metadata?.name ?? ''
  const email: string = user.email ?? ''

  return (
    <div className="flex flex-col min-h-screen">
      <TopNav name={name} email={email} role={role} staff={paletteStaff} />
      <main className="flex-1 flex flex-col pb-20 sm:pb-0">{children}</main>
    </div>
  )
}

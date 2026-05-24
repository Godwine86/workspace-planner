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

  // Derive display name from user metadata or email
  const name: string = user.user_metadata?.full_name ?? user.user_metadata?.name ?? ''
  const email: string = user.email ?? ''

  return (
    <div className="flex flex-col min-h-screen">
      <TopNav name={name} email={email} role={role} />
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  )
}

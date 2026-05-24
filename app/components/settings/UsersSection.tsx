'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal, Btn } from './Modal'
import type { Staff } from '@/types/database'

interface UserRow {
  id: string
  user_id: string
  role: string
  staff_id: string | null
}

interface Props {
  staff: Staff[]
}

export function UsersSection({ staff }: Props) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const supabase = createClient()

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('user_roles').select('id,user_id,role,staff_id')
    setUsers((data as UserRow[] | null) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function updateUser(userId: string, field: 'role' | 'staff_id', value: string) {
    await supabase.from('user_roles').update({ [field]: value || null }).eq('user_id', userId)
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, [field]: value || null } : u))
  }

  async function removeUser(userId: string) {
    if (!confirm("Remove this user's access?")) return
    await supabase.from('user_roles').delete().eq('user_id', userId)
    setUsers(prev => prev.filter(u => u.user_id !== userId))
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Users &amp; access</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Control who can view or edit the planner.</p>
      <p className="text-xs text-gray-400 mb-4">
        <strong>Admin</strong> — full access &nbsp;·&nbsp; <strong>Editor</strong> — edit schedule &nbsp;·&nbsp; <strong>Viewer</strong> — read only
      </p>

      <div className="mb-4 flex items-center justify-between">
        <Btn variant="primary" onClick={() => setInviteOpen(true)}>+ Invite user</Btn>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
              {['User', 'Linked staff member', 'Role', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">Loading…</td></tr>
            ) : !users.length ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">No users yet. Click Invite user to add team members.</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="px-4 py-2.5 font-mono text-[11px] text-gray-500">{u.user_id.slice(0, 12)}…</td>
                <td className="px-4 py-2.5">
                  <select
                    value={u.staff_id ?? ''}
                    onChange={e => updateUser(u.user_id, 'staff_id', e.target.value)}
                    className="text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[var(--green)]"
                  >
                    <option value="">— unlinked —</option>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={u.role}
                    onChange={e => updateUser(u.user_id, 'role', e.target.value)}
                    className="text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[var(--green)]"
                  >
                    <option value="admin">Admin</option>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <button onClick={() => removeUser(u.user_id)} className="text-xs px-2 py-1 rounded border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inviteOpen && (
        <Modal title="Invite a user" onClose={() => setInviteOpen(false)} footer={
          <Btn variant="primary" onClick={() => setInviteOpen(false)}>Got it</Btn>
        }>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            Go to <strong>Supabase → Authentication → Users → Add user → Create new user</strong>.
            Enter their email and a temporary password. Share the credentials privately.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            Once they sign in, they&apos;ll appear in the Users &amp; Access table where you can assign their role and link them to a staff member.
          </p>
        </Modal>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal, Field, Input, Select, Btn } from './Modal'
import type { Staff, Group, Status } from '@/types/database'

const WORK_DOW = [0, 1, 2, 3, 4]
const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu']
const STATUS_OPTS: { value: string; label: string }[] = [
  { value: '',       label: '— None —'      },
  { value: 'office', label: 'Office'         },
  { value: 'remote', label: 'Remote'         },
  { value: 'leave',  label: 'Leave'          },
  { value: 'other',  label: 'Other office'   },
]

interface StaffForm {
  name: string
  role: string
  group_id: string
  tgt_office: string
  tgt_remote: string
  pattern: Record<number, string>
}

function defaultForm(groups: Group[]): StaffForm {
  return {
    name: '', role: '',
    group_id: groups[0]?.id ?? '',
    tgt_office: '3', tgt_remote: '2',
    pattern: { 0: 'office', 1: 'office', 2: 'office', 3: 'office', 4: 'office' },
  }
}

interface Props {
  staff: Staff[]
  groups: Group[]
  onChange: (staff: Staff[]) => void
}

export function StaffSection({ staff, groups, onChange }: Props) {
  const [modal, setModal] = useState<null | 'add' | Staff>(null)
  const [form, setForm] = useState<StaffForm>(defaultForm(groups))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  function openAdd() { setForm(defaultForm(groups)); setError(''); setModal('add') }
  function openEdit(m: Staff) {
    setForm({
      name: m.name, role: m.role ?? '',
      group_id: m.group_id ?? groups[0]?.id ?? '',
      tgt_office: String(m.tgt_office ?? 3),
      tgt_remote: String(m.tgt_remote ?? 2),
      pattern: Object.fromEntries(WORK_DOW.map(d => [d, (m.pattern?.[d] as string) ?? ''])),
    })
    setError('')
    setModal(m)
  }

  async function save() {
    if (!form.name.trim()) { setError('Please enter a name.'); return }
    setSaving(true); setError('')
    const payload = {
      name: form.name.trim(),
      role: form.role.trim() || null,
      group_id: form.group_id || null,
      tgt_office: parseInt(form.tgt_office) || 0,
      tgt_remote: parseInt(form.tgt_remote) || 0,
      pattern: Object.fromEntries(WORK_DOW.map(d => [d, form.pattern[d] || null])),
    }

    if (modal === 'add') {
      const { data, error: err } = await supabase.from('staff').insert({ ...payload, sort_order: staff.length + 1 }).select().single()
      if (err) { setError(err.message); setSaving(false); return }
      await supabase.from('rotation_debt').insert({ staff_id: (data as Staff).id, debt: 0 })
      onChange([...staff, data as Staff])
    } else {
      const m = modal as Staff
      const { error: err } = await supabase.from('staff').update(payload).eq('id', m.id)
      if (err) { setError(err.message); setSaving(false); return }
      onChange(staff.map(s => s.id === m.id ? { ...s, ...payload } as Staff : s))
    }
    setSaving(false); setModal(null)
  }

  async function remove(m: Staff) {
    if (!confirm(`Remove "${m.name}" from the team?`)) return
    const { error: err } = await supabase.from('staff').delete().eq('id', m.id)
    if (err) { alert(err.message); return }
    onChange(staff.filter(s => s.id !== m.id))
  }

  const isAdd = modal === 'add'
  const title = isAdd ? 'Add team member' : modal ? `Edit: ${(modal as Staff).name}` : ''

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Team members</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Manage staff, their groups, and weekly office/remote targets.</p>
      <div className="mb-4">
        <Btn variant="primary" onClick={openAdd}>+ Add staff member</Btn>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
              {['Name', 'Role', 'Group', 'Office tgt/wk', 'Remote tgt/wk', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!staff.length ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No staff yet.</td></tr>
            ) : staff.map(m => {
              const g = groups.find(g => g.id === m.group_id)
              return (
                <tr key={m.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{m.name}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-[12px]">{m.role ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1.5 text-[12px]">
                      <span className="w-2 h-2 rounded-full" style={{ background: g?.color ?? '#999' }} />
                      {g?.name ?? 'Unassigned'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono text-[12px]">{m.tgt_office ?? '—'}</td>
                  <td className="px-4 py-2.5 text-center font-mono text-[12px]">{m.tgt_remote ?? '—'}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <button onClick={() => openEdit(m)} className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 mr-1.5 transition-colors">Edit</button>
                    <button onClick={() => remove(m)} className="text-xs px-2 py-1 rounded border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors">Remove</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modal !== null && (
        <Modal
          title={title}
          onClose={() => setModal(null)}
          footer={<>
            <Btn onClick={() => setModal(null)}>Cancel</Btn>
            <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : isAdd ? 'Add member' : 'Save changes'}</Btn>
          </>}
        >
          <Field label="Full name *">
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Sara Ahmed" autoFocus />
          </Field>
          <Field label="Role / title">
            <Input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. AM" />
          </Field>
          <Field label="Group">
            <Select value={form.group_id} onChange={e => setForm(f => ({ ...f, group_id: e.target.value }))}>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="🏢 Office days/wk">
              <Input type="number" min={0} max={5} value={form.tgt_office} onChange={e => setForm(f => ({ ...f, tgt_office: e.target.value }))} />
            </Field>
            <Field label="🏠 Remote days/wk">
              <Input type="number" min={0} max={5} value={form.tgt_remote} onChange={e => setForm(f => ({ ...f, tgt_remote: e.target.value }))} />
            </Field>
          </div>
          <Field label="Default pattern (Sun – Thu)">
            <div className="grid grid-cols-5 gap-1.5">
              {WORK_DOW.map(d => (
                <div key={d} className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium text-gray-500 text-center">{DOW_NAMES[d]}</span>
                  <select
                    value={form.pattern[d] ?? ''}
                    onChange={e => setForm(f => ({ ...f, pattern: { ...f.pattern, [d]: e.target.value } }))}
                    className="text-[11px] px-1 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[var(--green)]"
                  >
                    {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </Field>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </Modal>
      )}
    </div>
  )
}

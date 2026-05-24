'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal, Field, Input, Btn } from './Modal'
import type { Staff, Group } from '@/types/database'

const PALETTE = [
  '#E05C5C','#E08C5C','#D4A017','#6DB06A','#5C9BE0',
  '#8B5CE0','#E05CA8','#5CBDE0','#9E7B3C','#7A9E3C',
  '#2D6A1F','#1A5FA0','#8A5009','#6A2D6A','#2D6A6A',
]

interface Props {
  groups: Group[]
  staff: Staff[]
  onChange: (groups: Group[]) => void
}

interface GroupForm { name: string; color: string }

export function GroupsSection({ groups, staff, onChange }: Props) {
  const [modal, setModal] = useState<null | 'add' | Group>(null)
  const [form, setForm] = useState<GroupForm>({ name: '', color: PALETTE[0] })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  function openAdd() { setForm({ name: '', color: PALETTE[0] }); setError(''); setModal('add') }
  function openEdit(g: Group) { setForm({ name: g.name, color: g.color }); setError(''); setModal(g) }

  async function save() {
    if (!form.name.trim()) { setError('Please enter a name.'); return }
    setSaving(true); setError('')
    if (modal === 'add') {
      const { data, error: err } = await supabase.from('groups')
        .insert({ name: form.name.trim(), color: form.color, sort_order: groups.length + 1 }).select().single()
      if (err) { setError(err.message); setSaving(false); return }
      onChange([...groups, data as Group])
    } else {
      const g = modal as Group
      const { error: err } = await supabase.from('groups')
        .update({ name: form.name.trim(), color: form.color }).eq('id', g.id)
      if (err) { setError(err.message); setSaving(false); return }
      onChange(groups.map(x => x.id === g.id ? { ...x, name: form.name.trim(), color: form.color } : x))
    }
    setSaving(false); setModal(null)
  }

  async function remove(g: Group) {
    const cnt = staff.filter(m => m.group_id === g.id).length
    if (!confirm(`Delete group "${g.name}"?${cnt ? `\n\n${cnt} member(s) will become Unassigned.` : ''}`)) return
    const { error: err } = await supabase.from('groups').delete().eq('id', g.id)
    if (err) { alert(err.message); return }
    onChange(groups.filter(x => x.id !== g.id))
  }

  const isAdd = modal === 'add'
  const title = isAdd ? 'Add group' : modal ? `Edit group` : ''

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Groups</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Organise staff into teams for better visibility in the schedule.</p>
      <div className="mb-4"><Btn variant="primary" onClick={openAdd}>+ Add group</Btn></div>

      {!groups.length ? (
        <p className="text-sm text-gray-400">No groups yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map(g => {
            const cnt = staff.filter(m => m.group_id === g.id).length
            return (
              <div key={g.id} className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
                <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: g.color }} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{g.name}</div>
                  <div className="text-xs text-gray-400">{cnt} member{cnt !== 1 ? 's' : ''}</div>
                </div>
                <button onClick={() => openEdit(g)} className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Edit</button>
                <button onClick={() => remove(g)} className="text-xs px-2 py-1 rounded border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors">Remove</button>
              </div>
            )
          })}
        </div>
      )}

      {modal !== null && (
        <Modal title={title} onClose={() => setModal(null)} footer={<>
          <Btn onClick={() => setModal(null)}>Cancel</Btn>
          <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : isAdd ? 'Add group' : 'Save'}</Btn>
        </>}>
          <Field label="Group name *">
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Finance" autoFocus />
          </Field>
          <Field label="Colour">
            <div className="flex flex-wrap gap-2 mt-1">
              {PALETTE.map(c => (
                <button
                  key={c}
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  className="w-7 h-7 rounded-full border-2 transition-all"
                  style={{ background: c, borderColor: form.color === c ? '#000' : 'transparent', outline: form.color === c ? '2px solid rgba(0,0,0,0.15)' : 'none' }}
                />
              ))}
            </div>
          </Field>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </Modal>
      )}
    </div>
  )
}

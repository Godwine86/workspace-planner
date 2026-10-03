'use client'

import { useState } from 'react'
import { ArrowUp, ArrowDown, Pencil, UserMinus, Trash2, Plus } from 'lucide-react'
import { RowMenu } from '@/components/ui/RowMenu'
import { createClient } from '@/lib/supabase/client'
import { Modal, Field, Input, Select, Btn } from './Modal'
import { fmt, orderStaffByGroup } from '@/lib/schedule'
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
  start_date: string
  end_date: string
}

function defaultForm(groups: Group[]): StaffForm {
  return {
    name: '', role: '',
    group_id: groups[0]?.id ?? '',
    tgt_office: '3', tgt_remote: '2',
    pattern: { 0: 'office', 1: 'office', 2: 'office', 3: 'office', 4: 'office' },
    start_date: fmt(new Date()),
    end_date: '',
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
  const [reordering, setReordering] = useState(false)
  const supabase = createClient()

  function openAdd() { setForm(defaultForm(groups)); setError(''); setModal('add') }
  function openEdit(m: Staff) {
    setForm({
      name: m.name, role: m.role ?? '',
      group_id: m.group_id ?? groups[0]?.id ?? '',
      tgt_office: String(m.tgt_office ?? 3),
      tgt_remote: String(m.tgt_remote ?? 2),
      pattern: Object.fromEntries(WORK_DOW.map(d => [d, (m.pattern?.[d] as string) ?? ''])),
      start_date: m.start_date ?? fmt(new Date()),
      end_date: m.end_date ?? '',
    })
    setError('')
    setModal(m)
  }

  async function save() {
    if (!form.name.trim()) { setError('Please enter a name.'); return }
    if (form.end_date && form.start_date && form.end_date < form.start_date) {
      setError('Last working day cannot be before the start date.'); return
    }
    setSaving(true); setError('')
    const payload = {
      name: form.name.trim(),
      role: form.role.trim() || null,
      group_id: form.group_id || null,
      tgt_office: parseInt(form.tgt_office) || 0,
      tgt_remote: parseInt(form.tgt_remote) || 0,
      pattern: Object.fromEntries(WORK_DOW.map(d => [d, form.pattern[d] || null])),
      start_date: form.start_date || fmt(new Date()),
      end_date: form.end_date || null,
    }

    if (modal === 'add') {
      const nextOrder = Math.max(0, ...staff.map(s => s.sort_order ?? 0)) + 1
      const { data, error: err } = await supabase.from('staff').insert({ ...payload, sort_order: nextOrder }).select().single()
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

  // Departures keep their history: set a last working day instead of deleting
  function markLeft(m: Staff) {
    openEdit(m)
    setForm(f => ({ ...f, end_date: fmt(new Date()) }))
  }

  async function remove(m: Staff) {
    if (!confirm(
      `Permanently delete "${m.name}"?\n\n` +
      'This also deletes all of their past schedule entries, so History and Analytics ' +
      'for previous weeks will change.\n\n' +
      'If they have left the team, cancel and use "Mark as left" instead. ' +
      'Only delete someone who was added by mistake.'
    )) return
    const { error: err } = await supabase.from('staff').delete().eq('id', m.id)
    if (err) { alert(err.message); return }
    onChange(staff.filter(s => s.id !== m.id))
  }

  const ordered = orderStaffByGroup(staff, groups)

  // Move a member one place up/down within their group. Everyone is then renumbered
  // 1..n in display order so sort_order stays unique, and only changed rows are saved.
  async function move(m: Staff, dir: -1 | 1) {
    const list = [...ordered]
    const i = list.findIndex(s => s.id === m.id)
    const j = i + dir
    if (j < 0 || j >= list.length || list[j].group_id !== m.group_id) return
    ;[list[i], list[j]] = [list[j], list[i]]
    const renumbered = list.map((s, k) => ({ ...s, sort_order: k + 1 }))
    const changed = renumbered.filter(s => staff.find(o => o.id === s.id)?.sort_order !== s.sort_order)

    setReordering(true)
    const results = await Promise.all(changed.map(s =>
      supabase.from('staff').update({ sort_order: s.sort_order }).eq('id', s.id)
    ))
    setReordering(false)
    const failed = results.find(r => r.error)
    if (failed?.error) { alert('Could not save the new order: ' + failed.error.message); return }
    onChange(renumbered)
  }

  const isAdd = modal === 'add'
  const title = isAdd ? 'Add team member' : modal ? `Edit: ${(modal as Staff).name}` : ''

  return (
    <div>
      <h2 className="font-display text-[20px] font-semibold text-ink mb-1">Team members</h2>
      <p className="text-sm text-ink-3 mb-4">Manage staff, their groups, and weekly office/remote targets. Use ↑ ↓ to set the order names appear in on the Schedule and its export.</p>
      <div className="mb-4">
        <Btn variant="primary" onClick={openAdd}><Plus size={15} /> Add staff member</Btn>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[var(--panel-2)] border-b border-line">
              {['Order', 'Name', 'Role', 'Group', 'Office / wk', 'Remote / wk', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left eyebrow whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!staff.length ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-ink-3">No staff yet.</td></tr>
            ) : ordered.map((m, i) => {
              const g = groups.find(g => g.id === m.group_id)
              const canUp   = i > 0 && ordered[i - 1].group_id === m.group_id
              const canDown = i < ordered.length - 1 && ordered[i + 1].group_id === m.group_id
              return (
                <tr key={m.id} className="border-b border-line hover:bg-[var(--panel-2)] transition-colors">
                  <td className="px-2 py-2.5 whitespace-nowrap">
                    <button onClick={() => move(m, -1)} disabled={!canUp || reordering} title="Move up within group" aria-label={`Move ${m.name} up`} className="btn btn-sm btn-icon disabled:opacity-30 mr-1"><ArrowUp size={14} /></button>
                    <button onClick={() => move(m, 1)} disabled={!canDown || reordering} title="Move down within group" aria-label={`Move ${m.name} down`} className="btn btn-sm btn-icon disabled:opacity-30"><ArrowDown size={14} /></button>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-ink">
                    {m.name}
                    {m.end_date && (
                      <span className="ml-2 text-[11px] font-medium px-1.5 py-0.5 rounded-full chip-leave" title="Last working day">
                        Left · {m.end_date}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-ink-3 text-[12px]">{m.role ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1.5 text-[12px]">
                      <span className="w-2 h-2 rounded-full" style={{ background: g?.color ?? '#999' }} />
                      {g?.name ?? 'Unassigned'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono text-[12px]">{m.tgt_office ?? '—'}</td>
                  <td className="px-4 py-2.5 text-center font-mono text-[12px]">{m.tgt_remote ?? '—'}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-right">
                    <button onClick={() => openEdit(m)} className="btn btn-sm mr-1.5"><Pencil size={13} /> Edit</button>
                    <RowMenu
                      label={`More actions for ${m.name}`}
                      items={[
                        ...(!m.end_date ? [{ label: 'Mark as left', icon: UserMinus, onSelect: () => markLeft(m) }] : []),
                        { label: 'Delete permanently', icon: Trash2, onSelect: () => remove(m), danger: true },
                      ]}
                    />
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
          <Field label="Start date">
            <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
          </Field>
          <Field label="Last working day (leave empty while employed)">
            <Input type="date" value={form.end_date} min={form.start_date || undefined} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Office days / week">
              <Input type="number" min={0} max={5} value={form.tgt_office} onChange={e => setForm(f => ({ ...f, tgt_office: e.target.value }))} />
            </Field>
            <Field label="Remote days / week">
              <Input type="number" min={0} max={5} value={form.tgt_remote} onChange={e => setForm(f => ({ ...f, tgt_remote: e.target.value }))} />
            </Field>
          </div>
          <Field label="Default pattern (Sun – Thu)" group>
            <div className="grid grid-cols-5 gap-1.5">
              {WORK_DOW.map(d => (
                <div key={d} className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-ink-3 text-center" aria-hidden>{DOW_NAMES[d]}</span>
                  <select
                    aria-label={`${DOW_NAMES[d]} default`}
                    value={form.pattern[d] ?? ''}
                    onChange={e => setForm(f => ({ ...f, pattern: { ...f.pattern, [d]: e.target.value } }))}
                    className="field h-9 px-1 text-[12px]"
                  >
                    {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </Field>
          {error && <p className="text-sm text-[var(--danger-fg)]">{error}</p>}
        </Modal>
      )}
    </div>
  )
}

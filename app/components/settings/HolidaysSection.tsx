'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Field, Input, Btn } from './Modal'
import { fmt } from '@/lib/schedule'

interface Holiday { id: string; date: string; name: string | null }

interface Props {
  initialHolidays: Holiday[]
  canEdit: boolean
}

export function HolidaysSection({ initialHolidays, canEdit }: Props) {
  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [name, setName]         = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const supabase = createClient()

  async function add() {
    const from = dateFrom
    const to   = dateTo || from
    if (!from || !name.trim()) { setError('Please enter a start date and holiday name.'); return }
    if (to < from) { setError('End date must be on or after start date.'); return }

    // Build one row per calendar day in range (weekends included — schedule skips them visually)
    const rows: { date: string; name: string }[] = []
    const cursor = new Date(from + 'T00:00:00')
    const end    = new Date(to   + 'T00:00:00')
    while (cursor <= end) {
      rows.push({ date: fmt(new Date(cursor)), name: name.trim() })
      cursor.setDate(cursor.getDate() + 1)
    }

    setSaving(true); setError('')
    const { data, error: err } = await supabase.from('holidays')
      .upsert(rows, { onConflict: 'date' }).select()
    if (err) { setError(err.message); setSaving(false); return }

    const newHols = (data as Holiday[]).filter(h => !holidays.some(x => x.date === h.date))
    setHolidays(prev => [...prev, ...newHols].sort((a, b) => a.date.localeCompare(b.date)))
    setDateFrom(''); setDateTo(''); setName('')
    setSaving(false)
  }

  async function remove(h: Holiday) {
    if (!confirm(`Remove holiday on ${h.date}?`)) return
    const { error: err } = await supabase.from('holidays').delete().eq('id', h.id)
    if (err) { alert(err.message); return }
    setHolidays(prev => prev.filter(x => x.id !== h.id))
  }

  return (
    <div>
      <h2 className="font-display text-[20px] font-semibold text-ink mb-1">Public holidays</h2>
      <p className="text-sm text-ink-3 mb-4">
        Mark company-wide holidays. Those days are automatically locked for all staff in the schedule.
      </p>

      {canEdit && (
        <div className="bg-[var(--panel-2)] border border-line rounded-xl p-4 mb-5">
          <h3 className="text-sm font-semibold text-ink-2 mb-3">Add holiday</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <Field label="Start date">
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="min-w-[150px]" />
            </Field>
            <Field label="End date (same for single day)">
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="min-w-[150px]" />
            </Field>
            <Field label="Holiday name">
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Eid Al-Fitr" maxLength={60} className="min-w-[180px]" />
            </Field>
            <Btn variant="primary" onClick={add} disabled={saving}>{saving ? 'Saving…' : '+ Add holiday'}</Btn>
          </div>
          {error && <p className="text-sm text-[var(--danger-fg)] mt-2">{error}</p>}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[var(--panel-2)] border-b border-line">
              {['Date', 'Holiday name', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left eyebrow">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!holidays.length ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-ink-3">No holidays yet.</td></tr>
            ) : holidays.map(h => (
              <tr key={h.id} className="border-b border-line">
                <td className="px-4 py-2.5 font-mono text-[12px] text-ink-2">{h.date}</td>
                <td className="px-4 py-2.5 text-ink">{h.name ?? '—'}</td>
                <td className="px-4 py-2.5 text-right">
                  {canEdit && (
                    <button onClick={() => remove(h)} className="btn btn-sm btn-danger">
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

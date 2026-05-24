'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal, Field, Input, Btn } from './Modal'

interface Props { initialSeats: number }

export function GeneralSection({ initialSeats }: Props) {
  const [seats, setSeats] = useState(String(initialSeats))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [pwd, setPwd]   = useState({ new: '', confirm: '' })
  const [pwdErr, setPwdErr] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)
  const supabase = createClient()

  async function saveSeats() {
    const val = parseInt(seats) || 7
    setSaving(true); setSaved(false)
    await supabase.from('app_settings')
      .upsert({ key: 'seats', value: String(val) }, { onConflict: 'key' })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function changePassword() {
    if (pwd.new.length < 6) { setPwdErr('At least 6 characters.'); return }
    if (pwd.new !== pwd.confirm) { setPwdErr('Passwords do not match.'); return }
    setPwdSaving(true); setPwdErr('')
    const { error } = await supabase.auth.updateUser({ password: pwd.new })
    if (error) { setPwdErr(error.message); setPwdSaving(false); return }
    setPwdSaving(false); setPwdOpen(false); setPwd({ new: '', confirm: '' })
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">General settings</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Configure workspace capacity and preferences.</p>
      </div>

      {/* Seats */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
        <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-1">Office capacity</h3>
        <p className="text-xs text-gray-400 mb-3">Total desks available in the office per day.</p>
        <div className="flex items-end gap-3">
          <Field label="Available seats per day">
            <Input type="number" min={1} max={999} value={seats} onChange={e => setSeats(e.target.value)} className="max-w-[120px]" />
          </Field>
          <Btn variant="primary" onClick={saveSeats} disabled={saving}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save seats'}
          </Btn>
        </div>
      </div>

      {/* Account */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
        <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-3">Your account</h3>
        <Btn onClick={() => { setPwd({ new: '', confirm: '' }); setPwdErr(''); setPwdOpen(true) }}>
          Change password
        </Btn>
      </div>

      {pwdOpen && (
        <Modal title="Change password" onClose={() => setPwdOpen(false)} footer={<>
          <Btn onClick={() => setPwdOpen(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={changePassword} disabled={pwdSaving}>{pwdSaving ? 'Updating…' : 'Update'}</Btn>
        </>}>
          <Field label="New password">
            <Input type="password" value={pwd.new} onChange={e => setPwd(p => ({ ...p, new: e.target.value }))} placeholder="Min 6 characters" autoFocus />
          </Field>
          <Field label="Confirm password">
            <Input type="password" value={pwd.confirm} onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))} placeholder="Repeat" />
          </Field>
          {pwdErr && <p className="text-sm text-red-600 dark:text-red-400">{pwdErr}</p>}
        </Modal>
      )}
    </div>
  )
}

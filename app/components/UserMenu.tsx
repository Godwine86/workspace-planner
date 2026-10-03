'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Role } from '@/types/database'

interface Props {
  name: string
  email: string
  role: Role
}

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
}

export function UserMenu({ name, email, role }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  // Initials from name or email
  const initials = name
    ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : email[0].toUpperCase()

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onClickOutside); document.removeEventListener('keydown', onEsc) }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-9 h-9 rounded-full text-white text-xs font-semibold flex items-center justify-center ring-2 ring-[var(--panel-solid)] hover:brightness-110 transition"
        style={{ background: 'var(--brand-grad)', boxShadow: '0 0 0 3px var(--accent-soft)' }}
        title={email}
        aria-label={`Account menu for ${name || email}`}
        aria-expanded={open}
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-60 panel bg-[var(--panel-solid)] z-50 overflow-hidden enter">
          <div className="px-4 py-3 border-b border-line">
            <p className="text-sm font-medium text-ink truncate">{name || email}</p>
            <p className="text-xs text-ink-3 truncate">{email}</p>
            <span className="mt-1.5 inline-flex h-6 items-center px-2 rounded-full text-[11px] font-semibold chip-office">
              {ROLE_LABEL[role]}
            </span>
          </div>
          <div className="p-1.5">
            <button
              onClick={signOut}
              className="w-full flex items-center gap-2 px-3 h-9 rounded-lg text-left text-sm text-[var(--danger-fg)] hover:bg-[var(--danger-bg)] transition-colors"
            >
              <LogOut size={15} aria-hidden /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

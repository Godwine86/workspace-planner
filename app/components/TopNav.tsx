'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, BarChart2, Clock, Settings, Search } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'
import { CommandPalette, type PaletteStaff } from './CommandPalette'
import { cn } from '@/lib/utils'
import type { Role } from '@/types/database'

const TABS = [
  { href: '/schedule',  label: 'Schedule',  icon: Calendar  },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/history',   label: 'History',   icon: Clock     },
] as const

interface Props {
  name: string
  email: string
  role: Role
  staff: PaletteStaff[]
}

export function TopNav({ name, email, role, staff }: Props) {
  const pathname = usePathname()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const closePalette = useCallback(() => setPaletteOpen(false), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(o => !o) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const tabs = role === 'admin'
    ? [...TABS, { href: '/settings', label: 'Settings', icon: Settings } as const]
    : TABS

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-line bg-[var(--panel)] backdrop-blur-xl backdrop-saturate-150" aria-label="Main">
        <div className="flex items-center gap-3 px-4 sm:px-6 h-[60px] max-w-[1600px] mx-auto">
          {/* Brand */}
          <Link href="/schedule" className="flex items-center gap-2.5 shrink-0 mr-2 sm:mr-4" aria-label="Workspace Planner home">
            <span className="grid place-items-center w-8 h-8 rounded-[10px] text-white text-[10.5px] font-bold tracking-tight"
              style={{ background: 'var(--brand-grad)', boxShadow: '0 4px 16px -4px var(--glow)' }}>
              CDU
            </span>
            <span className="font-display text-[15px] font-semibold tracking-tight text-ink whitespace-nowrap">
              Workspace <span className="text-ink-3 font-medium">Planner</span>
            </span>
          </Link>

          {/* Tabs (desktop) */}
          <div className="hidden sm:flex items-center gap-1 flex-1">
            {tabs.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex items-center gap-2 h-9 px-3.5 rounded-[10px] text-[13.5px] transition-colors duration-150',
                    active ? 'bg-accent-soft text-ink font-semibold' : 'text-ink-3 hover:text-ink hover:bg-[var(--panel-2)]',
                  )}
                >
                  <Icon size={15} className={active ? 'text-accent' : undefined} aria-hidden />
                  {label}
                  {active && <span className="absolute -bottom-[13px] left-3 right-3 h-[2px] rounded-full" style={{ background: 'var(--brand-grad)', boxShadow: '0 0 12px var(--glow)' }} />}
                </Link>
              )
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <button
              onClick={() => setPaletteOpen(true)}
              className="btn h-9 gap-2 text-ink-3 sm:w-56 sm:justify-start"
              aria-label="Search or jump to (Command K)"
            >
              <Search size={15} aria-hidden />
              <span className="hidden sm:inline flex-1 text-left">Search or jump to…</span>
              <span className="hidden sm:inline-flex gap-0.5"><span className="kbd">⌘</span><span className="kbd">K</span></span>
            </button>
            <ThemeToggle />
            <UserMenu name={name} email={email} role={role} />
          </div>
        </div>
        <div className="h-[2px] w-full opacity-80" style={{ background: 'var(--rainbow)' }} />
      </nav>

      {/* Bottom tab bar (phones) */}
      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-50 border-t border-line bg-[var(--panel)] backdrop-blur-xl backdrop-saturate-150 pb-[env(safe-area-inset-bottom)]"
        aria-label="Main (mobile)"
      >
        <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn('flex flex-col items-center justify-center gap-1 h-16 text-[11px] font-medium', active ? 'text-accent' : 'text-ink-3')}
              >
                <span className={cn('grid place-items-center w-12 h-7 rounded-full transition-colors duration-150', active && 'bg-accent-soft')}>
                  <Icon size={18} aria-hidden />
                </span>
                {label}
              </Link>
            )
          })}
        </div>
      </nav>

      {paletteOpen && <CommandPalette staff={staff} isAdmin={role === 'admin'} onClose={closePalette} />}
    </>
  )
}

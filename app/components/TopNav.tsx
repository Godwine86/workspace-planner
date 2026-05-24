'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calendar, BarChart2, Clock, Settings } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'
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
}

export function TopNav({ name, email, role }: Props) {
  const pathname = usePathname()

  const tabs = role === 'admin'
    ? [...TABS, { href: '/settings', label: 'Settings', icon: Settings } as const]
    : TABS

  return (
    <nav className="sticky top-0 z-50 flex flex-col glass dark:glass border-b border-white/20 dark:border-white/5"
      style={{ boxShadow: '0 1px 24px rgba(27,43,107,0.08)' }}>
      {/* Main bar */}
      <div className="flex items-center gap-0 px-7 h-[52px]">
        {/* Brand */}
        <div className="flex items-center gap-2.5 pr-5 border-r border-gray-200/60 dark:border-white/10 mr-4 shrink-0">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="28" height="28" rx="6" fill="var(--primary)" />
            <text x="14" y="20" textAnchor="middle" fontFamily="DM Sans, Arial, sans-serif" fontWeight="700" fontSize="11" fill="white" letterSpacing="-0.5">CDU</text>
          </svg>
          <span className="text-[13.5px] font-semibold text-[var(--primary)] dark:text-blue-200 whitespace-nowrap tracking-tight">
            Workspace Planner
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-px flex-1">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] transition-all duration-150',
                  active
                    ? 'font-semibold text-[var(--primary)] dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-100'
                )}
              >
                <Icon size={13} />
                {label}
                {active && (
                  <span
                    className="absolute bottom-[-1px] left-1.5 right-1.5 h-[2.5px] rounded-t-sm"
                    style={{ background: 'var(--primary)' }}
                  />
                )}
              </Link>
            )
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <ThemeToggle />
          <UserMenu name={name} email={email} role={role} />
        </div>
      </div>

      {/* Rainbow underline stripe */}
      <div className="h-[3px] w-full" style={{ background: 'var(--rainbow)' }} />
    </nav>
  )
}

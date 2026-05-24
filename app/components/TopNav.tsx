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
    <nav className="sticky top-0 z-50 h-[52px] flex items-center gap-0 px-7 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800" style={{ boxShadow: 'inset 0 -2px 0 -1px rgba(45,106,31,0.4)' }}>
      {/* Brand */}
      <div className="flex items-center gap-2 pr-5 border-r border-gray-200 dark:border-gray-800 mr-4 shrink-0">
        <span className="w-2 h-2 rounded-full bg-[var(--green)]" />
        <span className="text-[13.5px] font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
          CDU Workspace Planner
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
                'relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] transition-colors',
                active
                  ? 'font-semibold text-[var(--green)] dark:text-green-400'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
              )}
            >
              <Icon size={13} />
              {label}
              {active && (
                <span className="absolute bottom-[-1px] left-1.5 right-1.5 h-0.5 rounded-t-sm bg-current" />
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
    </nav>
  )
}

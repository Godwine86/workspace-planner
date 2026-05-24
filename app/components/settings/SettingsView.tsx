'use client'

import { useState } from 'react'
import { Users, Tag, Shield, CalendarDays, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StaffSection } from './StaffSection'
import { GroupsSection } from './GroupsSection'
import { UsersSection } from './UsersSection'
import { HolidaysSection } from './HolidaysSection'
import { GeneralSection } from './GeneralSection'
import type { Staff, Group, Role } from '@/types/database'

const NAV = [
  { id: 'staff',    label: 'Staff',           icon: Users       },
  { id: 'groups',   label: 'Groups',          icon: Tag         },
  { id: 'users',    label: 'Users & Access',  icon: Shield      },
  { id: 'holidays', label: 'Holidays',        icon: CalendarDays },
  { id: 'general',  label: 'General',         icon: Settings    },
] as const

type Section = typeof NAV[number]['id']

interface Holiday { id: string; date: string; name: string | null }

interface Props {
  staff: Staff[]
  groups: Group[]
  holidays: Holiday[]
  seats: number
  role: Role
}

export function SettingsView({ staff: initialStaff, groups: initialGroups, holidays, seats, role }: Props) {
  const [section, setSection] = useState<Section>('staff')
  const [staff, setStaff]   = useState(initialStaff)
  const [groups, setGroups] = useState(initialGroups)
  const canEdit = role === 'admin'

  return (
    <div className="flex flex-1 min-h-0">
      {/* Sidebar */}
      <aside className="w-48 shrink-0 border-r border-gray-200 dark:border-gray-800 py-4">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={cn(
              'w-full flex items-center gap-2.5 px-5 py-2.5 text-[13px] font-medium text-left transition-colors border-r-2',
              section === id
                ? 'text-[var(--green)] bg-green-50 dark:bg-green-950/30 border-r-[var(--green)]'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 border-r-transparent hover:text-gray-900 dark:hover:text-gray-100'
            )}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-8 py-6">
        {section === 'staff' && (
          <StaffSection staff={staff} groups={groups} onChange={setStaff} />
        )}
        {section === 'groups' && (
          <GroupsSection groups={groups} staff={staff} onChange={setGroups} />
        )}
        {section === 'users' && (
          <UsersSection staff={staff} />
        )}
        {section === 'holidays' && (
          <HolidaysSection initialHolidays={holidays} canEdit={canEdit} />
        )}
        {section === 'general' && (
          <GeneralSection initialSeats={seats} />
        )}
      </main>
    </div>
  )
}

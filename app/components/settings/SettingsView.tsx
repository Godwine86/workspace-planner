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
    <div className="flex flex-col md:flex-row flex-1 min-h-0 w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-5 gap-5">
      {/* Section nav: sidebar on desktop, scrollable tabs on small screens */}
      <nav aria-label="Settings sections" className="md:w-56 shrink-0">
        <span className="eyebrow hidden md:block px-3 mb-2">Settings</span>
        <div className="flex md:flex-col gap-1 overflow-x-auto pb-1 md:pb-0">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = section === id
            return (
              <button
                key={id}
                onClick={() => setSection(id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'shrink-0 flex items-center gap-2.5 h-10 px-3 rounded-[10px] text-[13.5px] font-medium text-left transition-colors duration-150',
                  active ? 'bg-accent-soft text-ink' : 'text-ink-3 hover:text-ink hover:bg-[var(--panel-2)]',
                )}
              >
                <Icon size={16} className={active ? 'text-accent' : undefined} aria-hidden />
                {label}
              </button>
            )
          })}
        </div>
      </nav>

      <div className="flex-1 min-w-0 panel p-5 sm:p-7 enter" key={section}>
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
      </div>
    </div>
  )
}

import { Building2, House, TreePalm, MapPin, PartyPopper } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STATUS_META } from '@/lib/schedule'
import type { Status } from '@/types/database'

export const STATUS_ICON: Record<Status, LucideIcon> = {
  office: Building2,
  remote: House,
  leave:  TreePalm,
  other:  MapPin,
}

export const STATUS_HOTKEY: Record<Status, string> = { office: 'O', remote: 'R', leave: 'L', other: 'X' }

interface Props {
  status: Status | 'holiday' | null
  /** full: icon + word; short: icon + 3-letter code; icon: icon only */
  variant?: 'full' | 'short' | 'icon'
  className?: string
  title?: string
}

/** Status shown as icon + text so it never relies on colour alone. */
export function StatusChip({ status, variant = 'full', className, title }: Props) {
  if (!status) {
    return <span className={cn('chip chip-empty h-7 px-2', className)} title={title ?? 'Not set'} aria-label="Not set">·</span>
  }
  const Icon = status === 'holiday' ? PartyPopper : STATUS_ICON[status]
  const label = status === 'holiday' ? 'Holiday' : STATUS_META[status].label
  const text = variant === 'full' ? label : variant === 'short' ? (status === 'holiday' ? 'HOL' : STATUS_META[status].short) : null
  return (
    <span className={cn('chip h-7', `chip-${status}`, text ? 'px-2' : 'w-7', className)} title={title ?? label} aria-label={label}>
      <Icon size={13} strokeWidth={2.2} aria-hidden />
      {text}
    </span>
  )
}

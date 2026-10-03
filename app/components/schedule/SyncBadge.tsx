import { CloudCheck, CloudOff, LoaderCircle, Cloud } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SyncState = 'idle' | 'syncing' | 'ok' | 'error'

interface Props {
  state: SyncState
  message: string
}

/** Compact save-status pill; announced politely to screen readers. */
export function SyncBadge({ state, message }: Props) {
  const Icon = state === 'syncing' ? LoaderCircle : state === 'error' ? CloudOff : state === 'ok' ? CloudCheck : Cloud
  return (
    <span
      role="status"
      aria-live="polite"
      title={message}
      className={cn(
        'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[12px] max-w-[320px]',
        state === 'error' ? 'border-[var(--danger-edge)] bg-[var(--danger-bg)] text-[var(--danger-fg)]' : 'border-line bg-[var(--panel)] text-ink-3',
      )}
    >
      <Icon size={13} className={cn('shrink-0', state === 'syncing' && 'animate-spin', state === 'ok' && 'text-[var(--office-fg)]')} aria-hidden />
      <span className="truncate">{message}</span>
    </span>
  )
}

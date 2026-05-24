import { cn } from '@/lib/utils'

export type SyncState = 'idle' | 'syncing' | 'ok' | 'error'

interface Props {
  state: SyncState
  message: string
}

export function SyncBadge({ state, message }: Props) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 mb-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 border-l-[3px] border-l-[var(--green)] rounded-lg text-xs text-gray-500 dark:text-gray-400">
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full flex-shrink-0',
          state === 'syncing' && 'bg-amber-400 animate-pulse',
          state === 'ok'      && 'bg-[var(--green)]',
          state === 'error'   && 'bg-red-500',
          state === 'idle'    && 'bg-gray-300',
        )}
      />
      {message}
    </div>
  )
}

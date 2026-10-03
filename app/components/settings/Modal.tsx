'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface Props {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}

export function Modal({ title, onClose, children, footer }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md panel panel-glow bg-[var(--panel-solid)] overflow-hidden enter">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-display text-[16px] font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="btn btn-sm btn-icon" aria-label="Close">
            <X size={15} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-line flex justify-end gap-2 bg-[var(--panel-2)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/** Labelled field. Wraps a single control in <label>; `group` is for several controls. */
export function Field({ label, hint, group, children }: { label: string; hint?: string; group?: boolean; children: React.ReactNode }) {
  const body = (
    <>
      <span className="block text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-3">{hint}</span>}
    </>
  )
  return group
    ? <div role="group" aria-label={label} className="block space-y-1.5">{body}</div>
    : <label className="block space-y-1.5">{body}</label>
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`field disabled:opacity-50 ${className ?? ''}`} />
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`field ${className ?? ''}`} />
}

export function Btn({ variant = 'secondary', className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const cls = variant === 'primary' ? 'btn-primary' : variant === 'danger' ? 'btn-danger' : ''
  return <button {...props} className={`btn ${cls} ${className ?? ''}`} />
}

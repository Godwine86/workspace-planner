'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm panel panel-glow p-8 enter">
        <div className="flex flex-col items-center gap-3 text-center">
          <span
            className="grid place-items-center w-12 h-12 rounded-2xl text-white text-[13px] font-bold tracking-tight"
            style={{ background: 'var(--brand-grad)', boxShadow: '0 10px 30px -8px var(--glow)' }}
          >
            CDU
          </span>
          <div>
            <h1 className="font-display text-[22px] font-semibold tracking-tight text-ink">Workspace Planner</h1>
            <p className="mt-1 text-sm text-ink-3">Sign in to plan the office week</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-ink-2" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="field"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-ink-2" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="field"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm rounded-lg px-3 py-2 border border-[var(--danger-edge)] bg-[var(--danger-bg)] text-[var(--danger-fg)]">{error}</p>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary w-full h-11 text-[14px]">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

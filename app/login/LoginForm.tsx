'use client'

import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'

const HOME_BY_ROLE: Record<string, string> = {
  driver: '/driver',
  company_admin: '/admin',
  union_admin: '/union/companies',
}

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const searchParams = useSearchParams()

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'ログインに失敗しました')
        return
      }
      if (json.mustChangePassword) {
        window.location.href = '/account/password'
        return
      }
      const next = searchParams.get('next')
      window.location.href = next || HOME_BY_ROLE[json.role] || '/driver'
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="field">
        <label>メールアドレス</label>
        <input className="text-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      </div>
      <div className="field">
        <label>パスワード</label>
        <input className="text-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
      </div>
      {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</p>}
      <button className="btn primary" type="submit" disabled={submitting} style={{ width: '100%' }}>ログイン</button>
    </form>
  )
}

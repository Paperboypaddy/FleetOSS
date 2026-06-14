import { useState } from 'react'
import { useAuth } from '../../lib/auth'

export default function LoginPage() {
  const { login, register } = useAuth()
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (isRegister) {
        await register(email, name, password)
      } else {
        await login(email, password)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-bg items-center justify-center p-4">
      <div className="w-full max-w-sm bg-surface border border-border rounded-xl p-6">
        <div className="text-center mb-6">
          <div className="w-10 h-10 bg-cyan rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg viewBox="0 0 24 24" fill="#0F1117" className="w-6 h-6"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <h1 className="text-lg font-semibold">FleetOSS</h1>
          <p className="text-xs text-text-muted mt-1">{isRegister ? 'Create admin account' : 'Sign in to continue'}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-cyan"
            type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)} required
          />
          {isRegister && (
            <input
              className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-cyan"
              type="text" placeholder="Name" value={name}
              onChange={e => setName(e.target.value)} required
            />
          )}
          <input
            className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-cyan"
            type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)} required minLength={6}
          />

          {error && <p className="text-xs text-red text-center">{error}</p>}

          <button
            className="w-full py-2 rounded-lg bg-cyan text-bg text-sm font-semibold border-none cursor-pointer hover:opacity-85 transition-opacity disabled:opacity-50"
            disabled={busy}
          >
            {busy ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <p className="text-xs text-text-muted text-center mt-4">
          {isRegister ? 'Already have an account? ' : "Don't have an account? "}
          <button
            className="text-cyan bg-transparent border-none cursor-pointer hover:underline text-xs"
            onClick={() => { setIsRegister(!isRegister); setError('') }}
          >
            {isRegister ? 'Sign in' : 'Create one'}
          </button>
        </p>
      </div>
    </div>
  )
}

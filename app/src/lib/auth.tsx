import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

export interface AuthProviderInfo {
  id: string
  name: string
  type: 'form' | 'redirect'
  loginUrl?: string
}

interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  authProvider: string
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  loading: boolean
  providers: AuthProviderInfo[]
  login: (email: string, password: string, provider?: string) => Promise<void>
  register: (email: string, name: string, password: string) => Promise<void>
  logout: () => void
  ssoLogin: (provider: AuthProviderInfo) => void
}

const AuthContext = createContext<AuthContextType>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [providers, setProviders] = useState<AuthProviderInfo[]>([])

  // Handle SSO redirect callback (token in hash fragment)
  useEffect(() => {
    const hash = window.location.hash
    if (hash.startsWith('#/sso?')) {
      const params = new URLSearchParams(hash.slice(6))
      const ssoToken = params.get('token')
      const ssoUser = params.get('user')
      if (ssoToken && ssoUser) {
        try {
          const parsed = JSON.parse(decodeURIComponent(ssoUser))
          localStorage.setItem('fleetoss-token', ssoToken)
          localStorage.setItem('fleetoss-user', JSON.stringify(parsed))
          setToken(ssoToken)
          setUser(parsed)
          // Clean URL hash
          window.location.hash = ''
        } catch {
          // ignore parse errors
        }
      }
    }
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('fleetoss-token')
    const savedUser = localStorage.getItem('fleetoss-user')
    if (saved && savedUser) {
      setToken(saved)
      try {
        setUser(JSON.parse(savedUser))
      } catch {
        localStorage.removeItem('fleetoss-token')
        localStorage.removeItem('fleetoss-user')
      }
    }
    setLoading(false)
  }, [])

  // Listen for forced logout from 401 responses
  useEffect(() => {
    const handleLogout = () => {
      setToken(null)
      setUser(null)
    }
    window.addEventListener('auth:logout', handleLogout)
    return () => window.removeEventListener('auth:logout', handleLogout)
  }, [])

  // Fetch available auth providers
  useEffect(() => {
    fetch('/api/auth/providers')
      .then(res => res.ok ? res.json() : [])
      .then(setProviders)
      .catch(() => setProviders([]))
  }, [])

  const login = useCallback(async (email: string, password: string, provider?: string) => {
    const endpoint = provider === 'ldap' ? '/api/auth/login/ldap' : '/api/auth/login'
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Login failed')
    }
    const data = await res.json()
    localStorage.setItem('fleetoss-token', data.token)
    localStorage.setItem('fleetoss-user', JSON.stringify(data.user))
    setToken(data.token)
    setUser(data.user)
  }, [])

  const register = useCallback(async (email: string, name: string, password: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, password }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Registration failed')
    }
    const data = await res.json()
    localStorage.setItem('fleetoss-token', data.token)
    localStorage.setItem('fleetoss-user', JSON.stringify(data.user))
    setToken(data.token)
    setUser(data.user)
  }, [])

  const logout = useCallback(async () => {
    // If SSO user, get the IdP logout URL and redirect
    if (user?.authProvider && user.authProvider !== 'local' && user.authProvider !== 'ldap') {
      try {
        const res = await fetch('/api/auth/logout', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const { logoutUrl } = await res.json()
          if (logoutUrl) {
            localStorage.removeItem('fleetoss-token')
            localStorage.removeItem('fleetoss-user')
            window.location.href = logoutUrl
            return
          }
        }
      } catch {}
    }
    localStorage.removeItem('fleetoss-token')
    localStorage.removeItem('fleetoss-user')
    setToken(null)
    setUser(null)
  }, [user, token])

  const ssoLogin = useCallback((provider: AuthProviderInfo) => {
    if (provider.loginUrl) {
      window.location.href = provider.loginUrl
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, providers, login, register, logout, ssoLogin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

export function getAuthToken(): string | null {
  return localStorage.getItem('fleetoss-token')
}

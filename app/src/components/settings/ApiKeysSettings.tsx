import { useEffect, useState } from 'react'
import { getAuthToken } from '../../lib/auth'

interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  permissions: string[]
  enabled: boolean
  lastUsedAt: string | null
  createdAt: string
}

function authFetch(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> || {}) }
  const token = getAuthToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(path, { ...options, headers })
}

export default function ApiKeysSettings({ showToast }: { showToast: (msg: string) => void }) {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const loadKeys = () => {
    authFetch('/api/settings/api-keys')
      .then(r => r.ok ? r.json() : [])
      .then(setKeys)
      .catch(() => {})
  }

  useEffect(loadKeys, [])

  const createKey = async () => {
    if (!newName.trim()) return
    try {
      const res = await authFetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setCreatedKey(data.key)
        setNewName('')
        setShowNew(false)
        loadKeys()
        showToast('API key created')
      } else {
        const err = await res.json()
        showToast(err.error || 'Failed to create key')
      }
    } catch { showToast('Failed to create key') }
  }

  const deleteKey = async (id: string) => {
    if (!confirm('Delete this API key? This cannot be undone.')) return
    try {
      const res = await authFetch(`/api/settings/api-keys/${id}`, { method: 'DELETE' })
      if (res.ok || res.status === 204) {
        loadKeys()
        showToast('API key deleted')
      }
    } catch { showToast('Failed to delete key') }
  }

  const toggleKey = async (id: string) => {
    try {
      const res = await authFetch(`/api/settings/api-keys/${id}/toggle`, { method: 'PATCH' })
      if (res.ok) {
        loadKeys()
        showToast('Key toggled')
      }
    } catch { showToast('Failed to toggle') }
  }

  const copyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold mb-1">API Keys</h1>
      <p className="text-xs text-text-muted mb-4">Manage API keys for programmatic access</p>

      {createdKey && (
        <div className="bg-amber-dim border border-amber rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold text-amber mb-2">Key Created — Copy it now!</h2>
          <p className="text-xs text-text-muted mb-2">You won't be able to see this key again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-bg border border-border rounded px-3 py-2 text-xs font-mono text-text break-all select-all">
              {createdKey}
            </code>
            <button
              onClick={copyKey}
              className="px-3 py-2 rounded-lg bg-cyan text-bg text-xs font-semibold border-none cursor-pointer hover:opacity-85 whitespace-nowrap"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={() => setCreatedKey(null)}
              className="px-3 py-2 rounded-lg bg-transparent text-text-muted border border-border text-xs cursor-pointer hover:bg-surface-2"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="mb-6">
        <button
          onClick={() => { setShowNew(true); setCreatedKey(null) }}
          className="px-3.5 py-1.5 rounded-lg bg-cyan text-bg text-xs font-semibold border-none cursor-pointer hover:opacity-85"
        >
          + New API Key
        </button>
      </div>

      {showNew && (
        <div className="bg-surface border border-border rounded-lg p-4 mb-6 flex items-center gap-3">
          <input
            className="flex-1 bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text outline-none focus:border-cyan"
            placeholder="Key name (e.g. CI Server)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createKey()}
            autoFocus
          />
          <button
            onClick={createKey}
            disabled={!newName.trim()}
            className="px-3.5 py-1.5 rounded-lg bg-cyan text-bg text-xs font-semibold border-none cursor-pointer hover:opacity-85 disabled:opacity-50"
          >
            Create
          </button>
          <button
            onClick={() => setShowNew(false)}
            className="px-3.5 py-1.5 rounded-lg bg-transparent text-text-muted border border-border text-xs cursor-pointer hover:bg-surface-2"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="space-y-2">
        {keys.length === 0 && (
          <p className="text-xs text-text-muted">No API keys yet.</p>
        )}
        {keys.map(k => (
          <div key={k.id} className="bg-surface border border-border rounded-lg p-3.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{k.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${k.enabled ? 'bg-green-dim text-green' : 'bg-surface-2 text-text-muted'}`}>
                  {k.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-[11px] text-text-muted font-mono">
                <span>{k.keyPrefix}</span>
                <span>{k.lastUsedAt ? `Last used: ${new Date(k.lastUsedAt).toLocaleDateString()}` : 'Never used'}</span>
                <span>Created: {new Date(k.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => toggleKey(k.id)}
                className={`relative w-9 h-4.5 rounded-full transition-colors cursor-pointer border-none ${
                  k.enabled ? 'bg-cyan' : 'bg-border'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-bg shadow transition-transform ${
                  k.enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
                }`} />
              </button>
              <button onClick={() => deleteKey(k.id)} className="px-2 py-1 rounded text-[11px] text-red bg-transparent border-none cursor-pointer hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

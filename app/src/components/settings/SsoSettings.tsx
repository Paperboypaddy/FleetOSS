import { useEffect, useState } from 'react'
import { getAuthToken } from '../../lib/auth'

interface AuthProvider {
  id: string
  providerType: 'ldap' | 'oidc' | 'oauth2' | 'saml'
  name: string
  enabled: boolean
  config: Record<string, any>
  createdAt: string
}

interface ProviderForm {
  providerType: 'ldap' | 'oidc' | 'oauth2' | 'saml'
  name: string
  enabled: boolean
  config: Record<string, any>
}

const DEFAULT_FORMS: Record<string, () => ProviderForm> = {
  ldap: () => ({
    providerType: 'ldap', name: '', enabled: false,
    config: { url: '', bindDN: '', bindPassword: '', searchBase: '', searchFilter: '(mail={{email}})', userDnTemplate: '', nameAttribute: 'cn', defaultRole: 'viewer' },
  }),
  oidc: () => ({
    providerType: 'oidc', name: '', enabled: false,
    config: { issuer: '', clientId: '', clientSecret: '', redirectUri: '', scope: 'openid profile email', nameClaim: 'name', defaultRole: 'viewer' },
  }),
  oauth2: () => ({
    providerType: 'oauth2', name: '', enabled: false,
    config: { authorizeUrl: '', tokenUrl: '', userInfoUrl: '', clientId: '', clientSecret: '', redirectUri: '', scope: 'openid profile email', emailField: 'email', nameField: 'name', defaultRole: 'viewer' },
  }),
  saml: () => ({
    providerType: 'saml', name: '', enabled: false,
    config: { entryPoint: '', issuer: 'fleetoss-saml', cert: '', privateKey: '', callbackUrl: '', nameAttribute: 'cn', emailAttribute: 'mail', defaultRole: 'viewer' },
  }),
}

const PROVIDER_LABELS: Record<string, string> = {
  ldap: 'LDAP / Active Directory',
  oidc: 'OpenID Connect',
  oauth2: 'OAuth2',
  saml: 'SAML 2.0',
}

const PROVIDER_ICONS: Record<string, string> = {
  ldap: '🏢',
  oidc: '🔑',
  oauth2: '🔐',
  saml: '📜',
}

function authFetch(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> || {}) }
  const token = getAuthToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(path, { ...options, headers })
}

export default function SsoSettings({ showToast }: { showToast: (msg: string) => void }) {
  const [providers, setProviders] = useState<AuthProvider[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<ProviderForm | null>(null)
  const [saving, setSaving] = useState(false)

  const loadProviders = () => {
    authFetch('/api/settings/auth-providers')
      .then(r => r.ok ? r.json() : [])
      .then(setProviders)
      .catch(() => {})
  }

  useEffect(loadProviders, [])

  const startAdd = (type: string) => {
    const f = DEFAULT_FORMS[type]?.()
    if (f) {
      setForm(f)
      setEditing(null)
    }
  }

  const startEdit = (p: AuthProvider) => {
    setForm({
      providerType: p.providerType,
      name: p.name,
      enabled: p.enabled,
      config: { ...p.config },
    })
    setEditing(p.id)
  }

  const cancel = () => {
    setForm(null)
    setEditing(null)
  }

  const save = async () => {
    if (!form || !form.name.trim()) return
    setSaving(true)
    try {
      if (editing) {
        const res = await authFetch(`/api/settings/auth-providers/${editing}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name, enabled: form.enabled, config: form.config }),
        })
        if (res.ok) {
          showToast('Provider updated')
          loadProviders()
          cancel()
        } else {
          const err = await res.json()
          showToast(err.error || 'Failed to update')
        }
      } else {
        const res = await authFetch('/api/settings/auth-providers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (res.ok) {
          showToast('Provider added')
          loadProviders()
          cancel()
        } else {
          const err = await res.json()
          showToast(err.error || 'Failed to add')
        }
      }
    } catch { showToast('Failed to save') }
    setSaving(false)
  }

  const toggleProvider = async (p: AuthProvider) => {
    try {
      const res = await authFetch(`/api/settings/auth-providers/${p.id}/toggle`, { method: 'PATCH' })
      if (res.ok) {
        loadProviders()
        showToast(p.enabled ? 'Provider disabled' : 'Provider enabled')
      }
    } catch { showToast('Failed to toggle') }
  }

  const deleteProvider = async (p: AuthProvider) => {
    if (!confirm(`Delete "${p.name}"?`)) return
    try {
      const res = await authFetch(`/api/settings/auth-providers/${p.id}`, { method: 'DELETE' })
      if (res.ok || res.status === 204) {
        loadProviders()
        showToast('Provider deleted')
      }
    } catch { showToast('Failed to delete') }
  }

  const updateConfig = (key: string, value: any) => {
    if (!form) return
    setForm({ ...form, config: { ...form.config, [key]: value } })
  }

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold mb-1">SSO Providers</h1>
      <p className="text-xs text-text-muted mb-4">Manage Single Sign-On identity providers</p>

      {/* Add new provider */}
      <div className="flex flex-wrap gap-2 mb-6">
        {Object.entries(PROVIDER_LABELS).map(([type, label]) => (
          <button
            key={type}
            onClick={() => startAdd(type)}
            className="px-3.5 py-1.5 rounded-lg bg-surface border border-border text-text text-xs font-medium cursor-pointer hover:bg-surface-2 transition-colors"
          >
            {PROVIDER_ICONS[type]} Add {label}
          </button>
        ))}
      </div>

      {/* Edit/Create form */}
      {form && (
        <div className="bg-surface border border-border rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold mb-1">
            {editing ? 'Edit' : 'Add'} {PROVIDER_LABELS[form.providerType]}
          </h2>
          <p className="text-xs text-text-muted mb-4">Configure provider connection details</p>

          <div className="flex flex-col gap-3 max-w-2xl">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-text-muted">Display Name</label>
              <input
                className="bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text outline-none focus:border-cyan"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="My Company SSO"
              />
            </div>

            {form.providerType === 'ldap' && (
              <LdapFields config={form.config} onChange={updateConfig} />
            )}
            {form.providerType === 'oidc' && (
              <OidcFields config={form.config} onChange={updateConfig} />
            )}
            {form.providerType === 'oauth2' && (
              <OAuth2Fields config={form.config} onChange={updateConfig} />
            )}
            {form.providerType === 'saml' && (
              <SamlFields config={form.config} onChange={updateConfig} />
            )}

            <div className="flex items-center gap-3 mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={e => setForm({ ...form, enabled: e.target.checked })}
                  className="w-3.5 h-3.5 accent-cyan"
                />
                <span className="text-xs text-text">Enabled</span>
              </label>
            </div>

            <div className="flex gap-2 mt-1">
              <button
                onClick={save}
                disabled={saving || !form.name.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-cyan text-bg text-xs font-semibold border-none cursor-pointer hover:opacity-85 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={cancel}
                className="px-3.5 py-1.5 rounded-lg bg-transparent text-text-muted border border-border text-xs cursor-pointer hover:bg-surface-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Provider list */}
      <div className="space-y-2">
        {providers.length === 0 && (
          <p className="text-xs text-text-muted">No SSO providers configured yet.</p>
        )}
        {providers.map(p => (
          <div key={p.id} className="bg-surface border border-border rounded-lg p-3.5 flex items-center gap-3">
            <span className="text-base">{PROVIDER_ICONS[p.providerType]}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{p.name}</span>
                <span className="text-[10px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded">{PROVIDER_LABELS[p.providerType]}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${p.enabled ? 'bg-green-dim text-green' : 'bg-surface-2 text-text-muted'}`}>
                  {p.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              <div className="text-[11px] text-text-muted mt-0.5 truncate font-mono">
                {p.providerType === 'ldap' ? p.config.url || p.config.userDnTemplate :
                 p.providerType === 'oidc' ? p.config.issuer :
                 p.providerType === 'oauth2' ? p.config.authorizeUrl :
                 p.providerType === 'saml' ? p.config.entryPoint : ''}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => toggleProvider(p)}
                className={`relative w-9 h-4.5 rounded-full transition-colors cursor-pointer border-none ${
                  p.enabled ? 'bg-cyan' : 'bg-border'
                }`}
              >
                <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-bg shadow transition-transform ${
                  p.enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
                }`} />
              </button>
              <button onClick={() => startEdit(p)} className="px-2 py-1 rounded text-[11px] text-cyan bg-transparent border-none cursor-pointer hover:underline">Edit</button>
              <button onClick={() => deleteProvider(p)} className="px-2 py-1 rounded text-[11px] text-red bg-transparent border-none cursor-pointer hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── LDAP Fields ──
function LdapFields({ config, onChange }: { config: Record<string, any>; onChange: (k: string, v: any) => void }) {
  return (
    <>
      <TextField label="Server URL" value={config.url} onChange={v => onChange('url', v)} placeholder="ldap://localhost:389" />
      <TextField label="Bind DN" value={config.bindDN} onChange={v => onChange('bindDN', v)} placeholder="cn=admin,dc=example,dc=com" />
      <TextField label="Bind Password" value={config.bindPassword} onChange={v => onChange('bindPassword', v)} type="password" />
      <TextField label="Search Base" value={config.searchBase} onChange={v => onChange('searchBase', v)} placeholder="dc=example,dc=com" />
      <TextField label="Search Filter" value={config.searchFilter} onChange={v => onChange('searchFilter', v)} placeholder="(mail={{email}})" />
      <TextField label="User DN Template" value={config.userDnTemplate} onChange={v => onChange('userDnTemplate', v)} placeholder="cn={{email}},ou=users,dc=..." hint="Alternative to search" />
      <TextField label="Name Attribute" value={config.nameAttribute} onChange={v => onChange('nameAttribute', v)} placeholder="cn" />
    </>
  )
}

// ── OIDC Fields ──
function OidcFields({ config, onChange }: { config: Record<string, any>; onChange: (k: string, v: any) => void }) {
  return (
    <>
      <TextField label="Issuer URL" value={config.issuer} onChange={v => onChange('issuer', v)} placeholder="http://localhost:8080/realms/fleetoss" />
      <TextField label="Client ID" value={config.clientId} onChange={v => onChange('clientId', v)} />
      <TextField label="Client Secret" value={config.clientSecret} onChange={v => onChange('clientSecret', v)} type="password" />
      <TextField label="Redirect URI" value={config.redirectUri} onChange={v => onChange('redirectUri', v)} placeholder="http://localhost:4000/api/auth/db/{id}/callback" hint="Auto-filled if empty" />
      <TextField label="Scope" value={config.scope} onChange={v => onChange('scope', v)} placeholder="openid profile email" />
      <TextField label="Name Claim" value={config.nameClaim} onChange={v => onChange('nameClaim', v)} placeholder="name" hint="JWT claim for display name" />
      <SelectField label="Default Role" value={config.defaultRole} onChange={v => onChange('defaultRole', v)} options={[
        { value: 'viewer', label: 'Viewer' },
        { value: 'manager', label: 'Manager' },
        { value: 'admin', label: 'Admin' },
      ]} />
    </>
  )
}

// ── OAuth2 Fields ──
function OAuth2Fields({ config, onChange }: { config: Record<string, any>; onChange: (k: string, v: any) => void }) {
  return (
    <>
      <TextField label="Authorize URL" value={config.authorizeUrl} onChange={v => onChange('authorizeUrl', v)} placeholder="https://github.com/login/oauth/authorize" />
      <TextField label="Token URL" value={config.tokenUrl} onChange={v => onChange('tokenUrl', v)} placeholder="https://github.com/login/oauth/access_token" />
      <TextField label="UserInfo URL" value={config.userInfoUrl} onChange={v => onChange('userInfoUrl', v)} placeholder="https://api.github.com/user" />
      <TextField label="Client ID" value={config.clientId} onChange={v => onChange('clientId', v)} />
      <TextField label="Client Secret" value={config.clientSecret} onChange={v => onChange('clientSecret', v)} type="password" />
      <TextField label="Redirect URI" value={config.redirectUri} onChange={v => onChange('redirectUri', v)} hint="Auto-filled if empty" />
      <TextField label="Scope" value={config.scope} onChange={v => onChange('scope', v)} placeholder="user:email" />
      <TextField label="Email JSON Field" value={config.emailField} onChange={v => onChange('emailField', v)} placeholder="email" />
      <TextField label="Name JSON Field" value={config.nameField} onChange={v => onChange('nameField', v)} placeholder="name" />
      <SelectField label="Default Role" value={config.defaultRole} onChange={v => onChange('defaultRole', v)} options={[
        { value: 'viewer', label: 'Viewer' },
        { value: 'manager', label: 'Manager' },
        { value: 'admin', label: 'Admin' },
      ]} />
    </>
  )
}

// ── SAML Fields ──
function SamlFields({ config, onChange }: { config: Record<string, any>; onChange: (k: string, v: any) => void }) {
  return (
    <>
      <TextField label="Entry Point URL" value={config.entryPoint} onChange={v => onChange('entryPoint', v)} placeholder="http://localhost:8080/realms/fleetoss/protocol/saml" />
      <TextField label="Entity ID / Issuer" value={config.issuer} onChange={v => onChange('issuer', v)} placeholder="fleetoss-saml" />
      <TextField label="IdP Certificate" value={config.cert} onChange={v => onChange('cert', v)} type="textarea" placeholder="PEM or base64 certificate" hint="For verifying SAML responses" />
      <TextField label="SP Private Key" value={config.privateKey} onChange={v => onChange('privateKey', v)} type="textarea" placeholder="Optional - for signing authn requests" />
      <TextField label="Callback URL" value={config.callbackUrl} onChange={v => onChange('callbackUrl', v)} hint="Auto-filled if empty" />
      <TextField label="Email Attribute" value={config.emailAttribute} onChange={v => onChange('emailAttribute', v)} placeholder="mail" />
      <TextField label="Name Attribute" value={config.nameAttribute} onChange={v => onChange('nameAttribute', v)} placeholder="cn" />
      <SelectField label="Default Role" value={config.defaultRole} onChange={v => onChange('defaultRole', v)} options={[
        { value: 'viewer', label: 'Viewer' },
        { value: 'manager', label: 'Manager' },
        { value: 'admin', label: 'Admin' },
      ]} />
    </>
  )
}

// ── Reusable field components ──
function TextField({ label, value, onChange, placeholder, hint, type }: {
  label: string; value: any; onChange: (v: string) => void; placeholder?: string; hint?: string; type?: string
}) {
  const isTextarea = type === 'textarea'
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-text-muted">{label}</label>
      {isTextarea ? (
        <textarea
          className="bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text outline-none focus:border-cyan font-mono"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
        />
      ) : (
        <input
          className="bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text outline-none focus:border-cyan"
          type={type || 'text'}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
      {hint && <p className="text-[10px] text-text-muted">{hint}</p>}
    </div>
  )
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: any; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-text-muted">{label}</label>
      <select
        className="bg-surface-2 border border-border rounded px-2.5 py-1.5 text-xs text-text outline-none focus:border-cyan"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(o => (
          <option key={o.value} value={o.value} className="bg-bg">{o.label}</option>
        ))}
      </select>
    </div>
  )
}

import { useEffect, useState, type FormEvent } from 'react';
import type { ModelSettingsInput, ModelSettingsSummary } from '../../../shared/model-settings';

const empty: ModelSettingsSummary = { mode: 'mock', baseUrl: '', model: '', authHeader: 'Authorization', authScheme: 'Bearer', timeoutMs: 30000, hasApiKey: false };

export function ModelSettings({ onSaved }: { onSaved: (summary: ModelSettingsSummary) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ModelSettingsSummary>(empty);
  const [savedSummary, setSavedSummary] = useState<ModelSettingsSummary>(empty);
  const [apiKey, setApiKey] = useState('');
  const [clearApiKey, setClearApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('Loading model settings…');
  useEffect(() => {
    let active = true;
    fetch('/api/settings/model').then(async response => {
      if (!response.ok) throw new Error('Model settings unavailable. Check the local service and reload.');
      return response.json();
    }).then(data => { if (active) { setForm(data); setSavedSummary(data); setLoaded(true); setMessage(''); } }).catch(error => { if (active) setMessage((error as Error).message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function close() { setOpen(false); setForm(savedSummary); setApiKey(''); setClearApiKey(false); setMessage(''); }
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage('Saving model settings…');
    const { hasApiKey: _hasApiKey, ...fields } = form;
    const input: ModelSettingsInput = { ...fields, ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}), ...(clearApiKey ? { clearApiKey: true } : {}) };
    try {
      const response = await fetch('/api/settings/model', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? 'Settings were not saved. Your previous configuration is retained.');
      setForm(data); setSavedSummary(data); setApiKey(''); setClearApiKey(false); setMessage('Model settings saved. The next analysis will use this configuration. No model request was sent.'); onSaved(data);
    } catch (error) { setMessage((error as Error).message); }
    finally { setSaving(false); }
  }
  return <section className="card settings-card" aria-label="Model API settings">
    <div className="section-heading"><div><h2>Model API settings</h2><p className="muted">{savedSummary.mode === 'live' ? 'Real API' : 'Mock'} · {savedSummary.hasApiKey ? 'API key saved' : 'No API key saved'}</p></div><button type="button" aria-expanded={open} onClick={() => open ? close() : setOpen(true)} disabled={saving}>{open ? 'Close model settings' : 'Configure model API'}</button></div>
    {open && <form onSubmit={save}>
      <p className="muted">OpenAI-compatible API, including MiMo. Saving does not contact the provider. Real API analysis sends the current synthetic case to your provider and may use credits.</p>
      <fieldset disabled={!loaded || loading || saving}>
        <div className="settings-grid">
          <label>Model mode<select aria-label="Model mode" value={form.mode} onChange={event => setForm({ ...form, mode: event.target.value as ModelSettingsSummary['mode'] })}><option value="mock">Mock — fixed training data</option><option value="live">Real API — use my provider</option></select></label>
          <label>API base URL<input type="url" autoComplete="off" spellCheck={false} placeholder="https://your-provider.example/v1" value={form.baseUrl} onChange={event => setForm({ ...form, baseUrl: event.target.value })} required={form.mode === 'live'} /></label>
          <label>Model name<input type="text" autoComplete="off" spellCheck={false} value={form.model} onChange={event => setForm({ ...form, model: event.target.value })} placeholder="Exact model name from your provider" required={form.mode === 'live'} /></label>
          <label>API key<input type="password" autoComplete="new-password" spellCheck={false} value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder={form.hasApiKey ? 'Leave blank to keep the saved key' : 'Enter your API key'} disabled={clearApiKey} /></label>
        </div>
        <label className="checkbox"><input type="checkbox" checked={clearApiKey} onChange={event => { setClearApiKey(event.target.checked); if (event.target.checked) setApiKey(''); }} />Remove saved API key</label>
        <details><summary>Authentication & timeout</summary><div className="settings-grid">
          <label>Authentication header<select aria-label="Authentication header" value={form.authHeader} onChange={event => setForm({ ...form, authHeader: event.target.value as ModelSettingsSummary['authHeader'] })}><option value="Authorization">Authorization</option><option value="api-key">api-key</option><option value="x-api-key">x-api-key</option></select></label>
          <label>Authentication prefix<input type="text" value={form.authScheme} onChange={event => setForm({ ...form, authScheme: event.target.value })} placeholder="Bearer, or blank for a raw API key" /></label>
          <label>Request timeout (seconds)<input type="number" min="0.1" max="120" step="0.1" value={form.timeoutMs / 1000} onChange={event => setForm({ ...form, timeoutMs: Number(event.target.value) * 1000 })} /></label>
        </div></details>
        <p className="muted">Stored on this computer by the local service, separately from case backups. Saved keys are never returned to this page.</p>
        <button className="primary" type="submit">{saving ? 'Saving settings…' : 'Save API settings'}</button>
      </fieldset>
    </form>}
    {(open || loading) && message && <p role="status" aria-live="polite" className="notice">{message}</p>}
  </section>;
}

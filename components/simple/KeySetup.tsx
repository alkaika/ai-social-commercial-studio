'use client';
import { useState, useEffect } from 'react';
import { useKeyStore, maskedKey } from '@/stores/keyStore';
import { vaultEnroll, vaultUnlock, vaultHas, vaultForget, prfSupported } from '@/lib/vault/webauthn-prf';

export default function KeySetup({ onDone }: { onDone: () => void }) {
  const { key, baseUrl, setKey, setStatus, forget, modelStatus } = useKeyStore();
  const [k, setK] = useState(key);
  const [url, setUrl] = useState(baseUrl || process.env.NEXT_PUBLIC_META_GATEWAY || 'https://api.meta.example');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [hasVault, setHasVault] = useState(false);

  useEffect(() => { vaultHas().then(setHasVault).catch(() => {}); }, []);

  const headers = (kk: string, uu: string) => ({ 'x-meta-key': kk, 'x-meta-base-url': uu });

  async function test(kk: string, uu: string) {
    setBusy(true); setMsg('Checking your key with Meta…');
    try {
      const res = await fetch('/api/muse/validate', { method: 'POST', headers: headers(kk, uu), body: JSON.stringify({}) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Key check failed.');
      Object.entries(j.checks || {}).forEach(([m, s]) => setStatus(m, s as any));
      setKey(kk, uu);
      const okCount = Object.values(j.checks || {}).filter((v) => v === 'ok').length;
      setMsg(`Key works. ${okCount} of 6 model checks passed. Anything that failed will use a free preview instead.`);
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }

  async function enroll() {
    if (!k) { setMsg('Paste your key first.'); return; }
    try { setBusy(true); await vaultEnroll(k, url); setHasVault(true); setMsg('Saved. Next time, unlock with Face ID / fingerprint instead of pasting.'); }
    catch (e: any) { setMsg(`Could not save with biometrics: ${e.message} — session-only mode still works.`); }
    finally { setBusy(false); }
  }

  async function unlock() {
    try { setBusy(true); const r = await vaultUnlock(); setK(r.key); setUrl(r.baseUrl); await test(r.key, r.baseUrl); }
    catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="card space-y-4">
      <h2 className="text-xl font-bold">🔑 Connect your Meta key</h2>
      <p className="text-neutral-600 text-sm">Your key is like a password that lets this app use Meta&apos;s AI. It stays in this tab&apos;s memory and is sent only with your own requests. It is never stored on our server.</p>
      {hasVault && <button className="btn-secondary" onClick={unlock} disabled={busy}>🔓 Unlock with Face ID / fingerprint</button>}
      <label className="block text-sm font-medium">Meta API key</label>
      <input className="input" type="password" placeholder="Paste your Meta key" value={k} onChange={(e) => setK(e.target.value)} />
      <label className="block text-sm font-medium">Gateway URL (advanced — usually leave as-is)</label>
      <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} />
      {key && <p className="text-sm">Current key: <span className="badge">{maskedKey(key)}</span></p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy || !k} onClick={() => test(k, url)}>{busy ? 'Checking…' : 'Test my key'}</button>
        {prfSupported() && <button className="btn-secondary" disabled={busy || !k} onClick={enroll}>💾 Save with biometrics</button>}
        <button className="btn-secondary" onClick={() => { forget(); vaultForget(); setHasVault(false); setK(''); setMsg('Forgotten — key wiped from memory and this device.'); }}>Forget key</button>
      </div>
      {Object.keys(modelStatus).length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">{Object.entries(modelStatus).map(([m, s]) => <span key={m} className="badge">{m}: {s === 'ok' ? '✅' : '⚠️ preview mode'}</span>)}</div>
      )}
      {msg && <p className="text-sm bg-neutral-100 border rounded-xl p-3">{msg}</p>}
      <div className="flex justify-between items-center">
        <button className="btn-secondary" onClick={() => { setKey('DEMO', ''); onDone(); }}>Try demo without a key</button>
        <button className="btn-primary" disabled={!key && !k} onClick={() => { if (k && !key) setKey(k, url); onDone(); }}>Continue →</button>
      </div>
    </div>
  );
}

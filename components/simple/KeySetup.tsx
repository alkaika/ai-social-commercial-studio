'use client';
import { useState, useEffect } from 'react';
import { useKeyStore, maskedKey } from '@/stores/keyStore';
import { vaultEnroll, vaultUnlock, vaultHas, vaultForget, prfSupported, vaultEnrollPasskey, vaultUnlockPasskey, vaultHasPasskey, vaultExport, vaultImport } from '@/lib/vault/webauthn-prf';

export default function KeySetup({ onDone }: { onDone: () => void }) {
  const { key, baseUrl, setKey, setStatus, forget, modelStatus } = useKeyStore() as any;
  const [k, setK] = useState(key);
  const [url, setUrl] = useState(baseUrl || process.env.NEXT_PUBLIC_META_GATEWAY || 'https://api.meta.ai/v1');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [hasVault, setHasVault] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferText, setTransferText] = useState('');
  const [details, setDetails] = useState<Record<string, string>>({});
  // Client-only UI (vault + biometrics) must not render during SSR,
  // or React hydration fails: server HTML won't match the browser.
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); vaultHas().then(setHasVault).catch(() => {}); vaultHasPasskey().then(setHasPasskey).catch(() => {}); }, []);

  const headers = (kk: string, uu: string) => ({ 'x-meta-key': kk, 'x-meta-base-url': uu });

  async function test(kk: string, uu: string) {
    setBusy(true); setMsg('Checking your key with Meta…');
    try {
      const res = await fetch('/api/muse/validate', { method: 'POST', headers: headers(kk, uu), body: JSON.stringify({}) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Key check failed.');
      Object.entries(j.checks || {}).forEach(([m, s]) => setStatus(m, s as any));
      setDetails(j.details || {});
      setKey(kk, uu);
      const okCount = Object.values(j.checks || {}).filter((v) => v === 'ok').length;
      const authCount = Object.values(j.checks || {}).filter((v) => (v as any) === 'auth').length;
      const total = Object.keys(j.checks || {}).length;
      if (okCount === 0 && authCount === 0) {
        setMsg(`Heads up: 0 of ${total} checks passed. This usually means the Gateway URL is wrong — not your key. This app expects the Meta Model API at https://api.meta.ai/v1 (…/v1/chat/completions). See the per-model reasons below, or tap Continue to use free preview mode.`);
      } else if (authCount > 0) {
        setMsg(`Key reaches Meta (${okCount} working, ${authCount} endpoint-exists-but-key-rejected). Those 'auth' models need a different key scope or plan — the app will use a free preview for them.`);
      } else {
        setMsg(`Key works. ${okCount} of ${total} model checks passed. Anything that failed will use a free preview instead.`);
      }
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

  async function unlockPasskey() {
    try { setBusy(true); const r = await vaultUnlockPasskey(); setK(r.key); setUrl(r.baseUrl); setHasPasskey(true); await test(r.key, r.baseUrl); }
    catch (e: any) { setMsg(`Passkey unlock: ${e.message}`); } finally { setBusy(false); }
  }

  async function enrollPasskey() {
    if (!k) { setMsg('Paste your key first.'); return; }
    try { setBusy(true); await vaultEnrollPasskey(k, url); setHasPasskey(true); setMsg('🔑 Passkey saved. It can sync via your password manager (Google, iCloud, 1Password) — use Export below to move the encrypted copy to another device.'); }
    catch (e: any) { setMsg(`Could not save with a passkey: ${e.message} — biometrics or session-only mode still work.`); }
    finally { setBusy(false); }
  }

  async function forgetAll() {
    forget(); vaultForget(); setHasVault(false); setHasPasskey(false); setK(''); setTransferText(''); setMsg('Forgotten — key wiped from memory and this device (both vaults cleared).');
  }

  return (
    <div className="card space-y-4">
      <h2 className="text-xl font-bold">🔑 Connect your Meta key</h2>
      <p className="text-neutral-600 text-sm">Your key is like a password that lets this app use Meta&apos;s AI. It stays in this tab&apos;s memory and is sent only with your own requests. It is never stored on our server.</p>
      {mounted && hasVault && <button className="btn-secondary" onClick={unlock} disabled={busy}>🔓 Unlock with Face ID / fingerprint</button>}
      {mounted && hasPasskey && <button className="btn-secondary" onClick={unlockPasskey} disabled={busy}>🔑 Unlock with passkey</button>}
      <label className="block text-sm font-medium">Meta API key</label>
      <input className="input" type="password" placeholder="Paste your Meta key" value={k} onChange={(e) => setK(e.target.value)} />
      <label className="block text-sm font-medium">Gateway URL (advanced — usually leave as-is)</label>
      <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} />
      {key && <p className="text-sm">Current key: <span className="badge">{maskedKey(key)}</span></p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy || !k} onClick={() => test(k, url)}>{busy ? 'Checking…' : 'Test my key'}</button>
        {mounted && prfSupported() && <button className="btn-secondary" disabled={busy || !k} onClick={enroll}>💾 Save with biometrics</button>}
        {mounted && prfSupported() && <button className="btn-secondary" disabled={busy || !k} onClick={enrollPasskey}>🔑 Save with a passkey</button>}
        <button className="btn-secondary" onClick={forgetAll}>Forget key</button>
      </div>
      {Object.keys(modelStatus).length > 0 && (
        <div className="space-y-1 text-sm">
          <div className="flex flex-wrap gap-2">{Object.entries(modelStatus).map(([m, s]) => <span key={m} className="badge">{m}: {s === 'ok' ? '✅' : s === 'auth' ? '🔑 endpoint exists, key rejected' : '⚠️ preview mode'}</span>)}</div>
          {Object.keys(details).length > 0 && (
            <details className="border rounded-xl p-2 bg-neutral-50">
              <summary className="cursor-pointer font-medium">Why did checks fail? (tap to see)</summary>
              <ul className="mt-2 space-y-1 text-xs break-all">
                {Object.entries(details).map(([m, d]) => <li key={m}><b>{m}:</b> {d}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
      {msg && <p className="text-sm bg-neutral-100 border rounded-xl p-3">{msg}</p>}
      {mounted && (hasPasskey || hasVault) && (
        <div className="border rounded-2xl p-3 space-y-2 bg-neutral-50">
          <button className="text-sm font-medium underline" onClick={() => setShowTransfer(!showTransfer)}>{showTransfer ? 'Hide saved-key transfer' : 'Move a saved key to another device'}</button>
          {showTransfer && (
            <div className="space-y-2">
              <p className="text-xs text-neutral-600">Biometrics stay on this device. A passkey can sync via your password manager — but the encrypted copy still lives in this browser. Export copies the ENCRYPTED bundle (safe to move); import it where the SAME passkey syncs. The key itself never leaves encrypted form.</p>
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary" disabled={busy || !hasPasskey} onClick={async () => { try { setBusy(true); const t = await vaultExport('vault-passkey'); setTransferText(t); setMsg('Encrypted bundle ready — copy the text below.'); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); } }}>Export encrypted bundle</button>
                <button className="btn-secondary" disabled={busy || !transferText} onClick={async () => { try { setBusy(true); await vaultImport(transferText, 'vault-passkey'); setHasPasskey(true); setMsg('Bundle imported. Unlock with your passkey to verify it opens here.'); } catch (e: any) { setMsg(`Import: ${e.message}`); } finally { setBusy(false); } }}>Import bundle</button>
              </div>
              <textarea className="input font-mono text-xs" rows={3} placeholder="Paste an exported bundle here to import, or copy the exported text from here…" value={transferText} onChange={(e) => setTransferText(e.target.value)} />
            </div>
          )}
        </div>
      )}
      <div className="flex justify-between items-center">
        <button className="btn-secondary" onClick={() => { setKey('DEMO', ''); onDone(); }}>Try demo without a key</button>
        <button className="btn-primary" disabled={!key && !k} onClick={() => { if (k && !key) setKey(k, url); onDone(); }}>Continue →</button>
      </div>
    </div>
  );
}

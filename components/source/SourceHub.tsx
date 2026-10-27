'use client';
import { useState } from 'react';
import { useProject } from '@/stores/projectStore';

export default function SourceHub({ onDone }: { onDone: () => void }) {
  const { urls, set, snippets, assets } = useProject();
  const [urlInput, setUrlInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [paste, setPaste] = useState('');

  const addUrl = () => {
    if (!urlInput.trim()) return;
    set({ urls: [...urls, urlInput.trim()] });
    setUrlInput('');
  };

  async function scrape() {
    setBusy(true); setMsg('Reading your website…');
    try {
      const res = await fetch('/api/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urls }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Scrape failed');
      const first = (j.results || []).find((r: any) => r.ok)?.data;
      if (first) {
        set({ brand: { brandName: first.brandName || '', tagline: first.tagline || '', description: first.description || '', colors: first.colors || ['#111111'], logoUrl: first.logoUrl, cta: first.cta || 'Shop now', offer: '', testimonials: first.testimonials || [], pinned: [], avoidWords: [] } });
        const imgs = (first.heroImages || []).map((u: string, i: number) => ({ id: `web-${i}`, name: 'Website image', url: u, tag: 'Website' }));
        set({ assets: [...assets, ...imgs] });
        setMsg(`Found “${first.brandName}”. You can edit everything on the next screen.`);
      } else {
        setMsg('That website would not let us read it. No problem — paste your text below or upload photos instead.');
      }
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const next = [...assets];
    for (const f of Array.from(files).slice(0, 12)) {
      const url = URL.createObjectURL(f);
      next.push({ id: `${Date.now()}-${f.name}`, name: f.name, url, tag: 'Upload' });
    }
    set({ assets: next });
  };

  const addSnippet = (kind: string) => {
    if (!paste.trim()) return;
    set({ snippets: [...snippets, { id: `${Date.now()}`, kind, text: paste.trim(), pinned: false }] });
    setPaste('');
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h2 className="text-xl font-bold">🏢 Tell us about your business</h2>
        <p className="text-sm text-neutral-600">Add a website, your own photos, or paste text — use any or all of them.</p>
        <label className="text-sm font-medium">Website address(es)</label>
        <div className="flex gap-2">
          <input className="input" placeholder="https://yourbusiness.com" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} />
          <button className="btn-secondary" onClick={addUrl}>Add</button>
        </div>
        {urls.length > 0 && <div className="flex flex-wrap gap-2">{urls.map((u) => <span key={u} className="badge">{u}</span>)}</div>}
        <button className="btn-secondary" disabled={busy || urls.length === 0} onClick={scrape}>{busy ? 'Reading…' : 'Read my website(s)'}</button>
        {msg && <p className="text-sm bg-neutral-100 border rounded-xl p-3">{msg}</p>}
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">🖼 Your photos & logo (optional, free)</h3>
        <input type="file" accept="image/*" multiple onChange={(e) => onFiles(e.target.files)} className="text-sm" />
        {assets.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {assets.map((a) => (
              <div key={a.id} className="border rounded-xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.name} className="w-full h-24 object-cover" />
                <p className="text-xs p-1 truncate">{a.tag}: {a.name}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">📝 Paste your own content (optional, free)</h3>
        <textarea className="input" rows={3} placeholder="Paste product description, offer, reviews…" value={paste} onChange={(e) => setPaste(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {['Description', 'Offer', 'Review', 'Must-use line'].map((k) => (
            <button key={k} className="btn-secondary" onClick={() => addSnippet(k)}>+ {k}</button>
          ))}
        </div>
        {snippets.length > 0 && (
          <ul className="space-y-2">
            {snippets.map((s) => (
              <li key={s.id} className="border rounded-xl p-2 text-sm flex justify-between gap-2">
                <span><span className="badge mr-2">{s.kind}</span>{s.text}</span>
                <button className="text-xs underline" onClick={() => set({ snippets: snippets.map((x) => x.id === s.id ? { ...x, pinned: !x.pinned } : x) })}>{s.pinned ? '📌 Pinned (must use)' : 'Pin as must-use'}</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="text-right"><button className="btn-primary" onClick={onDone}>Continue →</button></div>
    </div>
  );
}

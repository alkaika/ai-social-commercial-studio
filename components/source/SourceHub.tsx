'use client';
import { useState } from 'react';
import { useProject } from '@/stores/projectStore';
import { useKeyStore } from '@/stores/keyStore';

export default function SourceHub({ onDone, onBack }: { onDone: () => void; onBack?: () => void }) {
  const { urls, set, snippets, assets, brand, durationSec, platform, tone, sparkModel, masterScript, masterApproved } = useProject();
  const { key, baseUrl } = useKeyStore() as any;
  const [urlInput, setUrlInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [paste, setPaste] = useState('');
  const [drafting, setDrafting] = useState(false);

  const addUrl = () => {
    if (!urlInput.trim()) return;
    set({ urls: [...urls, urlInput.trim()] });
    setUrlInput('');
  };

  async function scrape() {
    setBusy(true); setMsg('Reading your website + about page…');
    try {
      const res = await fetch('/api/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urls }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Scrape failed');
      const good = (j.results || []).filter((r: any) => r.ok);
      const first = good[0]?.data;
      if (first) {
        // Merge about stories across all scraped sites into one cohesive source.
        const stories = good.map((r: any) => r.data?.aboutSummary).filter(Boolean);
        const points = Array.from(new Set<string>(good.flatMap((r: any) => r.data?.aboutPoints || []))).slice(0, 8);
        const aboutStory = stories.join(' ').slice(0, 1200);
        const aboutSource = good.map((r: any) => r.data?.aboutSource).filter(Boolean).join(', ') || '';
        const needsJs = good.some((r: any) => r.data?.needsJs);
        set({ brand: { brandName: first.brandName || '', tagline: first.tagline || '', description: first.description || '', colors: first.colors || ['#111111'], logoUrl: first.logoUrl, cta: first.cta || 'Shop now', offer: '', testimonials: good.flatMap((r: any) => r.data?.testimonials || []).slice(0, 5), pinned: [], avoidWords: [], aboutStory, aboutPoints: points, aboutSource } });
        const imgs = good.flatMap((r: any) => r.data?.heroImages || []).map((u: string, i: number) => ({ id: `web-${i}`, name: 'Website image', url: u, tag: 'Website' }));
        set({ assets: [...assets, ...imgs] });
        if (aboutStory) {
          setMsg(`Found “${first.brandName}” + brand story from about page (${aboutSource}). Your script will be built around it.`);
        } else if (needsJs) {
          setMsg(`Found “${first.brandName}”, but its pages load content with JavaScript — I can see the shell but not the words (this includes the about page). Paste 2–3 sentences about your story below, or open the about page in your browser and copy the text — then tap “Draft my script”.`);
        } else {
          setMsg(`Found “${first.brandName}”. No about page found — add your story below or the script leans on the homepage.`);
        }
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

  const hdr = () => ({ 'Content-Type': 'application/json', 'x-meta-key': key || 'DEMO', 'x-meta-base-url': baseUrl || '' });

  async function draftMaster() {
    if (!brand.brandName && !brand.description && !brand.aboutStory && snippets.length === 0) {
      setMsg('Add a website, photos, or pasted text first — then I can draft your script.');
      return;
    }
    setDrafting(true); setMsg('Drafting your script with your settings (length, platform, vibe) + website story…');
    try {
      const extra = snippets.map((s) => `${s.kind}${s.pinned ? ' (MUST USE VERBATIM)' : ''}: ${s.text}`).join('\n');
      const res = await fetch('/api/muse/script', {
        method: 'POST', headers: hdr(),
        body: JSON.stringify({ mode: 'master', brand, durationSec, platform, tone, sparkModel, extraContext: extra }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Draft failed');
      set({ masterScript: j.masterScript || '', masterApproved: false, script: null });
      setMsg('Draft ready below. Edit it however you like — nothing downstream uses it until you approve it.');
    } catch (e: any) { setMsg(e.message); } finally { setDrafting(false); }
  }

  const wordCount = masterScript.trim() ? masterScript.trim().split(/\s+/).length : 0;

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
        {urls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {urls.map((u) => (
              <span key={u} className="badge flex items-center gap-1">
                {u}
                <button
                  className="ml-1 underline hover:opacity-70"
                  title={`Remove ${u}`}
                  onClick={() => {
                    set({ urls: urls.filter((x) => x !== u) });
                    setMsg(`Removed ${u}.`);
                  }}
                >✕</button>
              </span>
            ))}
          </div>
        )}
        <button className="btn-secondary" disabled={busy || urls.length === 0} onClick={scrape}>{busy ? 'Reading…' : 'Read my website(s)'}</button>
        {msg && <p className="text-sm bg-neutral-100 border rounded-xl p-3">{msg}</p>}
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">🖼 Your photos & logo (optional, free)</h3>
        <input type="file" accept="image/*" multiple onChange={(e) => onFiles(e.target.files)} className="text-sm" />
        {assets.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {assets.map((a) => (
              <div key={a.id} className="border rounded-xl overflow-hidden relative">
                <button
                  className="absolute top-1 right-1 bg-black/70 text-white text-xs rounded-full w-6 h-6 leading-none"
                  title={`Remove ${a.name}`}
                  onClick={() => {
                    if (a.url.startsWith('blob:')) { try { URL.revokeObjectURL(a.url); } catch {} }
                    set({ assets: assets.filter((x) => x.id !== a.id) });
                  }}
                >✕</button>
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

      <div className="card space-y-3">
        <h3 className="font-semibold">📜 Final script — written for your {durationSec}s {platform} cut</h3>
        <p className="text-sm text-neutral-600">Drafted from your website + about page with your Setup picks (length, platform, vibe) already in mind. Edit it freely — this exact wording is what the app will organize into scenes. Nothing downstream runs until you approve it.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" disabled={drafting} onClick={draftMaster}>{drafting ? 'Drafting…' : masterScript ? '🔄 Re-draft from sources' : '✨ Draft my script from website'}</button>
          {masterScript && !masterApproved && (
            <button className="btn-primary" onClick={() => set({ masterApproved: true })}>Approve this script →</button>
          )}
          {masterApproved && <span className="badge">✅ Approved — Story step will organize this</span>}
        </div>
        {masterScript ? (
          <>
            <textarea className="input" rows={8} value={masterScript} onChange={(e) => set({ masterScript: e.target.value, masterApproved: false })} />
            <div className="flex justify-between items-center text-xs text-neutral-500">
              <span>{wordCount} words · approval resets when you edit (re-approve before continuing)</span>
              <button className="underline" onClick={() => { set({ masterScript: '', masterApproved: false }); }}>Clear draft</button>
            </div>
          </>
        ) : (
          <p className="text-sm text-neutral-500 border border-dashed rounded-xl p-3">No script yet — scan a website above, then tap “Draft my script from website”. You can also just type/paste your own script here.</p>
        )}
        {!masterScript && (
          <textarea className="input" rows={4} placeholder="Or write/paste your final script here…" onChange={(e) => set({ masterScript: e.target.value, masterApproved: false })} />
        )}
      </div>

      <div className="flex justify-between items-center"><button className="btn-secondary" onClick={onBack}>← Back</button><button className="btn-primary" disabled={!masterScript.trim() || !masterApproved} title={!masterScript.trim() ? 'Draft or paste your script first' : !masterApproved ? 'Approve the script to continue' : ''} onClick={onDone}>Continue →</button></div>
    </div>
  );
}

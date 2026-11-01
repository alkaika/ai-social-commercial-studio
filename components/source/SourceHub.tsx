'use client';
import { useMemo, useState } from 'react';
import { useProject } from '@/stores/projectStore';
import { useKeyStore } from '@/stores/keyStore';
import { JUDGING_MODE, SERVER_KEY_PLACEHOLDER } from '@/lib/judging';
import { masterFit } from '@/lib/script-utils';
import ShotImg from '@/components/simple/ShotImg';
import { downloadWebsiteShot, screenshotCandidates, type WebsiteShot } from '@/lib/screenshots';

export default function SourceHub({ onDone, onBack }: { onDone: () => void; onBack?: () => void }) {
  const { urls, set, assets, brand, durationSec, platform, tone, sparkModel, masterScript, masterApproved, scriptGuidance, projectId } = useProject();
  const { key, baseUrl } = useKeyStore() as any;
  const [urlInput, setUrlInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [dlMsg, setDlMsg] = useState('');
  const [dlBusy, setDlBusy] = useState(false);

  const shots: WebsiteShot[] = useMemo(
    () => screenshotCandidates(urls, brand.aboutSource || '', brand.sitePages || []),
    [urls, brand.aboutSource, brand.sitePages]
  );
  const selectedShots = shots.filter((s) => selected[s.id]);
  const toggleShot = (id: string) => setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  const downloadMany = async (list: WebsiteShot[]) => {
    if (!list.length || dlBusy) return;
    setDlBusy(true); setDlMsg(`Saving ${list.length} screenshot${list.length > 1 ? 's' : ''}…`);
    let saved = 0; let opened = 0;
    for (let i = 0; i < list.length; i++) {
      const shot = list[i];
      const idx = shots.findIndex((s) => s.id === shot.id);
      try {
        const r = await downloadWebsiteShot(shot, idx >= 0 ? idx : i);
        if (r === 'saved') saved++; else opened++;
      } catch { opened++; }
      // Small pause so the browser doesn't block rapid downloads.
      await new Promise((r) => setTimeout(r, 400));
    }
    setDlMsg(saved ? `Saved ${saved} to your downloads${opened ? ` (${opened} opened in a tab — right-click → Save image)` : ''}. Attach them in meta.ai.` : 'Downloads blocked — opened in tabs instead. Right-click → Save image.');
    setDlBusy(false);
  };

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
        const sitePages = Array.from(new Set<string>(good.flatMap((r: any) => r.data?.sitePages || []))).slice(0, 12);
        const needsJs = good.some((r: any) => r.data?.needsJs);
        set({ brand: { brandName: first.brandName || '', tagline: first.tagline || '', description: first.description || '', colors: first.colors || ['#111111'], logoUrl: first.logoUrl, cta: first.cta || 'Shop now', offer: '', testimonials: good.flatMap((r: any) => r.data?.testimonials || []).slice(0, 5), pinned: [], avoidWords: [], aboutStory, aboutPoints: points, aboutSource, sitePages } });
        const imgs = good.flatMap((r: any) => r.data?.heroImages || []).map((u: string, i: number) => ({ id: `web-${i}`, name: 'Website image', url: u, tag: 'Website' }));
        set({ assets: [...assets, ...imgs] });
        if (aboutStory) {
          setMsg(`Found “${first.brandName}” + brand story from about page (${aboutSource}). Your script will be built around it.`);
        } else if (needsJs) {
          setMsg(`Found "${first.brandName}", but its pages load content with JavaScript - I can see the shell but not the words. Just write your story in the Final script box below, then tap "Draft my script".`);
        } else {
          setMsg(`Found "${first.brandName}". No about page found - the script will lean on the homepage, or just write your version in the Final script box below.`);
        }
      } else {
        setMsg('That website would not let us read it. No problem - upload photos instead, or just write your script in the Final script box below.');
      }
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const pid = projectId || 'unassigned';
    const next = [...assets];
    for (const f of Array.from(files).slice(0, 12)) {
      const url = URL.createObjectURL(f);
      const id = `${Date.now()}-${f.name}`;
      next.push({ id, name: f.name, url, tag: 'Upload' });
      try {
        const { saveStoredBlob, blobKeyForAsset } = await import('@/lib/clips/db');
        await saveStoredBlob({ key: blobKeyForAsset(pid, id), projectId: pid, kind: 'asset', assetId: id, blob: f, name: f.name, mime: f.type || 'application/octet-stream', updatedAt: Date.now() });
      } catch { /* best-effort */ }
    }
    set({ assets: next });
  };

  const hdr = () => {
    // Judging mode: key store holds '__SERVER__' — API routes swap it for
    // the host's server key (META_API_KEY). Never send a real key from client.
    // Normal + demo: real BYOK key, or 'DEMO' for free mocks.
    const k = key || (JUDGING_MODE ? SERVER_KEY_PLACEHOLDER : 'DEMO');
    return { 'Content-Type': 'application/json', 'x-meta-key': k, 'x-meta-base-url': baseUrl || '' };
  };
  // Legacy: pre-2026-10-31 projects may carry snippets (paste-card). No UI to add
  // new ones - the Final script box is the single place to write/paste.

  async function draftMaster() {
    if (!brand.brandName && !brand.description && !brand.aboutStory) {
      setMsg('Scan a website above first - or just write your own script in the Final script box below, then approve it.');
      return;
    }
    setDrafting(true); setMsg('Drafting your script with your settings (length, platform, vibe) + website story…');
    try {
      const extra = '';
      const res = await fetch('/api/muse/script', {
        method: 'POST', headers: hdr(),
        body: JSON.stringify({ mode: 'master', brand, durationSec, platform, tone, sparkModel, extraContext: extra, guidance: scriptGuidance }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Draft failed');
      set({ masterScript: j.masterScript || '', masterApproved: false, script: null });
      setMsg('Draft ready below. Edit it however you like — nothing downstream uses it until you approve it.');
    } catch (e: any) { setMsg(e.message); } finally { setDrafting(false); }
  }


  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h2 className="text-xl font-bold">🏢 Tell us about your business</h2>
        <p className="text-sm text-neutral-600">Add a website and your own photos — we draft your script from them.</p>
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
                    try {
                      import('@/lib/clips/db').then(({ removeStoredBlob, blobKeyForAsset }) => {
                        removeStoredBlob(blobKeyForAsset(projectId || 'unassigned', a.id));
                        removeStoredBlob(`asset:${a.id}`); // legacy pre-library row
                      });
                    } catch {}
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
        <h3 className="font-semibold">🌐 Website page screenshots ({shots.length || 'none yet'} — free)</h3>
        <p className="text-sm text-neutral-600">Your main pages (up to 12 — home, about, services, pricing…) so meta.ai sees your real site. Tap to select, then save to your drive and attach them in meta.ai.</p>
        {shots.length === 0 ? (
          <p className="text-sm text-neutral-500 border border-dashed rounded-xl p-3">No pages yet — add your website above and tap “Read my website(s)” to fill this gallery. Fewer than 10 just means a smaller site — we show whatever exists.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 items-center text-sm">
              <button className="btn-secondary !py-1" onClick={() => setSelected(Object.fromEntries(shots.map((s) => [s.id, true])))}>Select all {shots.length}</button>
              <button className="btn-secondary !py-1" onClick={() => setSelected({})}>Clear</button>
              <button className="btn-primary !py-1" disabled={dlBusy || selectedShots.length === 0} onClick={() => downloadMany(selectedShots)}>{dlBusy ? 'Saving…' : `💾 Save selected (${selectedShots.length})`}</button>
              <button className="btn-secondary !py-1" disabled={dlBusy} onClick={() => downloadMany(shots)}>{dlBusy ? 'Saving…' : `💾 Save all ${shots.length}`}</button>
            </div>
            {dlMsg && <p className="text-sm bg-neutral-100 border rounded-xl p-3">{dlMsg}</p>}
            <div className="grid grid-cols-2 gap-2">
              {shots.map((sh, i) => {
                const on = !!selected[sh.id];
                return (
                  <div key={sh.id} className={`relative rounded-xl overflow-hidden border text-left ${on ? 'border-black ring-2 ring-black' : 'border-neutral-200'}`}>
                    <button onClick={() => toggleShot(sh.id)} className="block w-full" title={`${sh.pageUrl} — tap to ${on ? 'deselect' : 'select'}`}>
                      <ShotImg shot={sh} alt={sh.label} />
                    </button>
                    <div className="absolute top-1 left-1 flex gap-1">
                      <button onClick={() => toggleShot(sh.id)} className={`text-[11px] font-medium rounded-lg px-2 py-0.5 ${on ? 'bg-black text-white' : 'bg-white/90 border'}`}>{on ? '✓ Selected' : 'Select'}</button>
                    </div>
                    <div className="absolute top-1 right-1">
                      <button onClick={() => downloadWebsiteShot(sh, i).then((r) => setDlMsg(r === 'saved' ? `Saved ${i + 1} of ${shots.length} — attach it in meta.ai.` : 'Opened in a tab — right-click → Save image.'))} className="text-[11px] font-medium rounded-lg px-2 py-0.5 bg-white/90 border" title="Save this page to your drive">💾 Save</button>
                    </div>
                    <p className="text-[11px] px-2 py-1 truncate bg-white/95">{i + 1}. {sh.label}</p>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-neutral-500">Same pages appear under each Story prompt — attach the saved files in meta.ai so every part shows your real site.</p>
          </>
        )}
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">💬 Guide the script — what should it focus on or leave out?</h3>
        <p className="text-sm text-neutral-600">Tell the app in your own words. It is read before every draft — e.g. “Focus on family-owned mornings, skip pricing” or “Leave out the delivery angle, end on the BOGO offer”. Saved with your project; edit it any time and re-draft.</p>
        <textarea className="input" rows={2} value={scriptGuidance} onChange={(e) => set({ scriptGuidance: e.target.value })} placeholder='e.g. "Focus on the morning ritual and neighbors, leave out delivery…"' />
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">📜 Final script — written for your {durationSec}s {platform} cut</h3>
        <p className="text-sm text-neutral-600">Drafted from your website + about page with your Setup picks (length, platform, vibe) already in mind. Edit it freely — this exact wording is what the app will organize into scenes. Nothing downstream runs until you approve it.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" disabled={drafting} onClick={draftMaster}>{drafting ? 'Drafting…' : masterScript ? '🔄 Re-draft from sources' : '✨ Draft my script from website'}</button>
          {masterScript.trim() && !masterApproved && (
            <button className="btn-primary" onClick={() => set({ masterApproved: true })}>Approve this script →</button>
          )}
          {masterApproved && <span className="badge">✅ Approved — Story step will organize this</span>}
        </div>
        <textarea className="input" rows={8} value={masterScript} onChange={(e) => set({ masterScript: e.target.value, masterApproved: false })} placeholder="Or write/paste your final script here…" />
        {masterScript.trim() ? (
          <div className="flex justify-between items-center text-xs text-neutral-500">
            <span>{(() => { const f = masterFit(masterScript, durationSec); return `${f.wordCount} words · exactly ${f.targetWords} for ${durationSec}s · runs ~${f.secAtNatural}s at natural pace${f.isExact ? ' ✅ exact' : f.wordsDelta > 0 ? ` · +${f.wordsDelta} over — edit down or re-draft` : ` · ${f.wordsDelta} short — add lines or re-draft`}`; })()}</span>
            <button className="underline" onClick={() => { set({ masterScript: '', masterApproved: false }); }}>Clear draft</button>
          </div>
        ) : (
          <p className="text-sm text-neutral-500 border border-dashed rounded-xl p-3">No script yet — scan a website above, then tap “Draft my script from website”. You can also just type/paste your own script above.</p>
        )}
      </div>

      <div className="flex justify-between items-center"><button className="btn-secondary" onClick={onBack}>← Back</button><button className="btn-primary" disabled={!masterScript.trim() || !masterApproved} title={!masterScript.trim() ? 'Draft or paste your script first' : !masterApproved ? 'Approve the script to continue' : ''} onClick={onDone}>Continue →</button></div>
    </div>
  );
}

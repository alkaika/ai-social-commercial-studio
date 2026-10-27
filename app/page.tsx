import Link from 'next/link';

export default function Home() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Make a commercial in under 5 minutes</h1>
        <p className="text-lg text-neutral-600">No editing experience needed. No monthly subscription. Bring your own Meta key — you pay Meta directly, only for what you generate.</p>
        <div className="flex gap-3 justify-center">
          <Link href="/studio" className="btn-primary">Start my commercial →</Link>
          <Link href="/studio?demo=1" className="btn-secondary">Try the demo (no key needed)</Link>
        </div>
      </div>
      <div className="card space-y-2">
        <h2 className="font-semibold text-lg">How it works</h2>
        <ol className="list-decimal ml-5 space-y-1 text-neutral-700">
          <li>🔑 Connect your Meta key (checked once, optionally saved with Face ID / Windows Hello)</li>
          <li>✍️ Pick your writer — see exact costs + data rights, no jargon</li>
          <li>🏢 Add your website, photos, or pasted text</li>
          <li>✨ Press Generate — preview, edit, or just tell the AI what to change</li>
          <li>📤 Export for TikTok, Reels, Shorts, Instagram, YouTube, Facebook, X & LinkedIn</li>
        </ol>
      </div>
      <div className="card">
        <h2 className="font-semibold">Why BYOK?</h2>
        <p className="text-neutral-700">This studio is free to use. Your Meta key is like a password that lets the app use Meta&apos;s AI. It is encrypted on your device, sent only with your own requests over HTTPS, and never stored on our server.</p>
      </div>
    </main>
  );
}

'use client';
import type { WebsiteShot } from '@/lib/screenshots';
import ShotImg from '@/components/simple/ShotImg';

export default function WebsiteShots(props: {
  sceneId: string;
  imageUrl?: string;
  motionSource?: string;
  shots: WebsiteShot[];
  open: boolean;
  onToggle: () => void;
  onPick: (shot: WebsiteShot) => void;
  onClear: () => void;
}) {
  const { sceneId, imageUrl, motionSource, shots, open, onToggle, onPick, onClear } = props;
  const picked = motionSource === 'screenshot' && imageUrl;
  const pickedShot = shots.find((sh) => sh.imageUrl === imageUrl);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <button className="btn-secondary" onClick={onToggle}>
          {open ? 'Hide website shots' : 'Pick a website shot'}
        </button>
        {picked && (
          <button className="text-xs underline" onClick={onClear}>
            Remove shot
          </button>
        )}
      </div>
      {picked && pickedShot && (
        <div className="space-y-1">
          <div className="rounded-xl border overflow-hidden">
            <ShotImg shot={pickedShot} alt="Chosen website screenshot" />
          </div>
          <a href={pickedShot.pageUrl} target="_blank" rel="noreferrer" className="text-[11px] underline text-neutral-500">
            Open live page in new tab
          </a>
        </div>
      )}
      {open && (
        <div className="space-y-2">
          {shots.length === 0 ? (
            <p className="text-xs text-neutral-500 border border-dashed rounded-xl p-3">
              No website scanned yet — go back to Business, add your site and tap Scan, then come back here to pick a shot.
            </p>
          ) : (
            <>
              <p className="text-xs text-neutral-500">
                Tap a shot to use it for this scene. Landscape, edge to edge — slow zoom, free, no key.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {shots.map((sh) => {
                  const active = imageUrl === sh.imageUrl && motionSource === 'screenshot';
                  return (
                    <button
                      key={`${sh.id}-${sceneId}`}
                      onClick={() => onPick(sh)}
                      className={`relative rounded-xl overflow-hidden border text-left ${active ? 'border-black ring-2 ring-black' : 'border-neutral-200 hover:border-neutral-400'}`}
                      title={sh.pageUrl}
                    >
                      <ShotImg shot={sh} alt={sh.label} />
                      <span className="absolute bottom-1 left-1 right-1 text-[11px] font-medium bg-black/70 text-white rounded-lg px-2 py-0.5 truncate">
                        {active ? 'Picked — ' : ''}{sh.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}


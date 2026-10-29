import type { AdScript } from '@/lib/script-utils';

export function mockMasterScript(brandName: string) {
  return `${brandName} started with a simple promise: make something worth coming back for. Every morning starts early, every batch is made with care, and every customer is treated like a neighbor.\n\nNeighbors noticed. Word spread about the quality, the warmth, and the little details that turn a first visit into a habit. It is the kind of place people recommend without being asked.\n\nThis week there is one more reason to come by: a special offer for new and returning customers. Come taste the difference, bring someone you like, and see why this place earned its reputation.\n\nTap Shop Now and make it happen today.`;
}

export function mockScript(durationSec: number, sparkModel: any): AdScript {
  const counts: Record<number, number> = { 5: 1, 10: 2, 15: 3, 30: 5, 60: 7 };
  const n = counts[durationSec] ?? 3;
  const per = Math.max(2, Math.round(durationSec / n));
  const lines = [
    ['Hook', 'Fresh bread, baked every morning — taste the difference today.', 'Baked fresh daily', 'warm bakery close-up, steam rising, morning light', 'craft + daily ritual'],
    ['Proof', 'Local ingredients, real flavor, and neighbors who love us.', 'Loved by locals', 'happy customers, cozy storefront', 'community trust'],
    ['Offer', 'This week only: buy one, get one free. Come hungry!', 'BOGO this week', 'product hero shot, bold offer text space', 'offer'],
    ['Story', 'From our family oven to your table in under an hour.', 'Family owned', 'baker sliding tray from oven', 'family heritage'],
    ['Trust', 'Over 2,000 five-star reviews and counting.', '★★★★★ 2,000+ reviews', 'review cards floating over store', 'social proof'],
    ['Range', 'Croissants, sourdough, cakes — something for everyone.', 'Something for everyone', 'assorted pastries display', 'range'],
    ['CTA', 'Tap Shop Now and get it warm at your door.', 'Shop now', 'delivery bag, storefront logo, bright CTA', 'call to action'],
  ];
  const scenes = Array.from({ length: n }, (_, i) => {
    const L = lines[i % lines.length];
    return { id: `s${i + 1}`, heading: L[0], voiceover: L[1], onScreenText: L[2], visualPrompt: L[3], durationSec: per, storyBeat: L[4] };
  });
  return { scenes, totalSec: durationSec, sparkModel };
}

export function mockImage(prompt: string, aspect: string) {
  // Placeholder gradient SVG data URL — replaced by real generation when key present.
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='720' height='1280'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#111'/><stop offset='1' stop-color='#555'/></linearGradient></defs><rect width='100%' height='100%' fill='url(#g)'/><text x='50%' y='50%' fill='white' font-size='28' text-anchor='middle'>${(prompt || 'scene').slice(0, 40)}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

import type { AdScript } from '@/lib/script-utils';

// Sized to the slot: ~35 words at 10s, ~70 at 20s, ~210 at 60s (3.5 w/s).
// Fixed library keyed by duration so demo output always fits naturally.
// 5s / 15s keys kept only for legacy saves (they normalize to 10s / 20s).
const MOCKS: Record<number, string> = {
  5: 'Fresh daily. Baked this morning. Come taste the difference. Shop now.',
  10: 'Fresh bread, baked every morning — taste the difference today. Neighbors love the warmth, the quality, and those little details. Come hungry, leave happy, bring a friend. Shop now, fresh daily, warm from our oven.',
  15: 'Fresh bread, baked every morning — taste the difference today. Local ingredients, real flavor, and neighbors who love us. It started with a simple promise: make something worth coming back for. Every batch is made with care, every customer treated like family. This week: buy one, get one free. Come hungry, bring a friend, and see why everyone keeps coming back. Tap Shop Now, fresh daily from our oven today.',
  20: 'Fresh bread, baked every morning — taste the difference today. Local ingredients, real flavor, and neighbors who love us. It started with a simple promise: make something worth coming back for. Every batch is made with care, every customer treated like family. This week: buy one, get one free. Come hungry, bring a friend, and see why everyone keeps coming back. Tap Shop Now, fresh daily from our oven today.',
  30: 'Fresh bread, baked every morning — taste the difference today. It started with a promise: make something worth coming back for. Every batch is made with care, every customer treated like a neighbor. Local ingredients, real flavor, and reviews that keep piling up. Neighbors noticed, word spread about the quality, the warmth, and those little details. Croissants, sourdough, cakes — something for everyone, made fresh through the day. This week only: buy one, get one free for new and returning customers. Come hungry, bring someone you like, and see why this place earned its reputation. Tap Shop Now and get it warm at your door.',
  60: 'Fresh bread, baked every morning — taste the difference today. It started with a promise: make something worth coming back for. Every morning starts early, every batch is made with care, and every customer is treated like a neighbor, not a number. Neighbors noticed. Word spread about the quality, the warmth, and those little details that turn a first visit into a weekly habit. It is the kind of place people recommend without being asked. Croissants, sourdough, cakes — something for everyone, made fresh through the day by a family that still tastes every batch. Local ingredients, real flavor, ovens that never really cool, and over two thousand five-star reviews and counting. Parents grab breakfast, friends meet for coffee, weekend lines move fast. This week there is one more reason to come by: buy one, get one free for new and returning customers, fresh from our oven to your table. Come taste the difference, bring someone you like, and see why this place earned its reputation across the neighborhood. Stay for the smell, stay for the people, come back for the flavor. Tap Shop Now and get it warm at your door, still fresh from our oven to your table in under an hour, every single day, guaranteed fresh always.',
};

export function mockMasterScript(brandName: string, durationSec = 20) {
  const normalized = durationSec === 5 ? 10 : durationSec === 15 ? 20 : durationSec;
  const d = MOCKS[normalized] || MOCKS[20];
  return d.replace('Fresh bread', `${brandName} — fresh bread`);
}

export function mockScript(durationSec: number, sparkModel: any): AdScript {
  const normalized = durationSec === 5 ? 10 : durationSec === 15 ? 20 : durationSec;
  const counts: Record<number, number> = { 10: 1, 20: 2, 30: 3, 60: 6 };
  const n = counts[normalized] ?? 2;
  const per = Math.max(2, Math.round(normalized / n));
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
  return { scenes, totalSec: normalized, sparkModel };
}

export function mockImage(prompt: string, aspect: string) {
  // Placeholder gradient SVG data URL — replaced by real generation when key present.
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='720' height='1280'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#111'/><stop offset='1' stop-color='#555'/></linearGradient></defs><rect width='100%' height='100%' fill='url(#g)'/><text x='50%' y='50%' fill='white' font-size='28' text-anchor='middle'>${(prompt || 'scene').slice(0, 40)}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

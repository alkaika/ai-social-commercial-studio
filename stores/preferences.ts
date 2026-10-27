import { create } from 'zustand';

interface Prefs { lastWriter: 'spark-standard' | 'spark-contributor'; setLastWriter: (m: any) => void; }
export const usePrefs = create<Prefs>((set) => ({
  lastWriter: 'spark-contributor',
  setLastWriter: (m) => {
    try { localStorage.setItem('studio.lastWriter', m); } catch {}
    set({ lastWriter: m });
  },
}));
// hydrate
if (typeof window !== 'undefined') {
  try {
    const v = localStorage.getItem('studio.lastWriter');
    if (v === 'spark-standard' || v === 'spark-contributor') usePrefs.setState({ lastWriter: v as any });
  } catch {}
}

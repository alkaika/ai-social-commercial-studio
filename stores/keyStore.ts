import { create } from 'zustand';

// Memory-only. Never persisted. Tab close / refresh clears (unless sessionStorage opt-in elsewhere).
interface KeyState {
  key: string;
  baseUrl: string;
  modelStatus: Record<string, 'unknown' | 'ok' | 'fail'>;
  setKey: (key: string, baseUrl: string) => void;
  setStatus: (m: string, s: 'ok' | 'fail') => void;
  forget: () => void;
}

export const useKeyStore = create<KeyState>((set) => ({
  key: '',
  baseUrl: '',
  modelStatus: {},
  setKey: (key, baseUrl) => set({ key, baseUrl }),
  setStatus: (m, s) => set((st) => ({ modelStatus: { ...st.modelStatus, [m]: s } })),
  forget: () => set({ key: '', baseUrl: '', modelStatus: {} }),
}));

export const maskedKey = (k: string) => (k.length <= 8 ? '••••' : `${k.slice(0, 3)}••••••••${k.slice(-2)}`);

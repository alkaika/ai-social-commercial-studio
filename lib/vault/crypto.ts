// AES-GCM vault helpers. PRF output -> HKDF -> AES key.
export async function deriveAesKey(prfBytes: Uint8Array): Promise<CryptoKey> {
  const ikm = await crypto.subtle.importKey('raw', prfBytes as BufferSource, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new TextEncoder().encode('meta-studio-vault-v1'), info: new TextEncoder().encode('meta-key-enc') },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptWithKey(key: CryptoKey, plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, new TextEncoder().encode(plaintext));
  return { iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}

export async function decryptWithKey(key: CryptoKey, ivB64: string, ctB64: string) {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(ivB64) as BufferSource },
    key,
    unb64(ctB64) as BufferSource
  );
  return new TextDecoder().decode(pt);
}

export function b64(u: Uint8Array) { let s = ''; u.forEach((b) => (s += String.fromCharCode(b))); return btoa(s); }
export function unb64(s: string) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }

// IndexedDB (tiny wrapper, no dep needed for vault record)
const DB = 'meta-studio-vault';
export function idbSet(rec: { credId: string; iv: string; ct: string; baseUrl: string }) {
  return new Promise<void>((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onerror = () => rej(r.error);
    r.onsuccess = () => {
      const tx = r.result.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(rec, 'vault');
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    };
  });
}
export function idbGet(): Promise<{ credId: string; iv: string; ct: string; baseUrl: string } | null> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onerror = () => rej(r.error);
    r.onsuccess = () => {
      const tx = r.result.transaction('kv', 'readonly');
      const q = tx.objectStore('kv').get('vault');
      q.onsuccess = () => res((q.result as any) ?? null);
      q.onerror = () => rej(q.error);
    };
  });
}
export function idbClear() {
  return new Promise<void>((res) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onsuccess = () => {
        const tx = r.result.transaction('kv', 'readwrite');
        tx.objectStore('kv').delete('vault');
        tx.oncomplete = () => res();
        tx.onerror = () => res();
      };
      r.onerror = () => res();
    } catch { res(); }
  });
}

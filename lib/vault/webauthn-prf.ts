// WebAuthn PRF vault: register platform authenticator, store only ciphertext.
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { deriveAesKey, encryptWithKey, decryptWithKey, idbSet, idbGet, idbClear } from './crypto';

export const prfSupported = () =>
  typeof window !== 'undefined' &&
  !!navigator.credentials &&
  typeof (window as any).PublicKeyCredential !== 'undefined';

function b64url(u: Uint8Array) {
  let s = ''; u.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(s: string) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

const SALT = new TextEncoder().encode('meta-studio-prf-salt-v1');
// SALT as raw bytes: PRF eval.first must be a Uint8Array (fixed live
// 2026-10-27 — b64url string threw "not of type ArrayBufferView").

export async function vaultEnroll(metaKey: string, baseUrl: string) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const reg: any = await (startRegistration as any)({
    rp: { name: 'AI Commercial Studio', id: window.location.hostname },
    user: { id: b64url(userId), name: 'studio-user', displayName: 'Studio user' },
    challenge: b64url(challenge),
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
    extensions: { prf: { eval: { first: SALT } } },
  });
  const prfOut: string | undefined = (reg as any)?.clientExtensionResults?.prf?.results?.first;
  if (!prfOut) throw new Error('This device/browser did not return a PRF secret. Use session-only mode or Chrome/Edge with Windows Hello.');
  const aes = await deriveAesKey(unb64url(prfOut));
  const { iv, ct } = await encryptWithKey(aes, metaKey);
  await idbSet({ credId: reg.id, iv, ct, baseUrl });
  return { credId: reg.id as string };
}

export async function vaultUnlock(): Promise<{ key: string; baseUrl: string }> {
  const rec = await idbGet();
  if (!rec) throw new Error('No saved key on this device.');
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const auth: any = await (startAuthentication as any)({
    challenge: b64url(challenge),
    allowCredentials: [{ id: rec.credId, type: 'public-key' }],
    userVerification: 'required',
    extensions: { prf: { eval: { first: SALT } } },
  });
  const prfOut: string | undefined = auth?.clientExtensionResults?.prf?.results?.first;
  if (!prfOut) throw new Error('Unlock did not return a PRF secret.');
  const aes = await deriveAesKey(unb64url(prfOut));
  const key = await decryptWithKey(aes, rec.iv, rec.ct);
  return { key, baseUrl: rec.baseUrl };
}

export const vaultForget = () => idbClear();
export const vaultHas = async () => (await idbGet()) !== null;

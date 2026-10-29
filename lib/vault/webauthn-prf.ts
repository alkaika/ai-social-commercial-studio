// WebAuthn PRF vault: register authenticator, store only ciphertext.
// Two flavors, same crypto (PRF -> HKDF -> AES-GCM-256, IndexedDB holds ONLY
// {credId, iv, ct, baseUrl, kind} — never a plaintext key):
//  - Biometric (device-bound): authenticatorAttachment 'platform'
//    (Windows Hello / Face ID / Touch ID). Fastest on this device; no roaming.
//  - Passkey (synced): no attachment constraint -> the OS may offer password-
//    manager or security-key passkeys (Google, iCloud, 1Password, YubiKey),
//    which SYNC across the user's devices. The ciphertext stays in THIS
//    origin's IndexedDB; Export/Import moves the encrypted bundle (copy text)
//    with zero server involvement.
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { deriveAesKey, encryptWithKey, decryptWithKey, idbSet, idbGet, idbClear } from './crypto';
import type { VaultSlot } from './crypto';

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

export interface VaultResult { credId: string; kind: 'biometric' | 'passkey' }

// Biometric enroll: device-bound platform authenticator (Windows Hello /
// Face ID / Touch ID). Fastest on this device, does not roam.
export async function vaultEnroll(metaKey: string, baseUrl: string): Promise<VaultResult> {
  return enrollWith({ authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' } as any, metaKey, baseUrl, 'vault', 'biometric');
}

// Passkey enroll: NO attachment constraint, so the OS may offer synced
// passkeys (Google Password Manager, iCloud Keychain, 1Password, YubiKey).
// Same PRF-encryption; the passkey itself syncs (convenience), but the
// encrypted bundle stays in this origin's IndexedDB. Use Export/Import to
// move it between devices/browsers.
export async function vaultEnrollPasskey(metaKey: string, baseUrl: string): Promise<VaultResult> {
  return enrollWith({ userVerification: 'required', residentKey: 'required' } as any, metaKey, baseUrl, 'vault-passkey', 'passkey');
}

async function enrollWith(authSel: any, metaKey: string, baseUrl: string, slot: VaultSlot, kind: 'biometric' | 'passkey'): Promise<VaultResult> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const reg: any = await (startRegistration as any)({
    rp: { name: 'AI Commercial Studio', id: window.location.hostname },
    user: { id: b64url(userId), name: 'studio-user', displayName: 'Studio user' },
    challenge: b64url(challenge),
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: authSel,
    extensions: { prf: { eval: { first: SALT } } },
  });
  // PRF output may arrive as base64url STRING (v9) or ArrayBuffer (native).
  const rawPrf: string | ArrayBuffer | undefined = reg?.clientExtensionResults?.prf?.results?.first;
  const prfBytes = typeof rawPrf === 'string' ? unb64url(rawPrf) : rawPrf ? new Uint8Array(rawPrf) : undefined;
  if (!prfBytes) throw new Error(kind === 'passkey'
    ? 'That passkey did not return a PRF secret (some synced passkeys/providers do not support PRF yet). Try the biometrics option, or use session-only mode.'
    : 'This device/browser did not return a PRF secret. Use session-only mode or Chrome/Edge with Windows Hello.');
  const aes = await deriveAesKey(prfBytes);
  const { iv, ct } = await encryptWithKey(aes, metaKey);
  await idbSet({ credId: reg.id, iv, ct, baseUrl, kind }, slot);
  return { credId: reg.id as string, kind };
}

export async function vaultUnlock(): Promise<{ key: string; baseUrl: string }> {
  return unlockSlot('vault');
}

// Passkey unlock: same PRF-decrypt, reads the 'vault-passkey' slot.
export async function vaultUnlockPasskey(): Promise<{ key: string; baseUrl: string }> {
  return unlockSlot('vault-passkey');
}

async function unlockSlot(slot: VaultSlot): Promise<{ key: string; baseUrl: string }> {
  const rec = await idbGet(slot);
  if (!rec) throw new Error(slot === 'vault-passkey' ? 'No saved passkey on this device/browser.' : 'No saved key on this device.');
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const auth: any = await (startAuthentication as any)({
    challenge: b64url(challenge),
    allowCredentials: [{ id: rec.credId, type: 'public-key' }],
    userVerification: 'required',
    extensions: { prf: { eval: { first: SALT } } },
  });
  const rawPrf: string | ArrayBuffer | undefined = auth?.clientExtensionResults?.prf?.results?.first;
  const prfBytes = typeof rawPrf === 'string' ? unb64url(rawPrf) : rawPrf ? new Uint8Array(rawPrf) : undefined;
  if (!prfBytes) throw new Error('Unlock did not return a PRF secret.');
  const aes = await deriveAesKey(prfBytes);
  const key = await decryptWithKey(aes, rec.iv, rec.ct);
  return { key, baseUrl: rec.baseUrl };
}

export const vaultForget = () => idbClear(); // clears BOTH slots
export const vaultHas = async () => (await idbGet('vault')) !== null;
export const vaultHasPasskey = async () => (await idbGet('vault-passkey')) !== null;

// Export/import the ENCRYPTED bundle (copy text between devices/browsers).
// The Meta key stays encrypted — only someone with the SAME passkey + this
// app's origin can decrypt it. Zero server involvement.
// NOTE: PRF-derived ciphertext is bound to the originating passkey, so an
// imported bundle only unlocks on devices where THAT passkey syncs (e.g.
// same Google/iCloud account). This is by design — never exportable by us.
export async function vaultExport(slot: VaultSlot = 'vault-passkey'): Promise<string> {
  const rec = await idbGet(slot);
  if (!rec) throw new Error('Nothing to export — save with a passkey first.');
  return btoa(JSON.stringify(rec));
}
export async function vaultImport(payload: string, slot: VaultSlot = 'vault-passkey'): Promise<{ kind?: string }> {
  let rec: any;
  try { rec = JSON.parse(atob(payload.trim())); }
  catch { throw new Error('That text is not a valid exported vault bundle.'); }
  if (!rec?.credId || !rec?.iv || !rec?.ct) throw new Error('Bundle is missing fields (need credId, iv, ct).');
  await idbSet({ credId: rec.credId, iv: rec.iv, ct: rec.ct, baseUrl: rec.baseUrl || '', kind: rec.kind || 'passkey' }, slot);
  return { kind: rec.kind };
}

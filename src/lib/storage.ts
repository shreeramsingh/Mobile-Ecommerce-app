import { createMMKV } from 'react-native-mmkv';
import * as Keychain from 'react-native-keychain';

// Fast synchronous key-value storage for non-secret app state (cart, filters,
// recently viewed, cached profile). Secrets (the JWT) go in the Keychain below.
export const storage = createMMKV({ id: 'bandookwale' });

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = storage.getString(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  storage.set(key, JSON.stringify(value));
}

// ─── Secure token storage (iOS Keychain / Android Keystore) ──────────────────
const TOKEN_SERVICE = 'com.bandookwale.auth';

export const secureToken = {
  async get(): Promise<string | null> {
    try {
      const creds = await Keychain.getGenericPassword({ service: TOKEN_SERVICE });
      return creds ? creds.password : null;
    } catch {
      return null;
    }
  },
  async set(token: string) {
    await Keychain.setGenericPassword('jwt', token, {
      service: TOKEN_SERVICE,
      accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  },
  async clear() {
    try {
      await Keychain.resetGenericPassword({ service: TOKEN_SERVICE });
    } catch {
      // Nothing stored — fine.
    }
  },
};

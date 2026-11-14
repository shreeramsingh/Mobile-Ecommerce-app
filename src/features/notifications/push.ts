import { PermissionsAndroid, Platform } from 'react-native';
import { getApps } from '@react-native-firebase/app';
import {
  getMessaging,
  getToken,
  getInitialNotification,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  requestPermission,
  AuthorizationStatus,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { request } from '../../api/client';
import { storage } from '../../lib/storage';

// Push notifications for chat (Firebase Cloud Messaging → APNs on iOS).
//
// The backend (PushNotificationService) sends a push for every chat message to all
// devices registered for the recipient, with data { type: "CHAT_MESSAGE",
// conversationId, senderId, senderName, productTitle, unreadTotal } on the Android
// channel "chat_messages". The OS shows it when the app is in the background or closed.
//
// Everything here is a no-op until Firebase is configured (google-services.json /
// GoogleService-Info.plist added to the native projects), so the app is safe to ship
// before push is set up.

export const CHAT_CHANNEL_ID = 'chat_messages';
const LAST_TOKEN_KEY = 'push.lastToken';

export interface ChatPushData {
  type?: string;
  conversationId?: string;
  senderId?: string;
  senderName?: string;
  productTitle?: string;
  unreadTotal?: string;
}

/** True when the native Firebase config is present (the default app initialised itself). */
export const pushAvailable = () => {
  try {
    return getApps().length > 0;
  } catch {
    return false;
  }
};

const messaging = () => getMessaging();

/** Android: create the channel the backend targets (sound + heads-up). Safe to call often. */
async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await notifee.createChannel({
    id: CHAT_CHANNEL_ID,
    name: 'Chat messages',
    description: 'New messages from buyers and sellers',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    badge: true,
  });
}

/** Asks the user for permission (iOS prompt / Android 13+ POST_NOTIFICATIONS). */
async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    if (Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  }
  const status = await requestPermission(messaging());
  return status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
}

async function registerToken(token: string) {
  await request('/api/push/devices', {
    method: 'POST',
    body: { token, platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID' },
    responseType: 'none',
  });
  storage.set(LAST_TOKEN_KEY, token);
}

/**
 * Call after sign-in (and on every app start while signed in): gets permission,
 * registers this device for the signed-in user, and keeps the token up to date.
 * Returns an unsubscribe function.
 */
export async function startPush(): Promise<() => void> {
  if (!pushAvailable()) return () => {};
  try {
    await ensureAndroidChannel();
    if (!(await ensurePermission())) return () => {};
    const token = await getToken(messaging());
    if (token) await registerToken(token);
  } catch (e) {
    // Push must never break the app; it retries on the next start.
    console.warn('Push registration failed', e);
  }
  return onTokenRefresh(messaging(), (token) => {
    registerToken(token).catch(() => {});
  });
}

/** Call on sign-out BEFORE the JWT is dropped, so this phone stops getting the user's chats. */
export async function stopPush() {
  const token = storage.getString(LAST_TOKEN_KEY);
  if (!token) return;
  try {
    await request('/api/push/devices', { method: 'DELETE', query: { token }, responseType: 'none', timeoutMs: 5000 });
  } catch {
    // Best effort: the backend also re-assigns the token on the next login.
  } finally {
    storage.remove(LAST_TOKEN_KEY);
  }
}

const chatData = (m: RemoteMessage | null): ChatPushData | null => {
  const d = (m?.data ?? {}) as ChatPushData;
  return d.type === 'CHAT_MESSAGE' && d.conversationId ? d : null;
};

/**
 * Listens for pushes while the app runs:
 * - onForeground: a chat push arrived while the app is open (the OS doesn't show it).
 * - onOpen: the user tapped a chat notification (app was in background or closed).
 */
export function listenForPush(handlers: {
  onForeground: (data: ChatPushData, message: RemoteMessage) => void;
  onOpen: (data: ChatPushData) => void;
}): () => void {
  if (!pushAvailable()) return () => {};
  const unsubForeground = onMessage(messaging(), async (m) => {
    const d = chatData(m);
    if (d) handlers.onForeground(d, m);
  });
  const unsubOpened = onNotificationOpenedApp(messaging(), (m) => {
    const d = chatData(m);
    if (d) handlers.onOpen(d);
  });
  // App was launched by tapping a notification.
  getInitialNotification(messaging())
    .then((m) => {
      const d = chatData(m);
      if (d) handlers.onOpen(d);
    })
    .catch(() => {});
  return () => {
    unsubForeground();
    unsubOpened();
  };
}

/** Sets the app icon badge (iOS, and Android launchers that support it). */
export function setAppBadge(count: number) {
  notifee.setBadgeCount(Math.max(0, count)).catch(() => {});
}

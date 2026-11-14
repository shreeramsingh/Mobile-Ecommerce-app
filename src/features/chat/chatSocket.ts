import { Client, type StompSubscription } from '@stomp/stompjs';
import { WEB_ORIGIN, WS_URL } from '../../config/env';
import { getAuthToken } from '../../api/client';
import type { ChatMessage } from '../../api/chat';

// One shared STOMP connection for the whole app. Screens subscribe to topics
// (a conversation, or the signed-in user's inbox); the client reconnects
// automatically and re-subscribes everything after a reconnect.

type Listener = (m: ChatMessage & Record<string, any>) => void;
type StatusListener = (connected: boolean) => void;

const topicListeners = new Map<string, Set<Listener>>();
const subscriptions = new Map<string, StompSubscription>();
const statusListeners = new Set<StatusListener>();
const reconnectListeners = new Set<() => void>();
let client: Client | null = null;
let connected = false;
let refCount = 0;

const setConnected = (v: boolean) => {
  connected = v;
  statusListeners.forEach((l) => l(v));
};

// Keys of topicListeners/subscriptions are full STOMP destinations.
const subscribeTopic = (destination: string) => {
  if (!client?.connected || subscriptions.has(destination)) return;
  const sub = client.subscribe(destination, (frame) => {
    try {
      const msg = JSON.parse(frame.body);
      topicListeners.get(destination)?.forEach((l) => l(msg));
    } catch {
      // Ignore malformed frames.
    }
  });
  subscriptions.set(destination, sub);
};

function addListener(destination: string, listener: Listener) {
  let set = topicListeners.get(destination);
  if (!set) topicListeners.set(destination, (set = new Set()));
  set.add(listener);
  subscribeTopic(destination);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) {
      topicListeners.delete(destination);
      subscriptions.get(destination)?.unsubscribe();
      subscriptions.delete(destination);
    }
  };
}

function ensureClient() {
  if (client) return client;
  const token = getAuthToken();
  client = new Client({
    // React Native sends `Origin: <the API host>` on WebSocket handshakes, which the
    // backend's allowed-origins check rejects (403). Open the socket ourselves with the
    // website's origin, which the backend allows (same as the browser).
    webSocketFactory: () =>
      new (WebSocket as any)(WS_URL, ['v12.stomp', 'v11.stomp', 'v10.stomp'], {
        headers: { Origin: WEB_ORIGIN },
      }),
    connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    reconnectDelay: 3000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    // React Native WebSocket quirks (recommended by stompjs).
    forceBinaryWSFrames: true,
    appendMissingNULLonIncoming: true,
    // Development builds log the STOMP handshake to Metro to diagnose connection problems.
    debug: __DEV__
      ? (m: string) => console.log('[chat-socket]', m.replace(/Authorization:[^\n]*/g, 'Authorization:<hidden>').slice(0, 200))
      : () => {},
    onWebSocketError: (e) => {
      if (__DEV__) console.warn('[chat-socket] websocket error', (e as any)?.message ?? e);
    },
    onConnect: () => {
      subscriptions.clear();
      topicListeners.forEach((_, id) => subscribeTopic(id));
      setConnected(true);
      reconnectListeners.forEach((l) => l());
    },
    onWebSocketClose: () => {
      subscriptions.clear();
      setConnected(false);
    },
    onStompError: () => setConnected(false),
  });
  client.activate();
  return client;
}

export const chatSocket = {
  /** Keep the connection open while at least one chat screen is mounted. */
  retain() {
    refCount += 1;
    ensureClient();
    return () => {
      refCount -= 1;
      if (refCount <= 0) {
        refCount = 0;
        const c = client;
        client = null;
        subscriptions.clear();
        setConnected(false);
        c?.deactivate();
      }
    };
  },

  /** Messages in one conversation. */
  subscribe(conversationId: string, listener: Listener) {
    return addListener(`/topic/chat/${conversationId}`, listener);
  },

  /** Every message addressed to this user, from any conversation (for notifications). */
  subscribeInbox(userId: string, listener: Listener) {
    return addListener(`/topic/inbox/${userId}`, listener);
  },

  send(conversationId: string, message: ChatMessage): boolean {
    if (!client?.connected) return false;
    const { pending: _p, queued: _q, ...body } = message;
    void _p;
    void _q;
    client.publish({ destination: `/app/chat.send/${conversationId}`, body: JSON.stringify(body) });
    return true;
  },

  isConnected: () => connected,
  onStatus(l: StatusListener) {
    statusListeners.add(l);
    l(connected);
    return () => statusListeners.delete(l);
  },
  onReconnect(l: () => void) {
    reconnectListeners.add(l);
    return () => reconnectListeners.delete(l);
  },
};

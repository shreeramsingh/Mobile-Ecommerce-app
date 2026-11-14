import { useEffect } from 'react';
import { listenForPush, setAppBadge, startPush, type ChatPushData } from './push';
import { store, useAppSelector } from '../../store';
import { selectUnreadTotal, setUnread, showBanner } from '../../store/slices/chatSlice';
import { chatApi, parseConversationId } from '../../api/chat';
import { navigationRef } from '../../navigation/navigationRef';

/** Opens the chat a notification is about (waits for navigation if the app is just starting). */
function openChatFromPush(d: ChatPushData) {
  const go = () => {
    const { productId, sellerId } = parseConversationId(d.conversationId!);
    navigationRef.navigate('Chat', {
      conversationId: d.conversationId,
      productId,
      sellerId,
      productTitle: d.productTitle || undefined,
      peerName: d.senderName || undefined,
    });
  };
  if (navigationRef.isReady()) go();
  else {
    const t = setInterval(() => {
      if (navigationRef.isReady() && store.getState().auth.status !== 'loading') {
        clearInterval(t);
        go();
      }
    }, 200);
    setTimeout(() => clearInterval(t), 10_000);
  }
}

/**
 * Wires push notifications into the app for the signed-in user:
 * registers the device, opens chats from tapped notifications, shows the in-app
 * banner for pushes that arrive while the app is open, and keeps the badge in sync.
 */
export function PushHost() {
  const signedIn = useAppSelector((s) => s.auth.status === 'signedIn');
  const userId = useAppSelector((s) => s.auth.user?.nodeId ?? null);
  const unreadTotal = useAppSelector(selectUnreadTotal);

  useEffect(() => {
    if (!signedIn || !userId) return;
    let stopTokenRefresh: (() => void) | null = null;
    let cancelled = false;
    startPush().then((stop) => {
      if (cancelled) stop();
      else stopTokenRefresh = stop;
    });

    const stopListening = listenForPush({
      onOpen: openChatFromPush,
      onForeground: (d) => {
        // The live socket usually delivers this too; the banner is idempotent and the
        // counts are re-read from the server so nothing is double-counted.
        const { activeConversationId } = store.getState().chat;
        if (activeConversationId === d.conversationId) return;
        store.dispatch(
          showBanner({
            conversationId: d.conversationId!,
            senderId: d.senderId ?? '',
            senderName: d.senderName || undefined,
            content: '',
            timestamp: new Date().toISOString(),
            productTitle: d.productTitle || undefined,
          }),
        );
        chatApi
          .unread(userId)
          .then((map) => {
            const active = store.getState().chat.activeConversationId;
            if (active) delete map[active];
            store.dispatch(setUnread(map));
          })
          .catch(() => {});
      },
    });

    return () => {
      cancelled = true;
      stopTokenRefresh?.();
      stopListening();
    };
  }, [signedIn, userId]);

  // App icon badge = unread chats (cleared on sign-out).
  useEffect(() => {
    setAppBadge(signedIn ? unreadTotal : 0);
  }, [signedIn, unreadTotal]);

  return null;
}

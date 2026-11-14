import React, { useEffect, useRef } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigationRef } from '../../navigation/navigationRef';
import { useQueryClient } from '@tanstack/react-query';
import { MessageCircle, X } from 'lucide-react-native';
import { chatApi, parseConversationId, type IncomingChatMessage } from '../../api/chat';
import { chatSocket } from './chatSocket';
import { useAppDispatch, useAppSelector, store } from '../../store';
import {
  clearUnread,
  hideBanner,
  incrementUnread,
  resetChat,
  setUnread,
  showBanner,
} from '../../store/slices/chatSlice';
import { ProductImage } from '../../components/ProductImage';
import { colors, font, radius } from '../../theme';

const BANNER_MS = 7000;

/** Marks a conversation read locally and on the server (best effort). */
export function markConversationRead(conversationId: string) {
  const userId = store.getState().auth.user?.nodeId;
  store.dispatch(clearUnread(conversationId));
  if (userId && conversationId) chatApi.markRead(conversationId, userId).catch(() => {});
}

/**
 * Chat notifications for the signed-in user (same behaviour as the website):
 * loads unread counts, listens to /topic/inbox/{userId} for new messages in any
 * conversation, counts them as unread unless that chat is open, and shows an
 * in-app banner that opens the chat.
 */
export function ChatNotificationHost() {
  const dispatch = useAppDispatch();
  const qc = useQueryClient();
  const userId = useAppSelector((s) => (s.auth.status === 'signedIn' ? s.auth.user?.nodeId ?? null : null));

  useEffect(() => {
    dispatch(resetChat());
    if (!userId) return;
    let cancelled = false;
    chatApi
      .unread(userId)
      .then((map) => !cancelled && dispatch(setUnread(map)))
      .catch(() => {});

    const release = chatSocket.retain();
    const unsubscribe = chatSocket.subscribeInbox(userId, (raw) => {
      const msg = raw as unknown as IncomingChatMessage;
      if (!msg?.conversationId || msg.senderId === userId) return;
      // Conversation list shows the new last message / order.
      qc.invalidateQueries({ queryKey: ['conversations'] });
      const { activeConversationId } = store.getState().chat;
      const viewing = activeConversationId === msg.conversationId && AppState.currentState === 'active';
      if (viewing) {
        markConversationRead(msg.conversationId);
        return;
      }
      dispatch(incrementUnread(msg.conversationId));
      dispatch(showBanner(msg));
    });

    // Refresh counts when the app comes back to the foreground (messages may have
    // arrived while the socket was suspended in the background).
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      chatApi.unread(userId).then((map) => {
        const active = store.getState().chat.activeConversationId;
        if (active) delete map[active];
        dispatch(setUnread(map));
      }).catch(() => {});
    });

    return () => {
      cancelled = true;
      unsubscribe();
      release();
      sub.remove();
    };
  }, [userId, dispatch, qc]);

  return <NewMessageBanner />;
}

function NewMessageBanner() {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const banner = useAppSelector((s) => s.chat.banner);
  const activeConversation = useAppSelector((s) => s.chat.activeConversationId);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide; each new message restarts the timer.
  useEffect(() => {
    if (!banner) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => dispatch(hideBanner()), BANNER_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [banner, dispatch]);

  // Hide if the user opened that chat.
  useEffect(() => {
    if (banner && activeConversation === banner.conversationId) dispatch(hideBanner());
  }, [banner, activeConversation, dispatch]);

  if (!banner) return null;

  const open = () => {
    dispatch(hideBanner());
    const { productId, sellerId } = parseConversationId(banner.conversationId);
    if (!navigationRef.isReady()) return;
    navigationRef.navigate('Chat', {
      conversationId: banner.conversationId,
      productId,
      sellerId,
      productTitle: banner.productTitle,
      productImage: banner.productImage,
    });
  };

  return (
    <View style={[styles.wrap, { top: insets.top + 8 }]} pointerEvents="box-none">
      <Pressable style={styles.card} onPress={open} accessibilityRole="button" accessibilityLiveRegion="polite">
        {banner.productImage ? (
          <ProductImage uri={banner.productImage} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.iconBox]}>
            <MessageCircle size={20} color={colors.onAccent} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{banner.senderName || 'New message'}</Text>
          {banner.content ? <Text style={styles.content} numberOfLines={2}>{banner.content}</Text> : <Text style={styles.content}>Sent you a message</Text>}
          {banner.productTitle ? <Text style={styles.product} numberOfLines={1}>Re: {banner.productTitle}</Text> : null}
          <Text style={styles.cta}>Open chat →</Text>
        </View>
        <Pressable onPress={() => dispatch(hideBanner())} hitSlop={10} accessibilityLabel="Dismiss">
          <X size={18} color={colors.gray500} />
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 1000 },
  card: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: radius.lg,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  image: { width: 40, height: 40, borderRadius: 10 },
  iconBox: { backgroundColor: colors.gold500, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.white, fontWeight: '800', fontSize: font.md },
  content: { color: colors.gray700, fontSize: font.sm, marginTop: 2 },
  product: { color: colors.gray500, fontSize: font.xs, marginTop: 2 },
  cta: { color: colors.gold500, fontWeight: '700', fontSize: font.xs, marginTop: 4 },
});

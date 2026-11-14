import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react-native';
import type { RootScreenProps } from '../../navigation/types';
import { chatApi, makeConversationId, parseConversationId, type ChatMessage } from '../../api/chat';
import { chatSocket } from './chatSocket';
import { useAppDispatch, useAppSelector } from '../../store';
import { setActiveConversation } from '../../store/slices/chatSlice';
import { markConversationRead } from './ChatNotificationHost';
import { ProductImage } from '../../components/ProductImage';
import { AppText, Loader } from '../../components/ui';
import { colors, font, radius } from '../../theme';

const sameMessage = (a: ChatMessage, b: ChatMessage) =>
  a.senderId === b.senderId && a.content === b.content && a.timestamp === b.timestamp;

export function ChatScreen({ route, navigation }: RootScreenProps<'Chat'>) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  // While the keyboard is up, the home-indicator / nav-bar inset isn't needed under the input.
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const user = useAppSelector((s) => s.auth.user);
  const qc = useQueryClient();
  const userId = user?.nodeId ?? '';
  const userName = user?.name || 'Me';
  const p = route.params;

  const conversationId =
    p.conversationId ?? (p.productId && p.sellerId ? makeConversationId(p.productId, p.sellerId, userId) : '');
  const { sellerId } = parseConversationId(conversationId);
  const iAmSeller = sellerId === userId;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(p.initialMessage ?? '');
  const [connected, setConnected] = useState(chatSocket.isConnected());
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const historyQ = useQuery({
    queryKey: ['chatHistory', conversationId],
    queryFn: () => chatApi.history(conversationId),
    enabled: !!conversationId,
    staleTime: 0,
  });

  // Merge server history with anything already on screen (e.g. optimistic sends).
  useEffect(() => {
    if (!historyQ.data) return;
    setMessages((prev) => {
      const local = prev.filter((m) => (m.pending || m.queued) && !historyQ.data!.some((h) => sameMessage(h, m)));
      return [...historyQ.data!, ...local];
    });
  }, [historyQ.data]);

  // Socket: connect, subscribe, track status, flush queued messages, refetch after reconnect.
  useEffect(() => {
    if (!conversationId) return;
    const release = chatSocket.retain();
    const unsub = chatSocket.subscribe(conversationId, (msg) => {
      setMessages((prev) => {
        const i = prev.findIndex((m) => (m.pending || m.queued) && sameMessage(m, msg));
        if (i >= 0) {
          const next = [...prev];
          next[i] = msg;
          return next;
        }
        return prev.some((m) => sameMessage(m, msg)) ? prev : [...prev, msg];
      });
    });
    const offStatus = chatSocket.onStatus(setConnected);
    const offReconnect = chatSocket.onReconnect(() => {
      historyQ.refetch();
      setMessages((prev) =>
        prev.map((m) => {
          if (!m.queued) return m;
          const sent = chatSocket.send(conversationId, m);
          return sent ? { ...m, queued: false, pending: true } : m;
        }),
      );
    });
    return () => {
      unsub();
      offStatus();
      offReconnect();
      release();
      qc.invalidateQueries({ queryKey: ['conversations'] });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // While this chat is open its messages aren't counted as unread; opening it marks it read.
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (!conversationId) return;
    dispatch(setActiveConversation(conversationId));
    markConversationRead(conversationId);
    return () => {
      dispatch(setActiveConversation(null));
    };
  }, [conversationId, dispatch]);

  const peerName = useMemo(() => {
    const fromMessages = messages.find((m) => m.senderId !== userId && m.senderName)?.senderName;
    if (fromMessages) return fromMessages;
    if (p.peerName) return p.peerName;
    if (!iAmSeller && p.sellerName) return p.sellerName;
    return iAmSeller ? 'Buyer' : 'Seller';
  }, [messages, userId, iAmSeller, p.sellerName, p.peerName]);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 260 }}>
          <ProductImage uri={p.productImage} style={{ width: 34, height: 34, borderRadius: 8 }} />
          <View style={{ flexShrink: 1 }}>
            <Text style={{ color: colors.white, fontWeight: '700' }} numberOfLines={1}>
              {peerName}
              <Text style={{ color: colors.gray400, fontWeight: '400', fontSize: 11 }}>  {iAmSeller ? 'Buyer' : 'Seller'}</Text>
            </Text>
            {p.productTitle ? (
              <Text style={{ color: colors.gray600, fontSize: 11 }} numberOfLines={1}>Re: {p.productTitle}</Text>
            ) : null}
          </View>
        </View>
      ),
      headerRight: () => (
        <View style={[styles.status, { backgroundColor: connected ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)' }]}>
          <View style={[styles.statusDot, { backgroundColor: connected ? colors.green500 : colors.red500 }]} />
          <Text style={{ color: connected ? '#86efac' : '#fca5a5', fontSize: 11, fontWeight: '700' }}>
            {connected ? 'Live' : 'Offline'}
          </Text>
        </View>
      ),
    });
  }, [navigation, peerName, iAmSeller, p.productImage, p.productTitle, connected]);

  const send = useCallback(() => {
    const content = input.trim();
    if (!content || !conversationId) return;
    const msg: ChatMessage = {
      senderId: userId,
      senderName: userName,
      content,
      timestamp: new Date().toISOString(),
      type: 'CHAT',
      // Lets the other person's inbox/notification show which product this is about.
      ...(p.productTitle ? { productTitle: p.productTitle } : {}),
      ...(p.productImage ? { productImage: p.productImage } : {}),
    };
    const sent = chatSocket.send(conversationId, msg);
    setMessages((prev) => [...prev, { ...msg, pending: sent, queued: !sent }]);
    setInput('');
  }, [input, conversationId, userId, userName, p.productTitle, p.productImage]);

  if (!conversationId) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <AppText muted style={{ textAlign: 'center' }}>No chat data found.</AppText>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.gray100 }}
      // The app is edge-to-edge on Android, so the window no longer resizes for the
      // keyboard — pad on both platforms, offset by the header above this screen.
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
    >
      {historyQ.isLoading ? (
        <Loader style={{ flex: 1 }} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m, i) => `${m.timestamp}-${m.senderId}-${i}`}
          contentContainerStyle={{ padding: 12, gap: 6, flexGrow: 1 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <AppText muted style={{ textAlign: 'center' }}>No messages yet. Say hi! 👋</AppText>
            </View>
          }
          renderItem={({ item }) => {
            const mine = item.senderId === userId;
            return (
              <View style={[styles.bubbleWrap, mine ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
                {!mine && item.senderName ? <Text style={styles.sender}>{item.senderName}</Text> : null}
                <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                  <Text style={{ color: mine ? colors.onAccent : colors.gray900, fontSize: font.md }}>{item.content}</Text>
                  <Text style={[styles.time, { color: mine ? 'rgba(17,21,34,0.65)' : colors.gray400 }]}>
                    {new Date(item.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    {mine ? (item.queued ? '  · waiting for connection' : item.pending ? '  · sending' : '  ✓') : ''}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}
      <View style={[styles.inputBar, { paddingBottom: keyboardOpen ? 8 : Math.max(insets.bottom, 8) }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor={colors.gray400}
          style={styles.input}
          multiline
          maxLength={2000}
        />
        <Pressable
          onPress={send}
          disabled={!input.trim()}
          style={[styles.sendBtn, !input.trim() && { opacity: 0.4 }]}
          accessibilityLabel="Send message"
        >
          <Send size={20} color={colors.onAccent} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  bubbleWrap: { width: '100%' },
  sender: { fontSize: 11, color: colors.gray500, marginLeft: 6, marginBottom: 2 },
  bubble: { maxWidth: '80%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  mine: { backgroundColor: colors.gold500, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: colors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.gray200 },
  time: { fontSize: 10, marginTop: 3, alignSelf: 'flex-end' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.gray100,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: font.md,
    color: colors.gray900,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gold500,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

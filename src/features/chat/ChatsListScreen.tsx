import React from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react-native';
import { chatApi, parseConversationId } from '../../api/chat';
import { useAppSelector } from '../../store';
import { ProductImage } from '../../components/ProductImage';
import { Button, EmptyState, ErrorBox, Loader } from '../../components/ui';
import { errorMessage } from '../../api/client';
import { timeAgo } from '../../lib/format';
import { colors, font } from '../../theme';

export function ChatsListScreen() {
  const navigation = useNavigation();
  const user = useAppSelector((s) => s.auth.user);
  const unreadByConversation = useAppSelector((s) => s.chat.unreadByConversation);
  const userId = user?.nodeId ?? '';
  const q = useQuery({
    queryKey: ['conversations', userId],
    queryFn: () => chatApi.conversations(userId),
    enabled: !!userId,
    refetchInterval: 30_000,
  });

  if (!userId) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="Your chats"
        message="Sign in to chat with buyers and sellers."
        action={<Button title="Sign In" onPress={() => navigation.navigate('SignIn')} />}
      />
    );
  }
  if (q.isLoading) return <Loader style={{ flex: 1 }} />;

  // Hide "self" conversations (owner opened chat on their own product with no buyer).
  const conversations = (q.data ?? [])
    .filter((c) => {
      const { sellerId, buyerId } = parseConversationId(c.conversationId);
      return sellerId !== buyerId;
    })
    .sort((a, b) => (b.lastTimestamp ?? '').localeCompare(a.lastTimestamp ?? ''));

  return (
    <FlatList
      style={{ backgroundColor: colors.surface }}
      data={conversations}
      keyExtractor={(c) => c.conversationId}
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.gold500} />}
      contentContainerStyle={{ flexGrow: 1 }}
      ListHeaderComponent={q.error ? <View style={{ padding: 12 }}><ErrorBox message={errorMessage(q.error)} onRetry={q.refetch} /></View> : undefined}
      ListEmptyComponent={
        <EmptyState icon={MessageCircle} title="No chats yet" message={'Open a product and tap "Chat" to message the seller.'} />
      }
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      renderItem={({ item }) => {
        const { sellerId, productId } = parseConversationId(item.conversationId);
        const iAmSeller = sellerId === userId;
        const role = iAmSeller ? 'Buyer' : 'Seller';
        const name = item.peerName || (!iAmSeller && item.sellerName ? item.sellerName : role);
        const unread = unreadByConversation[item.conversationId] ?? 0;
        const mine = !!item.lastSenderId && item.lastSenderId === userId;
        const last = item.lastMessage ? `${mine ? 'You: ' : ''}${item.lastMessage}` : item.productTitle || 'No messages yet';
        return (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.gray50 }]}
            onPress={() =>
              navigation.navigate('Chat', {
                conversationId: item.conversationId,
                productId,
                productTitle: item.productTitle,
                productImage: item.productImage,
                sellerId,
                sellerName: item.sellerName,
                peerName: item.peerName,
              })
            }
          >
            <ProductImage uri={item.productImage} style={styles.thumb} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.name} numberOfLines={1}>{name}</Text>
                {name !== role && <Text style={styles.role}>{role}</Text>}
                <View style={{ flex: 1 }} />
                {item.lastTimestamp ? (
                  <Text style={[styles.time, unread > 0 && { color: colors.gold500, fontWeight: '700' }]}>
                    {timeAgo(item.lastTimestamp)}
                  </Text>
                ) : null}
              </View>
              {item.productTitle ? <Text style={styles.product} numberOfLines={1}>{item.productTitle}</Text> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.last, { flex: 1 }, unread > 0 && { color: colors.white, fontWeight: '700' }]} numberOfLines={1}>
                  {last}
                </Text>
                {unread > 0 && (
                  <View style={styles.unread}>
                    <Text style={styles.unreadText}>{unread > 99 ? '99+' : unread}</Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'center' },
  thumb: { width: 52, height: 52, borderRadius: 12 },
  name: { fontSize: font.md, fontWeight: '700', color: colors.gray900, flexShrink: 1 },
  role: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.gold600,
    backgroundColor: 'rgba(245,179,1,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  time: { fontSize: font.xs, color: colors.gray400 },
  unread: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: colors.red500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  product: { fontSize: font.xs, color: colors.gold600, marginTop: 2 },
  last: { fontSize: font.sm, color: colors.gray500, marginTop: 2 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.gray200, marginLeft: 78 },
});

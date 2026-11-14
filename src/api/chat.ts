import { request } from './client';

export interface ChatMessage {
  senderId: string;
  senderName?: string;
  content: string;
  timestamp: string; // ISO
  type?: 'CHAT' | 'JOIN' | 'LEAVE';
  /** Sent with each message so the inbox/notifications can show the product. */
  productTitle?: string;
  productImage?: string;
  /** Client-only: true until the server echoes the message back. */
  pending?: boolean;
  /** Client-only: queued while offline. */
  queued?: boolean;
}

export interface Conversation {
  conversationId: string;
  productTitle?: string;
  productImage?: string;
  sellerName?: string;
  /** The other person's name, as the backend learned it. */
  peerName?: string;
  lastMessage?: string;
  lastTimestamp?: string;
  lastSenderId?: string;
}

/** A message pushed to /topic/inbox/{userId} (any conversation). */
export interface IncomingChatMessage {
  conversationId: string;
  senderId: string;
  senderName?: string;
  content: string;
  timestamp: string;
  productTitle?: string;
  productImage?: string;
}

/** Conversations are keyed `${productId}-${sellerId}-${buyerId}` (same as the website). */
export const makeConversationId = (productId: string, sellerId: string, buyerId: string) =>
  `${productId}-${sellerId}-${buyerId}`;

export const parseConversationId = (id: string) => {
  const parts = id.split('-');
  return {
    productId: parts.slice(0, -2).join('-'),
    sellerId: parts[parts.length - 2],
    buyerId: parts[parts.length - 1],
  };
};

const isUsable = (id?: string | null) => !!id && !id.includes('undefined');

export const chatApi = {
  history: async (conversationId: string): Promise<ChatMessage[]> => {
    if (!isUsable(conversationId)) return [];
    const res = await request<unknown>(`/api/chat/history/${encodeURIComponent(conversationId)}`, { auth: false });
    return Array.isArray(res) ? (res as ChatMessage[]) : [];
  },
  /** Unread counts per conversation for this user. */
  unread: async (userId: string): Promise<Record<string, number>> => {
    if (!isUsable(userId)) return {};
    const res = await request<{ conversations?: Record<string, number> }>(
      `/api/chat/unread/${encodeURIComponent(userId)}`,
      { auth: false },
    );
    return res?.conversations ?? {};
  },

  /** Marks a conversation read for this user (best effort). */
  markRead: (conversationId: string, userId: string) =>
    request(`/api/chat/read/${encodeURIComponent(conversationId)}`, {
      method: 'POST',
      query: { userId },
      responseType: 'none',
    }),

  conversations: async (userId: string): Promise<Conversation[]> => {
    if (!isUsable(userId)) return [];
    const res = await request<unknown>(`/api/chat/conversations/${encodeURIComponent(userId)}`, { auth: false });
    return Array.isArray(res) ? (res as Conversation[]) : [];
  },
};

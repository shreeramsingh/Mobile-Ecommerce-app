import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { IncomingChatMessage } from '../../api/chat';

// Unread chat counts (per conversation) and the in-app "new message" banner.
interface ChatState {
  unreadByConversation: Record<string, number>;
  /** Conversation currently open on screen, so its messages aren't counted as unread. */
  activeConversationId: string | null;
  /** Latest message to show in the banner, or null when hidden. */
  banner: IncomingChatMessage | null;
}

const initialState: ChatState = { unreadByConversation: {}, activeConversationId: null, banner: null };

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setUnread(state, action: PayloadAction<Record<string, number>>) {
      state.unreadByConversation = action.payload;
    },
    incrementUnread(state, action: PayloadAction<string>) {
      const id = action.payload;
      state.unreadByConversation[id] = (state.unreadByConversation[id] ?? 0) + 1;
    },
    clearUnread(state, action: PayloadAction<string>) {
      delete state.unreadByConversation[action.payload];
    },
    setActiveConversation(state, action: PayloadAction<string | null>) {
      state.activeConversationId = action.payload;
      if (action.payload) delete state.unreadByConversation[action.payload];
    },
    showBanner(state, action: PayloadAction<IncomingChatMessage>) {
      state.banner = action.payload;
    },
    hideBanner(state) {
      state.banner = null;
    },
    resetChat() {
      return initialState;
    },
  },
});

export const { setUnread, incrementUnread, clearUnread, setActiveConversation, showBanner, hideBanner, resetChat } =
  chatSlice.actions;
export default chatSlice.reducer;

type WithChat = { chat: ChatState };
export const selectUnreadByConversation = (s: WithChat) => s.chat.unreadByConversation;
export const selectUnreadTotal = (s: WithChat) =>
  Object.values(s.chat.unreadByConversation).reduce((n, c) => n + c, 0);

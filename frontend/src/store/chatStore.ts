import { create } from 'zustand';
import { Message } from '@/api/messages';

interface TypingUser {
  userId: string;
  userName: string;
  channelId: string;
}

interface ChatState {
  messagesByChannel: Record<string, Message[]>;
  cursors: Record<string, string | null>;
  hasMore: Record<string, boolean>;
  typingUsers: TypingUser[];
  presenceMap: Record<string, 'online' | 'offline'>;

  setMessages: (channelId: string, msgs: Message[], cursor: string | null, hasMore: boolean) => void;
  prependMessages: (channelId: string, msgs: Message[], cursor: string | null) => void;
  addMessage: (channelId: string, msg: Message) => void;
  setTyping: (user: TypingUser) => void;
  clearTyping: (userId: string, channelId: string) => void;
  setPresence: (userId: string, status: 'online' | 'offline') => void;
  clearChannel: (channelId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messagesByChannel: {},
  cursors: {},
  hasMore: {},
  typingUsers: [],
  presenceMap: {},

  setMessages: (channelId, msgs, cursor, hasMore) =>
    set((s) => ({
      messagesByChannel: { ...s.messagesByChannel, [channelId]: msgs },
      cursors: { ...s.cursors, [channelId]: cursor },
      hasMore: { ...s.hasMore, [channelId]: hasMore },
    })),

  prependMessages: (channelId, msgs, cursor) =>
    set((s) => ({
      messagesByChannel: {
        ...s.messagesByChannel,
        [channelId]: [...msgs, ...(s.messagesByChannel[channelId] ?? [])],
      },
      cursors: { ...s.cursors, [channelId]: cursor },
    })),

  addMessage: (channelId, msg) =>
    set((s) => ({
      messagesByChannel: {
        ...s.messagesByChannel,
        [channelId]: [...(s.messagesByChannel[channelId] ?? []), msg],
      },
    })),

  setTyping: (user) =>
    set((s) => ({
      typingUsers: [
        ...s.typingUsers.filter((u) => u.userId !== user.userId || u.channelId !== user.channelId),
        user,
      ],
    })),

  clearTyping: (userId, channelId) =>
    set((s) => ({
      typingUsers: s.typingUsers.filter(
        (u) => !(u.userId === userId && u.channelId === channelId)
      ),
    })),

  setPresence: (userId, status) =>
    set((s) => ({ presenceMap: { ...s.presenceMap, [userId]: status } })),

  clearChannel: (channelId) =>
    set((s) => {
      const m = { ...s.messagesByChannel };
      delete m[channelId];
      return { messagesByChannel: m };
    }),
}));

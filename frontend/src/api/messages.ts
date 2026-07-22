import api from './client';

export interface Message {
  _id: string;
  channelId: string;
  workspaceId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  createdAt: string;
  editedAt?: string;
  reactions?: Record<string, string[]>;
}

export interface MessagesResponse {
  messages: Message[];
  nextCursor: string | null;
  hasMore: boolean;
}

export const messagesApi = {
  history: (channelId: string, cursor?: string, limit = 30) =>
    api
      .get<MessagesResponse>(`/channels/${channelId}/messages`, {
        params: { cursor, limit },
      })
      .then((r) => r.data),
};

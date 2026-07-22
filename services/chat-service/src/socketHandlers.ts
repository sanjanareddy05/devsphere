import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { getMessages, Message } from './db';

interface TokenPayload {
  userId: string;
  email: string;
  name?: string;
}

interface AuthSocket extends Socket {
  userId: string;
  userEmail: string;
  userName: string;
}

// Track online users: userId -> Set of socketIds
const onlineUsers = new Map<string, Set<string>>();

function addOnlineUser(userId: string, socketId: string) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId)!.add(socketId);
}

function removeOnlineUser(userId: string, socketId: string) {
  const sockets = onlineUsers.get(userId);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) onlineUsers.delete(userId);
  }
}

function isOnline(userId: string): boolean {
  return (onlineUsers.get(userId)?.size ?? 0) > 0;
}

export function registerSocketHandlers(io: Server) {
  // Auth middleware: verify JWT on connection
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) return next(new Error('Authentication token required'));

    try {
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as TokenPayload;
      (socket as AuthSocket).userId = payload.userId;
      (socket as AuthSocket).userEmail = payload.email;
      (socket as AuthSocket).userName = payload.name || payload.email.split('@')[0];
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (rawSocket: Socket) => {
    const socket = rawSocket as AuthSocket;
    const { userId, userName } = socket;

    console.log(`[socket] connected: ${userId} (${socket.id})`);
    addOnlineUser(userId, socket.id);

    // Broadcast presence to all connected clients
    io.emit('presence', { userId, status: 'online' });

    // ── JOIN CHANNEL ──────────────────────────────────────────────
    socket.on('join_channel', async ({ channelId }: { channelId: string }) => {
      if (!channelId) return;
      await socket.join(`channel:${channelId}`);
      socket.emit('joined_channel', { channelId });
    });

    socket.on('leave_channel', ({ channelId }: { channelId: string }) => {
      socket.leave(`channel:${channelId}`);
    });

    // ── SEND MESSAGE ──────────────────────────────────────────────
    socket.on('send_message', async ({
      channelId,
      workspaceId,
      content,
    }: {
      channelId: string;
      workspaceId: string;
      content: string;
    }) => {
      if (!channelId || !content?.trim()) return;

      const message: Message = {
        channelId,
        workspaceId,
        senderId: userId,
        senderName: userName,
        content: content.trim().slice(0, 4000), // max 4KB per message
        createdAt: new Date(),
      };

      try {
        const result = await getMessages().insertOne(message);
        const saved = { ...message, _id: result.insertedId };

        // Broadcast to all clients in the channel (including sender for confirmation)
        io.to(`channel:${channelId}`).emit('message:new', saved);
      } catch (err) {
        console.error('[socket] send_message error:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ── TYPING ───────────────────────────────────────────────────
    socket.on('typing', ({ channelId }: { channelId: string }) => {
      socket.to(`channel:${channelId}`).emit('typing', { userId, userName, channelId });
    });

    // ── STOP TYPING ──────────────────────────────────────────────
    socket.on('stop_typing', ({ channelId }: { channelId: string }) => {
      socket.to(`channel:${channelId}`).emit('stop_typing', { userId, channelId });
    });

    // ── REACTION ─────────────────────────────────────────────────
    socket.on('add_reaction', async ({
      messageId,
      channelId,
      emoji,
    }: {
      messageId: string;
      channelId: string;
      emoji: string;
    }) => {
      try {
        const key = `reactions.${emoji}`;
        await getMessages().updateOne(
          { _id: new ObjectId(messageId) },
          { $addToSet: { [key]: userId } }
        );
        io.to(`channel:${channelId}`).emit('reaction:updated', { messageId, emoji, userId });
      } catch (err) {
        console.error('[socket] add_reaction error:', err);
      }
    });

    // ── DISCONNECT ────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[socket] disconnected: ${userId} (${socket.id})`);
      removeOnlineUser(userId, socket.id);

      if (!isOnline(userId)) {
        io.emit('presence', { userId, status: 'offline' });
      }
    });
  });
}

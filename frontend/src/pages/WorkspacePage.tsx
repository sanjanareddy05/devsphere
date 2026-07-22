import { useEffect, useRef } from 'react';
import { Hash, Lock, Users, Wifi, WifiOff } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useChatStore } from '@/store/chatStore';
import { getSocket, disconnectSocket } from '@/socket';
import { Message } from '@/api/messages';
import Sidebar from '@/components/Sidebar';
import MessageList from '@/components/MessageList';
import MessageInput from '@/components/MessageInput';
import { useState } from 'react';

function ConnectionStatus({ connected }: { connected: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${
      connected ? 'text-emerald-400' : 'text-amber-400'
    }`}>
      {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      {connected ? 'Live' : 'Reconnecting…'}
    </div>
  );
}

export default function WorkspacePage() {
  const { accessToken } = useAuthStore();
  const { activeChannel, activeWorkspace } = useWorkspaceStore();
  const { addMessage, setTyping, clearTyping, setPresence } = useChatStore();
  const [socketConnected, setSocketConnected] = useState(false);
  const joinedChannelRef = useRef<string | null>(null);

  // Boot the socket once (stays alive for the session)
  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);

    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('message:new', (msg: Message) => addMessage(msg.channelId, msg));
    socket.on('typing', (data: { userId: string; userName: string; channelId: string }) => {
      setTyping(data);
    });
    socket.on('stop_typing', (data: { userId: string; channelId: string }) => {
      clearTyping(data.userId, data.channelId);
    });
    socket.on('presence', (data: { userId: string; status: 'online' | 'offline' }) => {
      setPresence(data.userId, data.status);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('message:new');
      socket.off('typing');
      socket.off('stop_typing');
      socket.off('presence');
    };
  }, [accessToken]);

  // Join/leave channel rooms
  useEffect(() => {
    if (!activeChannel) return;
    const socket = getSocket(accessToken!);

    if (joinedChannelRef.current && joinedChannelRef.current !== activeChannel.id) {
      socket.emit('leave_channel', { channelId: joinedChannelRef.current });
    }
    socket.emit('join_channel', { channelId: activeChannel.id });
    joinedChannelRef.current = activeChannel.id;
  }, [activeChannel?.id]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-900">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0">
        {activeChannel ? (
          <>
            {/* Channel header */}
            <header className="flex items-center justify-between px-4 py-3 border-b border-surface-600 bg-surface-800 shrink-0">
              <div className="flex items-center gap-2">
                {activeChannel.is_private ? (
                  <Lock className="w-4 h-4 text-slate-400" />
                ) : (
                  <Hash className="w-4 h-4 text-slate-400" />
                )}
                <h2 className="font-semibold text-slate-100">{activeChannel.name}</h2>
                {activeChannel.description && (
                  <>
                    <span className="text-slate-600">·</span>
                    <p className="text-sm text-slate-500 truncate max-w-xs">{activeChannel.description}</p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <ConnectionStatus connected={socketConnected} />
                <button className="btn-ghost p-1.5" title="Members">
                  <Users className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Messages */}
            <MessageList channelId={activeChannel.id} workspaceId={activeWorkspace?.id ?? ''} />

            {/* Input */}
            <MessageInput
              channelId={activeChannel.id}
              workspaceId={activeWorkspace?.id ?? ''}
              channelName={activeChannel.name}
            />
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <div className="text-6xl mb-4">🌐</div>
            <h2 className="text-2xl font-bold text-slate-100 mb-2">
              {activeWorkspace ? 'Select a channel' : 'Welcome to DevSphere'}
            </h2>
            <p className="text-slate-400 max-w-sm">
              {activeWorkspace
                ? 'Choose a channel from the sidebar to start collaborating with your team.'
                : 'Select or create a workspace from the sidebar to get started.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

import { useEffect, useRef } from 'react';
import { Hash, Lock, Users, Wifi, WifiOff, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useChatStore } from '@/store/chatStore';
import { getSocket } from '@/socket';
import { Message } from '@/api/messages';
import { workspaceApi, PendingInvite } from '@/api/workspaces';
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
  const { activeChannel, activeWorkspace, setWorkspaces, setActiveWorkspace } = useWorkspaceStore();
  const { addMessage, setTyping, clearTyping, setPresence } = useChatStore();
  const [socketConnected, setSocketConnected] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [acceptingInviteToken, setAcceptingInviteToken] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
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

  useEffect(() => {
    if (!accessToken) return;
    workspaceApi.pendingInvites()
      .then(setPendingInvites)
      .catch((err) => console.error('Failed to load invites', err));
  }, [accessToken]);

  const handleAcceptInvite = async (token: string) => {
    setAcceptingInviteToken(token);
    setInviteNotice(null);
    try {
      await workspaceApi.acceptInvite(token);
      setPendingInvites((prev) => prev.filter((invite) => invite.token !== token));
      setInviteNotice('Invite accepted. Reloading your workspaces...');
      const refreshed = await workspaceApi.list();
      setWorkspaces(refreshed);
      if (refreshed.length > 0) {
        setActiveWorkspace(refreshed[0]);
      }
    } catch (err) {
      console.error('Failed to accept invite', err);
      setInviteNotice('Unable to accept that invite right now.');
    } finally {
      setAcceptingInviteToken(null);
    }
  };

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

            {pendingInvites.length > 0 && (
              <div className="mt-6 w-full max-w-md rounded-xl border border-brand/20 bg-brand/10 p-4 text-left">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-brand" />
                  You have pending workspace invites
                </div>
                <div className="mt-3 space-y-2">
                  {pendingInvites.map((invite) => (
                    <div key={invite.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface-800/70 px-3 py-2">
                      <div>
                        <p className="text-sm text-slate-200">{invite.workspace_name}</p>
                        <p className="text-xs text-slate-500">{invite.role === 'admin' ? 'Admin access' : 'Member access'}</p>
                      </div>
                      <button
                        onClick={() => void handleAcceptInvite(invite.token)}
                        disabled={acceptingInviteToken === invite.token}
                        className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:opacity-60"
                      >
                        {acceptingInviteToken === invite.token ? 'Accepting...' : 'Accept'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {inviteNotice && (
              <p className="mt-3 text-sm text-emerald-400">{inviteNotice}</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

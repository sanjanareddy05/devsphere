import { useEffect, useState } from 'react';
import { Hash, Lock, Plus, Settings, LogOut, ChevronDown, Users, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useChatStore } from '@/store/chatStore';
import { workspaceApi, Channel } from '@/api/workspaces';
import { authApi } from '@/api/auth';
import { disconnectSocket } from '@/socket';
import { useNavigate } from 'react-router-dom';
import CreateChannelModal from './CreateChannelModal';
import CreateWorkspaceModal from './CreateWorkspaceModal';
import InviteModal from './InviteModal';

export default function Sidebar() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const {
    workspaces, activeWorkspace, channels, activeChannel,
    setActiveChannel, setActiveWorkspace, setWorkspaces, setChannels,
  } = useWorkspaceStore();
  const presenceMap = useChatStore((s) => s.presenceMap);

  const [loadingChannels, setLoadingChannels] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [wsOpen, setWsOpen] = useState(true);

  // Load workspaces on mount
  useEffect(() => {
    workspaceApi.list().then(setWorkspaces).catch(console.error);
  }, [setWorkspaces]);

  // Load channels when active workspace changes
  useEffect(() => {
    if (!activeWorkspace) return;
    setLoadingChannels(true);
    workspaceApi.channels.list(activeWorkspace.id)
      .then((ch) => {
        setChannels(ch);
        if (ch.length > 0 && !activeChannel) setActiveChannel(ch[0]);
      })
      .catch(console.error)
      .finally(() => setLoadingChannels(false));
  }, [activeWorkspace?.id]);

  const handleLogout = async () => {
    await authApi.logout().catch(() => {});
    disconnectSocket();
    logout();
    navigate('/login');
  };

  const onChannelCreated = (ch: Channel) => {
    useWorkspaceStore.getState().addChannel(ch);
    setActiveChannel(ch);
  };

  return (
    <aside className="w-60 bg-surface-800 border-r border-surface-600 flex flex-col h-full shrink-0">
      {/* Workspace Selector */}
      <div className="px-3 py-3 border-b border-surface-600">
        <button
          onClick={() => setWsOpen((o) => !o)}
          className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-surface-700 transition-colors group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-brand/20 border border-brand/30 flex items-center justify-center shrink-0">
              <span className="text-brand text-xs font-bold font-mono">
                {activeWorkspace?.name?.[0]?.toUpperCase() ?? 'D'}
              </span>
            </div>
            <span className="text-sm font-semibold text-slate-100 truncate">
              {activeWorkspace?.name ?? 'DevSphere'}
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${wsOpen ? 'rotate-0' : '-rotate-90'}`} />
        </button>

        {/* Workspace list dropdown */}
        {wsOpen && (
          <div className="mt-1 space-y-0.5 animate-slide-up">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => setActiveWorkspace(ws)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                  activeWorkspace?.id === ws.id
                    ? 'bg-brand/10 text-brand'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-surface-700'
                }`}
              >
                <div className="w-5 h-5 rounded bg-surface-600 flex items-center justify-center text-xs font-mono shrink-0">
                  {ws.name[0].toUpperCase()}
                </div>
                <span className="truncate">{ws.name}</span>
              </button>
            ))}
            <button
              onClick={() => setShowCreateWorkspace(true)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-slate-500 hover:text-slate-300 hover:bg-surface-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New workspace
            </button>
          </div>
        )}
      </div>

      {/* Channels */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        <div className="flex items-center justify-between px-2 mb-1">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Channels</span>
          {activeWorkspace?.role === 'admin' && (
            <button
              onClick={() => setShowCreateChannel(true)}
              className="text-slate-500 hover:text-slate-300 transition-colors"
              title="Add channel"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {loadingChannels ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
          </div>
        ) : (
          channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setActiveChannel(ch)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                activeChannel?.id === ch.id
                  ? 'bg-brand/10 text-brand'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-surface-700'
              }`}
            >
              {ch.is_private ? <Lock className="w-3.5 h-3.5 shrink-0" /> : <Hash className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">{ch.name}</span>
            </button>
          ))
        )}

        {channels.length === 0 && !loadingChannels && activeWorkspace && (
          <p className="text-xs text-slate-600 px-2 py-2">No channels yet</p>
        )}

        {!activeWorkspace && (
          <p className="text-xs text-slate-600 px-2 py-2">Select a workspace</p>
        )}
      </div>

      {/* Footer actions */}
      {activeWorkspace?.role === 'admin' && (
        <div className="px-2 py-2 border-t border-surface-600 space-y-0.5">
          <button
            onClick={() => setShowInvite(true)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-surface-700 transition-colors"
          >
            <Users className="w-4 h-4" />
            Invite members
          </button>
        </div>
      )}

      {/* User footer */}
      <div className="px-3 py-3 border-t border-surface-600 flex items-center gap-2">
        <div className="relative shrink-0">
          <div className="w-8 h-8 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center">
            <span className="text-brand text-xs font-semibold">
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface-800 ${
            presenceMap[user?.id ?? ''] === 'offline' ? 'bg-slate-500' : 'bg-emerald-400'
          }`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-100 truncate">{user?.name}</p>
          <p className="text-xs text-slate-500 truncate">{user?.email}</p>
        </div>
        <div className="flex items-center gap-1">
          <button className="btn-ghost p-1.5" title="Settings">
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleLogout} className="btn-ghost p-1.5" title="Sign out">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Modals */}
      {showCreateChannel && activeWorkspace && (
        <CreateChannelModal
          workspaceId={activeWorkspace.id}
          onClose={() => setShowCreateChannel(false)}
          onCreated={onChannelCreated}
        />
      )}
      {showCreateWorkspace && (
        <CreateWorkspaceModal
          onClose={() => setShowCreateWorkspace(false)}
        />
      )}
      {showInvite && activeWorkspace && (
        <InviteModal
          workspaceId={activeWorkspace.id}
          onClose={() => setShowInvite(false)}
        />
      )}
    </aside>
  );
}

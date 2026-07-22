import { create } from 'zustand';
import { Workspace, Channel } from '@/api/workspaces';

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  channels: Channel[];
  activeChannel: Channel | null;

  setWorkspaces: (ws: Workspace[]) => void;
  addWorkspace: (ws: Workspace) => void;
  setActiveWorkspace: (ws: Workspace | null) => void;
  setChannels: (ch: Channel[]) => void;
  addChannel: (ch: Channel) => void;
  setActiveChannel: (ch: Channel | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  activeWorkspace: null,
  channels: [],
  activeChannel: null,

  setWorkspaces: (workspaces) => set({ workspaces }),
  addWorkspace: (ws) => set((s) => ({ workspaces: [...s.workspaces, ws] })),
  setActiveWorkspace: (ws) => set({ activeWorkspace: ws, channels: [], activeChannel: null }),
  setChannels: (channels) => set({ channels }),
  addChannel: (ch) => set((s) => ({ channels: [...s.channels, ch] })),
  setActiveChannel: (ch) => set({ activeChannel: ch }),
}));

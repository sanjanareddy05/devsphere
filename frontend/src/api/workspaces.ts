import api from './client';

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  role: 'admin' | 'member';
  member_count?: number;
  created_at: string;
}

export interface Channel {
  id: string;
  workspace_id?: string;
  name: string;
  description?: string;
  is_private: boolean;
  created_at: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: 'admin' | 'member';
  joined_at: string;
}

export interface PendingInvite {
  id: string;
  token: string;
  workspace_id: string;
  workspace_name: string;
  role: 'admin' | 'member';
  expires_at: string;
  created_at: string;
}

export const workspaceApi = {
  buildInviteUrl: (token: string) => `${window.location.origin}/accept-invite?token=${token}`,

  list: () =>
    api.get<{ workspaces: Workspace[] }>('/api/workspaces').then((r) => r.data.workspaces),

  pendingInvites: () =>
    api.get<{ invites: PendingInvite[] }>('/api/workspaces/invites').then((r) => r.data.invites),

  create: (name: string) =>
    api
      .post<{ workspace: Workspace; channels: Channel[] }>('/api/workspaces', { name })
      .then((r) => r.data),

  get: (id: string) =>
    api.get<{ workspace: Workspace }>(`/api/workspaces/${id}`).then((r) => r.data.workspace),

  invite: (workspaceId: string, email: string, role: 'admin' | 'member' = 'member') =>
    api.post(`/api/workspaces/${workspaceId}/invite`, { email, role }).then((r) => r.data),

  acceptInvite: (token: string) =>
    api.post('/api/workspaces/accept-invite', { token }).then((r) => r.data),

  members: (workspaceId: string) =>
    api
      .get<{ members: Member[] }>(`/api/workspaces/${workspaceId}/members`)
      .then((r) => r.data.members),

  channels: {
    list: (workspaceId: string) =>
      api
        .get<{ channels: Channel[] }>(`/api/workspaces/${workspaceId}/channels`)
        .then((r) => r.data.channels),

    create: (workspaceId: string, data: { name: string; description?: string; is_private?: boolean }) =>
      api
        .post<{ channel: Channel }>(`/api/workspaces/${workspaceId}/channels`, data)
        .then((r) => r.data.channel),
  },
};

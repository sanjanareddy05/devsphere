import axios from 'axios';
import api from './client';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post<AuthResponse>('/auth/register', data).then((r) => r.data),

  login: (data: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', data).then((r) => r.data),

  logout: () => api.post('/auth/logout').then((r) => r.data),

  me: () => api.get<{ user: User }>('/auth/me').then((r) => r.data.user),

  refresh: () =>
    axios
      .post<{ accessToken: string }>('/auth/refresh', {}, { withCredentials: true })
      .then((r) => r.data.accessToken),
};

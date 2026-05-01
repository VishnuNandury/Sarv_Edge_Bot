import axios from 'axios';
import type { AgentConfig, Customer, Campaign, DashboardStats, AnalyticsOverview } from './types';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('converse_token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error?.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ access_token: string; token_type: string; user: { id: string; username: string; email: string } }>(
      '/api/auth/login', { username, password }
    ),
  signup: (data: { username: string; email: string; phone?: string; password: string; confirm_password: string }) =>
    api.post<{ access_token: string; token_type: string; user: { id: string; username: string; email: string } }>(
      '/api/auth/signup', data
    ),
  me: () => api.get<{ id: string; username: string; email: string; phone?: string }>('/api/auth/me'),
};

export const dashboardApi = {
  getStats: () => api.get<DashboardStats>('/api/dashboard/stats'),
};

export const customersApi = {
  list: (params?: { search?: string; segment?: string; status?: string; dpd_min?: number; dpd_max?: number; page?: number; limit?: number }) =>
    api.get<{ items: Customer[]; total: number; page: number; pages: number }>('/api/customers', { params }),
  get: (id: string) => api.get<Customer>(`/api/customers/${id}`),
  create: (data: Partial<Customer>) => api.post<Customer>('/api/customers', data),
  update: (id: string, data: Partial<Customer>) => api.put<Customer>(`/api/customers/${id}`, data),
  delete: (id: string) => api.delete(`/api/customers/${id}`),
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<{ imported: number; errors: number; message: string }>('/api/customers/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getSessions: (id: string) => api.get(`/api/customers/${id}/sessions`),
};

export const conversationsApi = {
  list: (params?: { search?: string; status?: string; agent_type?: string; date_from?: string; date_to?: string; page?: number; limit?: number }) =>
    api.get('/api/conversations', { params }),
  get: (id: string) => api.get(`/api/conversations/${id}`),
  getTranscript: (id: string) => api.get(`/api/conversations/${id}/transcript`),
  getMetrics: (id: string) => api.get(`/api/conversations/${id}/metrics`),
  delete: (id: string) => api.delete(`/api/conversations/${id}`),
};

export const campaignsApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<{ items: Campaign[]; total: number }>('/api/campaigns', { params }),
  get: (id: string) => api.get<Campaign>(`/api/campaigns/${id}`),
  create: (data: Partial<Campaign>) => api.post<Campaign>('/api/campaigns', data),
  update: (id: string, data: Partial<Campaign>) => api.put<Campaign>(`/api/campaigns/${id}`, data),
  start: (id: string) => api.post(`/api/campaigns/${id}/start`),
  pause: (id: string) => api.post(`/api/campaigns/${id}/pause`),
  complete: (id: string) => api.post(`/api/campaigns/${id}/complete`),
  getCustomers: (id: string) => api.get(`/api/campaigns/${id}/customers`),
  getSessions: (id: string) => api.get(`/api/campaigns/${id}/sessions`),
};

export const analyticsApi = {
  getOverview: (params?: { period?: string; date_from?: string; date_to?: string }) =>
    api.get<AnalyticsOverview>('/api/analytics/overview', { params }),
  getCalls: (params?: { period?: string }) => api.get('/api/analytics/calls', { params }),
  getOutcomes: (params?: { period?: string }) => api.get('/api/analytics/outcomes', { params }),
  getAgents: (params?: { period?: string }) => api.get('/api/analytics/agents', { params }),
  getFlows: (params?: { period?: string }) => api.get('/api/analytics/flows', { params }),
  getLatency: (params?: { period?: string }) => api.get('/api/analytics/latency', { params }),
};

export const voiceApi = {
  createSession: (config: AgentConfig) =>
    api.post<{ session_id: string; flow: { nodes: unknown[]; edges: unknown[] } }>('/api/voice/sessions', config),
  sendOffer: (sessionId: string, sdp: string) =>
    api.post<{ sdp: string; type: string }>(`/api/voice/sessions/${sessionId}/offer`, { sdp, type: 'offer' }),
  sendIceCandidate: (sessionId: string, candidate: RTCIceCandidateInit) =>
    api.post(`/api/voice/sessions/${sessionId}/ice`, candidate),
  endSession: (sessionId: string) => api.post(`/api/voice/sessions/${sessionId}/end`),
  getIceServers: () =>
    api.get<{ iceServers: RTCIceServer[] }>('/api/voice/ice-servers'),
  getFlows: () =>
    api.get<{ flows: Array<{ id: string; name: string; description: string; tier: string; nodes: unknown[]; edges: unknown[] }> }>('/api/flows'),
  registerFlow: (flow: { id: string; name: string; description: string; nodes: unknown[]; edges: unknown[] }) =>
    api.post<{ id: string; name: string }>('/api/flows', flow),
  deleteFlow: (flowId: string) =>
    api.delete(`/api/flows/${flowId}`),
};

export default api;

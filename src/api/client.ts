import {
  QRCodeItem,
  CampaignItem,
  VisitorLeadItem,
  AppSettings,
  AnalyticsData,
  UserSession,
  StorageHealth,
} from '../types';

let authToken: string | null = localStorage.getItem('aevy_token');

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('aevy_token', token);
  } else {
    localStorage.removeItem('aevy_token');
  }
}

export function getAuthToken(): string | null {
  return authToken || localStorage.getItem('aevy_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401) {
    // Only redirect if not already on login or lead-capture
    if (!window.location.pathname.startsWith('/lead-capture')) {
      setAuthToken(null);
    }
  }

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson.error) errorMsg = errJson.error;
    } catch {
      // fallback
    }
    throw new Error(errorMsg);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Auth
  async login(username: string, password: string): Promise<{ success: boolean; token: string; user: UserSession }> {
    const data = await request<{ success: boolean; token: string; user: UserSession }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setAuthToken(data.token);
    return data;
  },

  async logout(): Promise<void> {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      setAuthToken(null);
    }
  },

  async getMe(): Promise<{ user: UserSession }> {
    return request<{ user: UserSession }>('/api/auth/me');
  },

  async updatePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return request('/api/auth/update-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  // QR Codes
  async getQRCodes(params: { campaign?: string; status?: string; search?: string } = {}): Promise<{ qrCodes: QRCodeItem[]; total: number }> {
    const q = new URLSearchParams();
    if (params.campaign) q.set('campaign', params.campaign);
    if (params.status) q.set('status', params.status);
    if (params.search) q.set('search', params.search);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request(`/api/qrcodes${qs}`);
  },

  async getQRCode(id: string): Promise<{ qrCode: QRCodeItem; trackingUrl: string }> {
    return request(`/api/qrcodes/${id}`);
  },

  async createQRCode(data: Partial<QRCodeItem>): Promise<{ qrCode: QRCodeItem; trackingUrl: string }> {
    return request('/api/qrcodes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateQRCode(id: string, data: Partial<QRCodeItem>): Promise<{ qrCode: QRCodeItem }> {
    return request(`/api/qrcodes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async toggleStatus(id: string, status: 'active' | 'paused' | 'archived'): Promise<{ qrCode: QRCodeItem }> {
    return request(`/api/qrcodes/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async duplicateQRCode(id: string): Promise<{ qrCode: QRCodeItem }> {
    return request(`/api/qrcodes/${id}/duplicate`, {
      method: 'POST',
    });
  },

  async deleteQRCode(id: string, permanent: boolean = false): Promise<{ success: boolean; message: string }> {
    return request(`/api/qrcodes/${id}?permanent=${permanent ? 'true' : 'false'}`, {
      method: 'DELETE',
    });
  },

  async renderQrDataUrl(id: string): Promise<{ dataUrl: string; trackingUrl: string }> {
    return request(`/api/qrcodes/${id}/render`);
  },

  getDownloadUrl(id: string, format: 'png' | 'svg' = 'png'): string {
    return `/api/qrcodes/${id}/download?format=${format}`;
  },

  // Analytics
  async getAnalytics(params: Record<string, string> = {}): Promise<AnalyticsData> {
    const q = new URLSearchParams(params);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request(`/api/analytics${qs}`);
  },

  async getQrAnalytics(qrId: string, params: Record<string, string> = {}): Promise<any> {
    const q = new URLSearchParams(params);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request(`/api/analytics/qr/${qrId}${qs}`);
  },

  // Campaigns
  async getCampaigns(): Promise<{ campaigns: CampaignItem[] }> {
    return request('/api/campaigns');
  },

  async getCampaign(id: string): Promise<{ campaign: CampaignItem; qr_codes: QRCodeItem[]; total_scans: number; estimated_unique_visitors: number }> {
    return request(`/api/campaigns/${id}`);
  },

  async createCampaign(data: { name: string; description?: string; status?: string }): Promise<{ campaign: CampaignItem }> {
    return request('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateCampaign(id: string, data: Partial<CampaignItem>): Promise<{ campaign: CampaignItem }> {
    return request(`/api/campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteCampaign(id: string): Promise<{ success: boolean; message: string }> {
    return request(`/api/campaigns/${id}`, {
      method: 'DELETE',
    });
  },

  // Visitors (Leads)
  async getVisitors(params: { qr_id?: string; campaign_id?: string; search?: string } = {}): Promise<{ visitors: VisitorLeadItem[]; total: number }> {
    const q = new URLSearchParams();
    if (params.qr_id) q.set('qr_id', params.qr_id);
    if (params.campaign_id) q.set('campaign_id', params.campaign_id);
    if (params.search) q.set('search', params.search);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request(`/api/visitors${qs}`);
  },

  async deleteVisitor(id: string): Promise<{ success: boolean; message: string }> {
    return request(`/api/visitors/${id}`, {
      method: 'DELETE',
    });
  },

  async submitLead(data: {
    qr_id: string;
    campaign_id?: string;
    scan_id?: string;
    name: string;
    email: string;
    phone: string;
    notes?: string;
    consent: boolean;
  }): Promise<{ success: boolean; lead: VisitorLeadItem }> {
    return request('/api/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Settings
  async getSettings(): Promise<AppSettings> {
    return request('/api/settings');
  },

  async updateSettings(data: Partial<AppSettings>): Promise<{ settings: AppSettings }> {
    return request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async rotateSalt(): Promise<{ success: boolean; message: string; settings: AppSettings }> {
    return request('/api/settings/rotate-salt', {
      method: 'POST',
    });
  },

  async getStorageHealth(): Promise<StorageHealth> {
    return request<StorageHealth>('/api/settings/storage-health');
  },

  async verifyStorage(): Promise<{ success: boolean; message: string; result: any; storageHealth: StorageHealth }> {
    return request('/api/settings/verify-storage', {
      method: 'POST',
    });
  },

  // Data Management & Backups
  getExportUrl(type: 'all' | 'qr' | 'scans' | 'visitors', format: 'json' | 'csv'): string {
    const token = getAuthToken();
    return `/api/data/export/${format}?type=${type}${token ? `&auth=${encodeURIComponent(token)}` : ''}`;
  },

  async previewBackup(backupData: any): Promise<{ valid: boolean; preview: any }> {
    return request('/api/data/backup/preview', {
      method: 'POST',
      body: JSON.stringify({ backupData }),
    });
  },

  async restoreBackup(backupData: any): Promise<{ success: boolean; summary: any }> {
    return request('/api/data/backup/restore', {
      method: 'POST',
      body: JSON.stringify({ backupData, confirm: true }),
    });
  },

  async triggerRetentionCleanup(): Promise<{ success: boolean; removedScans: number }> {
    return request('/api/data/retention/cleanup', {
      method: 'POST',
    });
  },
};

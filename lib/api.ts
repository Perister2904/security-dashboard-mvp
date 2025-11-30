// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

// Auth Token Management
let authToken: string | null = null;

export function setAuthToken(token: string) {
  authToken = token;
  if (typeof window !== 'undefined') {
    localStorage.setItem('auth_token', token);
  }
}

export function getAuthToken(): string | null {
  if (authToken) return authToken;
  if (typeof window !== 'undefined') {
    authToken = localStorage.getItem('auth_token');
  }
  return authToken;
}

export function clearAuthToken() {
  authToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
  }
}

// API Request Helper
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.message || error.error || 'Request failed');
  }

  return response.json();
}

// Authentication API
export const authAPI = {
  async login(username: string, password: string) {
    const response = await apiRequest<{
      success: boolean;
      user: any;
      tokens: { accessToken: string; refreshToken: string };
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    if (response.tokens?.accessToken) {
      setAuthToken(response.tokens.accessToken);
    }

    return response;
  },

  async register(data: {
    email: string;
    password: string;
    name: string;
    role: string;
    department?: string;
  }) {
    return apiRequest<{ success: boolean; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getCurrentUser() {
    return apiRequest<{ success: boolean; user: any }>('/auth/me', {
      method: 'GET',
    });
  },

  async logout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      clearAuthToken();
    }
  },

  async refreshToken(refreshToken: string) {
    return apiRequest<{ success: boolean; tokens: any }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },
};

// SOC API
export const socAPI = {
  async getMetrics() {
    return apiRequest<any>('/soc/metrics', {
      method: 'GET',
    });
  },

  async getIncidents(params?: { severity?: string; status?: string; limit?: number }) {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return apiRequest<any>(`/soc/incidents${queryString}`, {
      method: 'GET',
    });
  },

  async getIncidentById(id: string) {
    return apiRequest<any>(`/soc/incidents/${id}`, {
      method: 'GET',
    });
  },

  async updateIncident(id: string, data: any) {
    return apiRequest<any>(`/soc/incidents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getActivityFeed(params?: { hours?: number; limit?: number }) {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return apiRequest<any>(`/soc/activity${queryString}`, {
      method: 'GET',
    });
  },
};

// Assets API
export const assetsAPI = {
  async getAssets(params?: { department?: string; criticality?: string; limit?: number }) {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return apiRequest<any>(`/assets${queryString}`, {
      method: 'GET',
    });
  },

  async getAssetById(id: string) {
    return apiRequest<any>(`/assets/${id}`, {
      method: 'GET',
    });
  },

  async getCoverage() {
    return apiRequest<any>('/assets/coverage', {
      method: 'GET',
    });
  },

  async getComplianceStatus() {
    return apiRequest<any>('/assets/compliance', {
      method: 'GET',
    });
  },
};

// Risks API
export const risksAPI = {
  async getRisks(params?: { status?: string; priority?: string; limit?: number }) {
    const queryString = params
      ? '?' + new URLSearchParams(params as any).toString()
      : '';
    return apiRequest<any>(`/risks${queryString}`, {
      method: 'GET',
    });
  },

  async getRiskById(id: string) {
    return apiRequest<any>(`/risks/${id}`, {
      method: 'GET',
    });
  },

  async createRisk(data: any) {
    return apiRequest<any>('/risks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateRisk(id: string, data: any) {
    return apiRequest<any>(`/risks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// CEO Dashboard API
export const ceoAPI = {
  async getOverview() {
    return apiRequest<any>('/ceo/overview', {
      method: 'GET',
    });
  },

  async getExecutiveSummary() {
    return apiRequest<any>('/ceo/executive-summary', {
      method: 'GET',
    });
  },

  async getTrends(days: number = 30) {
    return apiRequest<any>(`/ceo/trends?days=${days}`, {
      method: 'GET',
    });
  },
};

// Health Check
export async function healthCheck() {
  try {
    const response = await fetch(`${API_BASE_URL.replace('/api/v1', '')}/health`);
    return response.json();
  } catch (error) {
    console.error('Health check failed:', error);
    return { status: 'unhealthy', error: String(error) };
  }
}

export default {
  auth: authAPI,
  soc: socAPI,
  assets: assetsAPI,
  risks: risksAPI,
  ceo: ceoAPI,
  healthCheck,
};

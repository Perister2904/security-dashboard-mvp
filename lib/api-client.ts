/**
 * API Client for Security Dashboard Backend
 * Handles authentication, requests, and WebSocket connections
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000/ws';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

class APIClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private ws: WebSocket | null = null;
  private wsListeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor() {
    // Load tokens from localStorage on client side
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('accessToken');
      this.refreshToken = localStorage.getItem('refreshToken');
    }
  }

  /**
   * Login with username and password
   */
  async login(username: string, password: string): Promise<{ user: any; tokens: AuthTokens }> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const data = await response.json();
    this.setTokens(data.data.accessToken, data.data.refreshToken);
    return data.data;
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.clearTokens();
      this.disconnectWebSocket();
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<any> {
    const response = await this.request('/auth/me');
    return response.data;
  }

  /**
   * Refresh access token
   */
  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken })
      });

      if (!response.ok) return false;

      const data = await response.json();
      this.setTokens(data.data.accessToken, data.data.refreshToken);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generic request method
   */
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    let response = await fetch(url, { ...options, headers });

    // If unauthorized, try to refresh token
    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        response = await fetch(url, { ...options, headers });
      } else {
        this.clearTokens();
        throw new Error('Session expired. Please login again.');
      }
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  }

  // ==================== SOC APIs ====================

  async getSocMetrics(): Promise<any> {
    const response = await this.request('/soc/metrics');
    return response.data;
  }

  async getSocMetricsHistory(days: number = 7): Promise<any[]> {
    const response = await this.request(`/soc/metrics/history?days=${days}`);
    return response.data;
  }

  async getIncidents(filters?: {
    status?: string;
    severity?: string;
    analyst?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const params = new URLSearchParams(filters as any).toString();
    const response = await this.request(`/soc/incidents?${params}`);
    return response.data;
  }

  async getIncidentById(id: string): Promise<any> {
    const response = await this.request(`/soc/incidents/${id}`);
    return response.data;
  }

  async updateIncident(id: string, updates: any): Promise<any> {
    const response = await this.request(`/soc/incidents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
    return response.data;
  }

  async getRecentEvents(limit: number = 50): Promise<any[]> {
    const response = await this.request(`/soc/events?limit=${limit}`);
    return response.data;
  }

  async getAnalystPerformance(): Promise<any[]> {
    const response = await this.request('/soc/analysts/performance');
    return response.data;
  }

  async getTasks(incidentId?: string): Promise<any[]> {
    const endpoint = incidentId ? `/soc/tasks?incidentId=${incidentId}` : '/soc/tasks';
    const response = await this.request(endpoint);
    return response.data;
  }

  // ==================== Asset APIs ====================

  async getAssets(filters?: {
    department?: string;
    criticality?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const params = new URLSearchParams(filters as any).toString();
    const response = await this.request(`/assets?${params}`);
    return response.data;
  }

  async getAssetById(id: string): Promise<any> {
    const response = await this.request(`/assets/${id}`);
    return response.data;
  }

  async getAssetCoverage(): Promise<any> {
    const response = await this.request('/assets/stats/coverage');
    return response.data;
  }

  async getRiskPosture(): Promise<any> {
    const response = await this.request('/assets/stats/risk-posture');
    return response.data;
  }

  async getCoverageGaps(): Promise<any[]> {
    const response = await this.request('/assets/stats/gaps');
    return response.data;
  }

  // ==================== Risk APIs ====================

  async getRisks(filters?: { status?: string; priority?: string }): Promise<any[]> {
    const params = new URLSearchParams(filters as any).toString();
    const response = await this.request(`/risks?${params}`);
    return response.data;
  }

  async getRiskById(id: string): Promise<any> {
    const response = await this.request(`/risks/${id}`);
    return response.data;
  }

  async createRisk(riskData: any): Promise<any> {
    const response = await this.request('/risks', {
      method: 'POST',
      body: JSON.stringify(riskData)
    });
    return response.data;
  }

  async updateRisk(id: string, updates: any): Promise<any> {
    const response = await this.request(`/risks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
    return response.data;
  }

  async deleteRisk(id: string): Promise<void> {
    await this.request(`/risks/${id}`, { method: 'DELETE' });
  }

  // ==================== CEO APIs ====================

  async getCeoSummary(): Promise<any> {
    const response = await this.request('/ceo/summary');
    return response.data;
  }

  async getFinancialImpact(days: number = 30): Promise<any> {
    const response = await this.request(`/ceo/financial-impact?days=${days}`);
    return response.data;
  }

  async getTopRisks(limit: number = 10): Promise<any[]> {
    const response = await this.request(`/ceo/top-risks?limit=${limit}`);
    return response.data;
  }

  async getCompliancePosture(): Promise<any> {
    const response = await this.request('/ceo/compliance');
    return response.data;
  }

  async requestExecutiveReport(email: string, reportType: string): Promise<void> {
    await this.request('/ceo/email-report', {
      method: 'POST',
      body: JSON.stringify({ email, reportType })
    });
  }

  // ==================== WebSocket ====================

  /**
   * Connect to WebSocket server
   */
  connectWebSocket(): void {
    if (this.ws || !this.accessToken) return;

    const wsUrl = `${WS_BASE_URL}?token=${this.accessToken}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.notifyListeners(message.type, message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.ws = null;
      
      // Attempt reconnection after 5 seconds
      setTimeout(() => {
        if (this.accessToken) {
          this.connectWebSocket();
        }
      }, 5000);
    };
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Subscribe to WebSocket events
   */
  on(event: string, callback: (data: any) => void): void {
    if (!this.wsListeners.has(event)) {
      this.wsListeners.set(event, new Set());
    }
    this.wsListeners.get(event)!.add(callback);
  }

  /**
   * Unsubscribe from WebSocket events
   */
  off(event: string, callback: (data: any) => void): void {
    const listeners = this.wsListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Notify all listeners for an event
   */
  private notifyListeners(event: string, data: any): void {
    const listeners = this.wsListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  /**
   * Send WebSocket message
   */
  sendWebSocketMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  // ==================== Token Management ====================

  private setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
    }
  }

  private clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }
}

// Export singleton instance
export const apiClient = new APIClient();
export default apiClient;

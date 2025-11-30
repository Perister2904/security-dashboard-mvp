import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import logger from '../utils/logger';

export interface ConnectorConfig {
  id: string;
  name: string;
  type: 'siem' | 'edr' | 'cmdb' | 'ticketing' | 'vulnerability_scanner';
  baseUrl: string;
  apiKey?: string;
  username?: string;
  password?: string;
  enabled: boolean;
  syncInterval: number; // minutes
  lastSync?: Date;
  config?: Record<string, any>;
}

export interface SyncResult {
  success: boolean;
  itemsProcessed: number;
  itemsCreated: number;
  itemsUpdated: number;
  errors: string[];
  duration: number; // milliseconds
}

export abstract class BaseConnector {
  protected client: AxiosInstance;
  protected config: ConnectorConfig;

  constructor(config: ConnectorConfig) {
    this.config = config;
    
    const axiosConfig: AxiosRequestConfig = {
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SecurityDashboard/1.0'
      }
    };

    // Add authentication headers
    if (config.apiKey) {
      axiosConfig.headers!['Authorization'] = `Bearer ${config.apiKey}`;
    } else if (config.username && config.password) {
      axiosConfig.auth = {
        username: config.username,
        password: config.password
      };
    }

    this.client = axios.create(axiosConfig);

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config: any) => {
        logger.debug(`${this.config.name} API Request`, {
          method: config.method,
          url: config.url,
          params: config.params
        });
        return config;
      },
      (error: any) => {
        logger.error(`${this.config.name} API Request Error`, { error: error.message });
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response: any) => {
        logger.debug(`${this.config.name} API Response`, {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error: any) => {
        logger.error(`${this.config.name} API Response Error`, {
          status: error.response?.status,
          url: error.config?.url,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Test connection to the external system
   */
  abstract testConnection(): Promise<boolean>;

  /**
   * Sync incidents/alerts from the external system
   */
  abstract syncIncidents(since?: Date): Promise<SyncResult>;

  /**
   * Sync assets from the external system
   */
  abstract syncAssets(): Promise<SyncResult>;

  /**
   * Get connector health status
   */
  async getHealth(): Promise<{ healthy: boolean; message: string; lastSync?: Date }> {
    try {
      const isHealthy = await this.testConnection();
      return {
        healthy: isHealthy,
        message: isHealthy ? 'Connector is healthy' : 'Connection test failed',
        lastSync: this.config.lastSync
      };
    } catch (error: any) {
      logger.error(`${this.config.name} health check failed`, { error: error.message });
      return {
        healthy: false,
        message: error.message || 'Unknown error',
        lastSync: this.config.lastSync
      };
    }
  }

  /**
   * Normalize severity from external system to standard format
   */
  protected normalizeSeverity(externalSeverity: string): 'critical' | 'high' | 'medium' | 'low' {
    const severity = externalSeverity.toLowerCase();
    
    if (['critical', 'urgent', 'sev1', 'p1'].includes(severity)) return 'critical';
    if (['high', 'important', 'sev2', 'p2'].includes(severity)) return 'high';
    if (['medium', 'moderate', 'sev3', 'p3'].includes(severity)) return 'medium';
    return 'low';
  }

  /**
   * Normalize status from external system to standard format
   */
  protected normalizeStatus(externalStatus: string): 'new' | 'in-progress' | 'resolved' | 'closed' {
    const status = externalStatus.toLowerCase();
    
    if (['new', 'open', 'created', 'detected'].includes(status)) return 'new';
    if (['in-progress', 'in progress', 'investigating', 'assigned', 'working'].includes(status)) return 'in-progress';
    if (['resolved', 'fixed', 'completed'].includes(status)) return 'resolved';
    if (['closed', 'archived'].includes(status)) return 'closed';
    
    return 'new';
  }

  /**
   * Helper to handle paginated API responses
   */
  protected async *paginateResults<T>(
    fetchPage: (page: number, pageSize: number) => Promise<{ items: T[]; hasMore: boolean }>,
    pageSize: number = 100
  ): AsyncGenerator<T[], void, unknown> {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await fetchPage(page, pageSize);
      yield result.items;
      hasMore = result.hasMore;
      page++;
    }
  }
}

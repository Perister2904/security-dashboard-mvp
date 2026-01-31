"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseConnector = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("../utils/logger"));
class BaseConnector {
    client;
    config;
    constructor(config) {
        this.config = config;
        const axiosConfig = {
            baseURL: config.baseUrl,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'SecurityDashboard/1.0'
            }
        };
        // Add authentication headers
        if (config.apiKey) {
            axiosConfig.headers['Authorization'] = `Bearer ${config.apiKey}`;
        }
        else if (config.username && config.password) {
            axiosConfig.auth = {
                username: config.username,
                password: config.password
            };
        }
        this.client = axios_1.default.create(axiosConfig);
        // Add request/response interceptors for logging
        this.client.interceptors.request.use((config) => {
            logger_1.default.debug(`${this.config.name} API Request`, {
                method: config.method,
                url: config.url,
                params: config.params
            });
            return config;
        }, (error) => {
            logger_1.default.error(`${this.config.name} API Request Error`, { error: error.message });
            return Promise.reject(error);
        });
        this.client.interceptors.response.use((response) => {
            logger_1.default.debug(`${this.config.name} API Response`, {
                status: response.status,
                url: response.config.url
            });
            return response;
        }, (error) => {
            logger_1.default.error(`${this.config.name} API Response Error`, {
                status: error.response?.status,
                url: error.config?.url,
                message: error.message
            });
            return Promise.reject(error);
        });
    }
    /**
     * Get connector health status
     */
    async getHealth() {
        try {
            const isHealthy = await this.testConnection();
            return {
                healthy: isHealthy,
                message: isHealthy ? 'Connector is healthy' : 'Connection test failed',
                lastSync: this.config.lastSync
            };
        }
        catch (error) {
            logger_1.default.error(`${this.config.name} health check failed`, { error: error.message });
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
    normalizeSeverity(externalSeverity) {
        const severity = externalSeverity.toLowerCase();
        if (['critical', 'urgent', 'sev1', 'p1'].includes(severity))
            return 'critical';
        if (['high', 'important', 'sev2', 'p2'].includes(severity))
            return 'high';
        if (['medium', 'moderate', 'sev3', 'p3'].includes(severity))
            return 'medium';
        return 'low';
    }
    /**
     * Normalize status from external system to standard format
     */
    normalizeStatus(externalStatus) {
        const status = externalStatus.toLowerCase();
        if (['new', 'open', 'created', 'detected'].includes(status))
            return 'new';
        if (['in-progress', 'in progress', 'investigating', 'assigned', 'working'].includes(status))
            return 'in-progress';
        if (['resolved', 'fixed', 'completed'].includes(status))
            return 'resolved';
        if (['closed', 'archived'].includes(status))
            return 'closed';
        return 'new';
    }
    /**
     * Helper to handle paginated API responses
     */
    async *paginateResults(fetchPage, pageSize = 100) {
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
exports.BaseConnector = BaseConnector;
//# sourceMappingURL=base.connector.js.map
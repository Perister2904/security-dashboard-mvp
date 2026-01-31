"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketManager = void 0;
exports.setupDatabaseTriggers = setupDatabaseTriggers;
const ws_1 = require("ws");
const url_1 = require("url");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../utils/logger"));
class WebSocketManager {
    wss;
    clients = new Map();
    pingInterval = null;
    constructor(server) {
        this.wss = new ws_1.WebSocketServer({
            server,
            path: '/ws',
            verifyClient: this.verifyClient.bind(this)
        });
        this.wss.on('connection', this.handleConnection.bind(this));
        this.startHeartbeat();
        logger_1.default.info('WebSocket server initialized');
    }
    /**
     * Verify client authentication before connection
     */
    verifyClient(info, callback) {
        try {
            const { query } = (0, url_1.parse)(info.req.url || '', true);
            const token = query.token;
            if (!token) {
                return callback(false, 401, 'No token provided');
            }
            const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
            const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
            // Attach user info to request for later use
            info.req.user = decoded;
            callback(true);
        }
        catch (error) {
            logger_1.default.error('WebSocket auth failed', { error: error.message });
            callback(false, 401, 'Invalid token');
        }
    }
    /**
     * Handle new WebSocket connection
     */
    handleConnection(ws, req) {
        const user = req.user;
        ws.userId = user.userId;
        ws.username = user.username;
        ws.role = user.role;
        ws.isAlive = true;
        logger_1.default.info('WebSocket client connected', { userId: user.userId, username: user.username });
        // Subscribe to default channel based on role
        const defaultChannel = this.getDefaultChannel(user.role);
        this.subscribe(ws, defaultChannel);
        // Send welcome message
        this.send(ws, {
            type: 'connected',
            message: 'Connected to Security Dashboard WebSocket',
            userId: user.userId,
            channel: defaultChannel
        });
        // Handle incoming messages
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.handleMessage(ws, message);
            }
            catch (error) {
                logger_1.default.error('Error parsing WebSocket message', { error: error.message });
            }
        });
        // Handle pong response
        ws.on('pong', () => {
            ws.isAlive = true;
        });
        // Handle disconnection
        ws.on('close', () => {
            this.unsubscribeAll(ws);
            logger_1.default.info('WebSocket client disconnected', { userId: user.userId });
        });
        // Handle errors
        ws.on('error', (error) => {
            logger_1.default.error('WebSocket error', { userId: user.userId, error: error.message });
        });
    }
    /**
     * Handle incoming WebSocket messages
     */
    handleMessage(ws, message) {
        switch (message.type) {
            case 'subscribe':
                if (message.channel) {
                    this.subscribe(ws, message.channel);
                    this.send(ws, { type: 'subscribed', channel: message.channel });
                }
                break;
            case 'unsubscribe':
                if (message.channel) {
                    this.unsubscribe(ws, message.channel);
                    this.send(ws, { type: 'unsubscribed', channel: message.channel });
                }
                break;
            case 'ping':
                this.send(ws, { type: 'pong' });
                break;
            default:
                logger_1.default.warn('Unknown WebSocket message type', { type: message.type });
        }
    }
    /**
     * Subscribe client to a channel
     */
    subscribe(ws, channel) {
        if (!this.clients.has(channel)) {
            this.clients.set(channel, new Set());
        }
        this.clients.get(channel).add(ws);
        logger_1.default.debug(`Client subscribed to channel: ${channel}`, { userId: ws.userId });
    }
    /**
     * Unsubscribe client from a channel
     */
    unsubscribe(ws, channel) {
        const channelClients = this.clients.get(channel);
        if (channelClients) {
            channelClients.delete(ws);
            if (channelClients.size === 0) {
                this.clients.delete(channel);
            }
        }
        logger_1.default.debug(`Client unsubscribed from channel: ${channel}`, { userId: ws.userId });
    }
    /**
     * Unsubscribe client from all channels
     */
    unsubscribeAll(ws) {
        for (const [channel, clients] of this.clients.entries()) {
            clients.delete(ws);
            if (clients.size === 0) {
                this.clients.delete(channel);
            }
        }
    }
    /**
     * Send message to a specific client
     */
    send(ws, data) {
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    }
    /**
     * Broadcast message to all clients in a channel
     */
    broadcast(channel, data) {
        const channelClients = this.clients.get(channel);
        if (!channelClients)
            return;
        const message = JSON.stringify(data);
        let sentCount = 0;
        for (const client of channelClients) {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                client.send(message);
                sentCount++;
            }
        }
        logger_1.default.debug(`Broadcast to channel ${channel}`, { clients: sentCount });
    }
    /**
     * Broadcast new incident to SOC channel
     */
    broadcastNewIncident(incident) {
        this.broadcast('soc', {
            type: 'new_incident',
            data: incident,
            timestamp: new Date().toISOString()
        });
    }
    /**
     * Broadcast incident update
     */
    broadcastIncidentUpdate(incident) {
        this.broadcast('soc', {
            type: 'incident_update',
            data: incident,
            timestamp: new Date().toISOString()
        });
    }
    /**
     * Broadcast metrics update
     */
    broadcastMetricsUpdate(metrics) {
        this.broadcast('soc', {
            type: 'metrics_update',
            data: metrics,
            timestamp: new Date().toISOString()
        });
        this.broadcast('ceo', {
            type: 'metrics_update',
            data: metrics,
            timestamp: new Date().toISOString()
        });
    }
    /**
     * Get default channel based on user role
     */
    getDefaultChannel(role) {
        switch (role) {
            case 'ceo':
                return 'ceo';
            case 'ciso':
            case 'soc_analyst':
                return 'soc';
            case 'auditor':
                return 'audit';
            default:
                return 'general';
        }
    }
    /**
     * Start heartbeat to detect dead connections
     */
    startHeartbeat() {
        this.pingInterval = setInterval(() => {
            for (const [channel, clients] of this.clients.entries()) {
                for (const client of clients) {
                    if (client.isAlive === false) {
                        client.terminate();
                        clients.delete(client);
                        continue;
                    }
                    client.isAlive = false;
                    client.ping();
                }
                if (clients.size === 0) {
                    this.clients.delete(channel);
                }
            }
        }, 30000); // 30 seconds
        logger_1.default.info('WebSocket heartbeat started');
    }
    /**
     * Stop heartbeat
     */
    stopHeartbeat() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
    /**
     * Get connection statistics
     */
    getStats() {
        const channels = {};
        let totalConnections = 0;
        for (const [channel, clients] of this.clients.entries()) {
            channels[channel] = clients.size;
            totalConnections += clients.size;
        }
        return { totalConnections, channels };
    }
    /**
     * Close all connections and stop server
     */
    close() {
        this.stopHeartbeat();
        for (const clients of this.clients.values()) {
            for (const client of clients) {
                client.close();
            }
        }
        this.clients.clear();
        this.wss.close();
        logger_1.default.info('WebSocket server closed');
    }
}
exports.WebSocketManager = WebSocketManager;
// Database trigger to notify WebSocket of new incidents
async function setupDatabaseTriggers(wsManager) {
    try {
        // Listen for PostgreSQL NOTIFY events
        const client = await database_1.default.connect();
        await client.query('LISTEN new_incident');
        await client.query('LISTEN incident_update');
        client.on('notification', (msg) => {
            try {
                if (msg.channel === 'new_incident') {
                    const incident = JSON.parse(msg.payload || '{}');
                    wsManager.broadcastNewIncident(incident);
                }
                else if (msg.channel === 'incident_update') {
                    const incident = JSON.parse(msg.payload || '{}');
                    wsManager.broadcastIncidentUpdate(incident);
                }
            }
            catch (error) {
                logger_1.default.error('Error handling database notification', { error: error.message });
            }
        });
        logger_1.default.info('Database triggers setup complete');
    }
    catch (error) {
        logger_1.default.error('Failed to setup database triggers', { error: error.message });
    }
}
exports.default = WebSocketManager;
//# sourceMappingURL=server.js.map
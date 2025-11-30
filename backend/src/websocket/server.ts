import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { parse } from 'url';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import logger from '../utils/logger';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  username?: string;
  role?: string;
  isAlive?: boolean;
}

interface WSMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'pong';
  channel?: string;
  data?: any;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(server: HTTPServer) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
      verifyClient: this.verifyClient.bind(this)
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.startHeartbeat();

    logger.info('WebSocket server initialized');
  }

  /**
   * Verify client authentication before connection
   */
  private verifyClient(info: any, callback: (result: boolean, code?: number, message?: string) => void): void {
    try {
      const { query } = parse(info.req.url || '', true);
      const token = query.token as string;

      if (!token) {
        return callback(false, 401, 'No token provided');
      }

      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
      const decoded = jwt.verify(token, jwtSecret) as any;

      // Attach user info to request for later use
      (info.req as any).user = decoded;
      callback(true);
    } catch (error: any) {
      logger.error('WebSocket auth failed', { error: error.message });
      callback(false, 401, 'Invalid token');
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: AuthenticatedWebSocket, req: any): void {
    const user = (req as any).user;
    ws.userId = user.userId;
    ws.username = user.username;
    ws.role = user.role;
    ws.isAlive = true;

    logger.info('WebSocket client connected', { userId: user.userId, username: user.username });

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
    ws.on('message', (data: Buffer) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error: any) {
        logger.error('Error parsing WebSocket message', { error: error.message });
      }
    });

    // Handle pong response
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Handle disconnection
    ws.on('close', () => {
      this.unsubscribeAll(ws);
      logger.info('WebSocket client disconnected', { userId: user.userId });
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error', { userId: user.userId, error: error.message });
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(ws: AuthenticatedWebSocket, message: WSMessage): void {
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
        logger.warn('Unknown WebSocket message type', { type: message.type });
    }
  }

  /**
   * Subscribe client to a channel
   */
  private subscribe(ws: AuthenticatedWebSocket, channel: string): void {
    if (!this.clients.has(channel)) {
      this.clients.set(channel, new Set());
    }
    this.clients.get(channel)!.add(ws);
    logger.debug(`Client subscribed to channel: ${channel}`, { userId: ws.userId });
  }

  /**
   * Unsubscribe client from a channel
   */
  private unsubscribe(ws: AuthenticatedWebSocket, channel: string): void {
    const channelClients = this.clients.get(channel);
    if (channelClients) {
      channelClients.delete(ws);
      if (channelClients.size === 0) {
        this.clients.delete(channel);
      }
    }
    logger.debug(`Client unsubscribed from channel: ${channel}`, { userId: ws.userId });
  }

  /**
   * Unsubscribe client from all channels
   */
  private unsubscribeAll(ws: AuthenticatedWebSocket): void {
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
  private send(ws: WebSocket, data: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * Broadcast message to all clients in a channel
   */
  public broadcast(channel: string, data: any): void {
    const channelClients = this.clients.get(channel);
    if (!channelClients) return;

    const message = JSON.stringify(data);
    let sentCount = 0;

    for (const client of channelClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        sentCount++;
      }
    }

    logger.debug(`Broadcast to channel ${channel}`, { clients: sentCount });
  }

  /**
   * Broadcast new incident to SOC channel
   */
  public broadcastNewIncident(incident: any): void {
    this.broadcast('soc', {
      type: 'new_incident',
      data: incident,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast incident update
   */
  public broadcastIncidentUpdate(incident: any): void {
    this.broadcast('soc', {
      type: 'incident_update',
      data: incident,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast metrics update
   */
  public broadcastMetricsUpdate(metrics: any): void {
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
  private getDefaultChannel(role: string): string {
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
  private startHeartbeat(): void {
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

    logger.info('WebSocket heartbeat started');
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Get connection statistics
   */
  public getStats(): { totalConnections: number; channels: { [key: string]: number } } {
    const channels: { [key: string]: number } = {};
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
  public close(): void {
    this.stopHeartbeat();
    
    for (const clients of this.clients.values()) {
      for (const client of clients) {
        client.close();
      }
    }

    this.clients.clear();
    this.wss.close();
    
    logger.info('WebSocket server closed');
  }
}

// Database trigger to notify WebSocket of new incidents
export async function setupDatabaseTriggers(wsManager: WebSocketManager): Promise<void> {
  try {
    // Listen for PostgreSQL NOTIFY events
    const client = await pool.connect();

    await client.query('LISTEN new_incident');
    await client.query('LISTEN incident_update');

    client.on('notification', (msg) => {
      try {
        if (msg.channel === 'new_incident') {
          const incident = JSON.parse(msg.payload || '{}');
          wsManager.broadcastNewIncident(incident);
        } else if (msg.channel === 'incident_update') {
          const incident = JSON.parse(msg.payload || '{}');
          wsManager.broadcastIncidentUpdate(incident);
        }
      } catch (error: any) {
        logger.error('Error handling database notification', { error: error.message });
      }
    });

    logger.info('Database triggers setup complete');
  } catch (error: any) {
    logger.error('Failed to setup database triggers', { error: error.message });
  }
}

export default WebSocketManager;

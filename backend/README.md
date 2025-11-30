# Security Dashboard Backend

Enterprise-grade backend for Security Operations Center (SOC) dashboard with LDAP/AD integration, PostgreSQL, Redis, and security tool connectors.

## 🏗️ Architecture

```
┌─────────────────┐
│   Next.js       │
│   Frontend      │
└────────┬────────┘
         │
         │ REST API / WebSocket
         │
┌────────▼────────┐
│   Express.js    │
│   API Gateway   │
│   (Port 5000)   │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    │    ┌────▼─────────┐
    │    │   BullMQ     │
    │    │   Workers    │
    │    └────┬─────────┘
    │         │
┌───▼──────┐  │  ┌────▼───────┐
│PostgreSQL│  │  │   Redis    │
│ Database │  │  │   Cache    │
└──────────┘  │  └────────────┘
              │
        ┌─────▼──────┐
        │   LDAP/AD  │
        │   Auth     │
        └────────────┘
              │
    ┌─────────┴──────────┐
    │                    │
┌───▼────┐  ┌──────▼───────┐
│  SIEM  │  │  EDR/Vuln    │
│ Splunk │  │  Scanners    │
└────────┘  └──────────────┘
```

## 📋 Prerequisites

### Required Software
- **Node.js** 18+ and npm/yarn
- **PostgreSQL** 14+ 
- **Redis** 6+
- **LDAP/Active Directory** access (for AD auth)

### Network Access
- Access to security tools (SIEM, EDR, etc.)
- Port 5000 for API
- Port 5001 for WebSocket
- PostgreSQL port 5432
- Redis port 6379
- LDAP port 389/636

## 🚀 Quick Start

### 1. Install Dependencies

\`\`\`bash
cd backend
npm install
\`\`\`

### 2. Configure Environment

\`\`\`bash
cp .env.example .env
\`\`\`

Edit `.env` with your settings:

\`\`\`env
# Database
DB_HOST=your-postgres-host
DB_NAME=security_dashboard
DB_USER=dashboard_user
DB_PASSWORD=your-secure-password

# LDAP/Active Directory
LDAP_URL=ldap://ad.company.local:389
LDAP_BIND_DN=CN=ServiceAccount,DC=company,DC=local
LDAP_BIND_PASSWORD=your-service-account-password
LDAP_BASE_DN=DC=company,DC=local

# JWT Secrets
JWT_SECRET=$(openssl rand -base64 64)
JWT_REFRESH_SECRET=$(openssl rand -base64 64)

# Security Tools
SIEM_URL=https://splunk.company.local:8089
SIEM_API_KEY=your-siem-api-key
\`\`\`

### 3. Setup Database

```bash
# Create database
createdb -U postgres security_dashboard

# Run migrations
psql -U postgres -d security_dashboard -f src/database/schema.sql
```

### 4. Start Services

#### Option A: Development Mode (Recommended for Testing)

```bash
# Terminal 1: Start API server
npm run dev

# Terminal 2: Start background workers
npm run dev:worker
```

#### Option B: Production Mode

```bash
# Build TypeScript
npm run build

# Start API server (with PM2 for process management)
pm2 start dist/server.js --name "dashboard-api"

# Start background workers
pm2 start dist/workers/index.js --name "dashboard-workers"

# Save PM2 configuration
pm2 save
pm2 startup
```

### 5. Verify Installation

```bash
# Check health endpoint
curl http://localhost:5000/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "database": "up",
    "redis": "up",
    "ldap": "up"
  }
}
```

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/auth/login` | Login with username/password | No |
| POST | `/api/v1/auth/refresh` | Refresh access token | No |
| GET | `/api/v1/auth/me` | Get current user | Yes |
| POST | `/api/v1/auth/logout` | Logout | Yes |

### SOC Performance Dashboard

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/soc/metrics` | Current SOC metrics | Yes |
| GET | `/api/v1/soc/metrics/history?days=7` | Metrics history | Yes |
| GET | `/api/v1/soc/incidents` | List incidents | Yes |
| GET | `/api/v1/soc/incidents/:id` | Get incident details | Yes |
| PATCH | `/api/v1/soc/incidents/:id` | Update incident | Yes |
| GET | `/api/v1/soc/events` | Recent security events | Yes |
| GET | `/api/v1/soc/analysts/performance` | Analyst performance | Yes |
| GET | `/api/v1/soc/tasks` | Task list | Yes |

### Asset & Risk Posture Dashboard

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/assets` | List assets | Yes |
| GET | `/api/v1/assets/:id` | Get asset details | Yes |
| GET | `/api/v1/assets/stats/coverage` | Coverage statistics | Yes |
| GET | `/api/v1/assets/stats/risk-posture` | Risk posture | Yes |
| GET | `/api/v1/assets/stats/gaps` | Coverage gaps | Yes |

### Risk Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/risks` | List risks | Yes |
| GET | `/api/v1/risks/:id` | Get risk details | Yes |
| POST | `/api/v1/risks` | Create risk | Yes (CISO/Admin) |
| PATCH | `/api/v1/risks/:id` | Update risk | Yes (CISO/Admin) |
| DELETE | `/api/v1/risks/:id` | Delete risk | Yes (Admin) |

### CEO Dashboard

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/ceo/summary` | Executive summary | Yes (CEO/CISO) |
| GET | `/api/v1/ceo/financial-impact?days=30` | Financial impact | Yes (CEO/CISO) |
| GET | `/api/v1/ceo/top-risks?limit=10` | Top risks | Yes (CEO/CISO) |
| GET | `/api/v1/ceo/compliance` | Compliance posture | Yes (CEO/CISO/Auditor) |
| POST | `/api/v1/ceo/email-report` | Request email report | Yes (CEO/CISO) |

## 🔌 WebSocket Connection

### Connect

```javascript
const ws = new WebSocket('ws://localhost:5000/ws?token=YOUR_ACCESS_TOKEN');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

### Message Types

- `connected` - Connection established
- `new_incident` - New incident detected
- `incident_update` - Incident status changed
- `metrics_update` - Metrics recalculated

### Subscribe to Channel

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'soc'
}));
```

## 🔧 Configuration

### Connector Configuration

To connect security tools, insert configurations into the `connector_configs` table:

```sql
-- Example: Splunk Connector
INSERT INTO connector_configs (
  name,
  type,
  base_url,
  api_key,
  enabled,
  sync_interval
) VALUES (
  'Splunk SIEM',
  'siem',
  'https://splunk.company.local:8089',
  'your-splunk-api-key',
  true,
  5  -- Sync every 5 minutes
);

-- Example: CrowdStrike Connector
INSERT INTO connector_configs (
  name,
  type,
  base_url,
  api_key,
  enabled,
  sync_interval
) VALUES (
  'CrowdStrike Falcon',
  'edr',
  'https://api.crowdstrike.com',
  'your-crowdstrike-api-key',
  true,
  10  -- Sync every 10 minutes
);

-- Example: ServiceNow Connector
INSERT INTO connector_configs (
  name,
  type,
  base_url,
  username,
  password,
  enabled,
  sync_interval
) VALUES (
  'ServiceNow CMDB',
  'cmdb',
  'https://company.service-now.com',
  'integration_user',
  'your-password',
  true,
  60  -- Sync every hour
);
```

### Background Job Intervals

Edit `.env` to configure sync intervals:

```env
# Cron format: minute hour day month weekday
INCIDENT_SYNC_INTERVAL="*/5 * * * *"      # Every 5 minutes
ASSET_SYNC_INTERVAL="0 * * * *"           # Every hour
METRICS_CALC_INTERVAL="*/5 * * * *"       # Every 5 minutes
CLEANUP_INTERVAL="0 2 * * *"              # Daily at 2 AM
```

## 🔐 Security Best Practices

### 1. Secure Secrets Management

```bash
# Generate strong JWT secrets
openssl rand -base64 64

# Use environment variables, never hardcode
export JWT_SECRET="your-generated-secret"

# For production, use secret management tools
# - HashiCorp Vault
# - AWS Secrets Manager
# - Azure Key Vault
```

### 2. HTTPS Configuration

```javascript
// Use reverse proxy (Nginx) for SSL termination
// Or configure Express with SSL:
import https from 'https';
import fs from 'fs';

const options = {
  key: fs.readFileSync('private-key.pem'),
  cert: fs.readFileSync('certificate.pem')
};

https.createServer(options, app).listen(443);
```

### 3. Rate Limiting

Already configured in auth routes:
- 5 login attempts per 15 minutes per IP
- Configurable via `RATE_LIMIT_*` environment variables

### 4. Input Validation

All endpoints use `express-validator`:
```typescript
import { body, validationResult } from 'express-validator';

router.post('/login',
  body('username').isLength({ min: 3 }),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // ...
  }
);
```

## 📊 Monitoring & Logging

### Winston Logs

Logs are stored in `logs/` directory:
- `combined.log` - All logs
- `error.log` - Errors only

```typescript
import logger from './utils/logger';

logger.info('Operation successful', { userId: 123 });
logger.error('Operation failed', { error: err.message });
```

### Health Monitoring

```bash
# Check health endpoint
curl http://localhost:5000/health

# Monitor with external tools
# - Prometheus + Grafana
# - Datadog
# - New Relic
```

## 🐳 Docker Deployment

### Build Image

```bash
cd backend
docker build -t security-dashboard-backend .
```

### Docker Compose

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: security_dashboard
      POSTGRES_USER: dashboard_user
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./src/database/schema.sql:/docker-entrypoint-initdb.d/schema.sql

  redis:
    image: redis:6-alpine
    command: redis-server --requirepass your_redis_password

  api:
    image: security-dashboard-backend
    depends_on:
      - postgres
      - redis
    environment:
      DB_HOST: postgres
      REDIS_HOST: redis
      NODE_ENV: production
    ports:
      - "5000:5000"
    restart: unless-stopped

  worker:
    image: security-dashboard-backend
    command: npm run start:worker
    depends_on:
      - postgres
      - redis
    environment:
      DB_HOST: postgres
      REDIS_HOST: redis
      NODE_ENV: production
    restart: unless-stopped

volumes:
  postgres_data:
```

### Run with Docker Compose

```bash
docker-compose up -d
```

## 🧪 Testing

### Manual Testing

```bash
# Login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}'

# Get SOC metrics (use token from login)
curl http://localhost:5000/api/v1/soc/metrics \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Load Testing

```bash
# Install Apache Bench
apt-get install apache2-utils

# Test API endpoint
ab -n 1000 -c 10 -H "Authorization: Bearer TOKEN" \
  http://localhost:5000/api/v1/soc/metrics
```

## 🔍 Troubleshooting

### Database Connection Failed

```bash
# Check PostgreSQL is running
systemctl status postgresql

# Test connection
psql -U dashboard_user -d security_dashboard

# Check network connectivity
telnet postgres-host 5432
```

### Redis Connection Failed

```bash
# Check Redis is running
systemctl status redis

# Test connection
redis-cli -h redis-host -p 6379 ping

# Check authentication
redis-cli -h redis-host -a your_password ping
```

### LDAP Connection Failed

```bash
# Test LDAP connectivity
ldapsearch -x -H ldap://ad.company.local \
  -D "CN=ServiceAccount,DC=company,DC=local" \
  -w password \
  -b "DC=company,DC=local" \
  "(sAMAccountName=testuser)"

# Check firewall rules
telnet ad.company.local 389
```

### Connector Sync Failing

```bash
# Check connector logs
tail -f logs/combined.log | grep -i "connector"

# Test connector manually
curl -X GET https://splunk.company.local:8089/services/server/info \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -k

# Check connector status in database
psql -U dashboard_user -d security_dashboard \
  -c "SELECT * FROM connector_configs WHERE enabled = true;"

# View sync logs
psql -U dashboard_user -d security_dashboard \
  -c "SELECT * FROM sync_logs ORDER BY sync_time DESC LIMIT 10;"
```

### High Memory Usage

```bash
# Monitor process
top -p $(pgrep -f "node dist/server.js")

# Check Redis memory
redis-cli INFO memory

# Adjust Redis cache TTL in .env
CACHE_TTL=300  # 5 minutes instead of default
```

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [LDAP.js Documentation](https://ldapjs.org/)

## 🤝 Support

For issues or questions:
1. Check logs in `logs/` directory
2. Review error messages in console
3. Verify all environment variables are set
4. Ensure all services (PostgreSQL, Redis, LDAP) are accessible

## 📄 License

MIT License

\`\`\`bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE security_dashboard;
CREATE USER dashboard_user WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE security_dashboard TO dashboard_user;

# Run schema
psql -U dashboard_user -d security_dashboard -f src/database/schema.sql
\`\`\`

### 4. Start Services

**Development:**
\`\`\`bash
npm run dev
\`\`\`

**Production:**
\`\`\`bash
npm run build
npm start
\`\`\`

**Background Workers:**
\`\`\`bash
npm run worker
\`\`\`

## 📡 API Endpoints

### Authentication (`/api/v1/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/login` | User login (LDAP or local) | No |
| POST | `/refresh` | Refresh access token | No |
| GET | `/me` | Get current user info | Yes |
| POST | `/logout` | Logout user | Yes |

### SOC Operations (`/api/v1/soc`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/metrics` | Current SOC KPIs | SOC, CISO, CEO |
| GET | `/metrics/history` | 7/30-day trends | SOC, CISO, CEO |
| GET | `/incidents` | List incidents | SOC, CISO, CEO |
| GET | `/incidents/:id` | Get incident details | SOC, CISO, CEO |
| PATCH | `/incidents/:id` | Update incident | SOC, CISO |
| GET | `/events` | Real-time events | SOC, CISO |
| GET | `/analysts/performance` | Analyst stats | SOC, CISO |

### Assets (`/api/v1/assets`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | List all assets | All |
| GET | `/:id` | Get asset details | All |
| GET | `/coverage` | Coverage statistics | All |
| GET | `/risks` | Risk posture data | All |
| GET | `/gaps` | Coverage gaps | All |

### Risks (`/api/v1/risks`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/` | List all risks | All |
| GET | `/:id` | Risk details | All |
| POST | `/` | Create risk | CISO, Admin |
| PATCH | `/:id` | Update risk | CISO, Admin |
| DELETE | `/:id` | Delete risk | Admin |

### CEO Dashboard (`/api/v1/ceo`)

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/summary` | Executive summary | CEO, CISO |
| GET | `/financial-impact` | Financial metrics | CEO, CISO |
| POST | `/email-report` | Send PDF report | CEO, CISO |

## 🔐 Authentication Flow

### LDAP/AD Authentication
1. User enters username/password
2. Backend attempts LDAP bind with service account
3. Search for user in AD
4. Authenticate user with their credentials
5. Map AD groups to application roles
6. Create/update user in local database
7. Issue JWT tokens

### Role Mapping
Configure in `src/services/ldap.service.ts`:

\`\`\`typescript
const roleMapping = {
  'CN=SecurityCEO,OU=Groups,DC=company,DC=local': 'ceo',
  'CN=SecurityCISO,OU=Groups,DC=company,DC=local': 'ciso',
  'CN=SOCAnalysts,OU=Groups,DC=company,DC=local': 'soc_analyst',
  'CN=SecurityAuditors,OU=Groups,DC=company,DC=local': 'auditor',
};
\`\`\`

## 🔌 Connector Framework

### Creating a New Connector

1. Create connector class in `src/connectors/`:

\`\`\`typescript
// src/connectors/splunk.connector.ts
export class SplunkConnector implements SecurityToolConnector {
  async fetchIncidents(timeRange: string): Promise<Incident[]> {
    // Implementation
  }
  
  async testConnection(): Promise<boolean> {
    // Test logic
  }
}
\`\`\`

2. Register in `src/connectors/index.ts`
3. Configure in database `connector_configs` table

### Available Connectors
- SIEM (Splunk, QRadar, Sentinel)
- EDR (CrowdStrike, SentinelOne)
- Asset Management (ServiceNow CMDB)
- Vulnerability Scanners (Nessus, Qualys)
- Ticketing (ServiceNow, Jira)

## ⚙️ Background Jobs

Jobs run automatically via BullMQ:

| Job | Interval | Description |
|-----|----------|-------------|
| `sync-siem` | 5 min | Fetch incidents from SIEM |
| `sync-edr` | 10 min | Fetch alerts from EDR |
| `sync-assets` | 1 hour | Sync asset inventory |
| `calculate-metrics` | 5 min | Calculate KPIs |
| `cleanup-old-data` | Daily | Remove old logs/metrics |

## 🔍 Monitoring & Logging

### Health Check
\`\`\`bash
curl http://localhost:5000/health
\`\`\`

Response:
\`\`\`json
{
  "status": "healthy",
  "timestamp": "2025-11-30T10:00:00Z",
  "services": {
    "database": "up",
    "redis": "up",
    "ldap": "up"
  }
}
\`\`\`

### Logs
- **Location:** `./logs/`
- **Files:**
  - `combined.log` - All logs
  - `error.log` - Errors only
- **Rotation:** 7 days, 10MB per file

## 🚀 Deployment

### Docker Deployment

\`\`\`dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 5000 5001

CMD ["node", "dist/server.js"]
\`\`\`

\`\`\`yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "5000:5000"
      - "5001:5001"
    environment:
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis
    restart: always

  postgres:
    image: postgres:14
    volumes:
      - postgres-data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: security_dashboard
      POSTGRES_USER: dashboard_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}

  redis:
    image: redis:6-alpine
    volumes:
      - redis-data:/data

volumes:
  postgres-data:
  redis-data:
\`\`\`

### Production Checklist
- [ ] Change all default passwords
- [ ] Generate strong JWT secrets
- [ ] Enable SSL/TLS for all connections
- [ ] Configure firewall rules
- [ ] Set up automated backups
- [ ] Enable audit logging
- [ ] Configure monitoring (Prometheus/Grafana)
- [ ] Set up log aggregation
- [ ] Implement rate limiting
- [ ] Review security headers
- [ ] Test disaster recovery

## 🛡️ Security Best Practices

1. **Secrets Management:**
   - Never commit `.env` files
   - Use environment variables or secret managers
   - Rotate credentials regularly

2. **Database Security:**
   - Use connection pooling
   - Implement query timeouts
   - Enable SSL for connections
   - Regular backups

3. **API Security:**
   - Rate limiting enabled
   - Input validation on all endpoints
   - CORS configured
   - Helmet.js security headers

4. **Audit Logging:**
   - All authentication attempts logged
   - API access logged with user info
   - Failed operations logged
   - Retention: 2 years minimum

## 🧪 Testing

\`\`\`bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# API tests
npm run test:api
\`\`\`

## 📚 Additional Documentation

- [Database Schema](./docs/database-schema.md)
- [Connector Development Guide](./docs/connector-guide.md)
- [API Reference](./docs/api-reference.md)
- [Deployment Guide](./docs/deployment.md)

## 🆘 Troubleshooting

### LDAP Connection Failed
- Verify LDAP URL and credentials
- Check network connectivity
- Ensure service account has read permissions
- Test with `ldapsearch` command

### Database Connection Issues
- Verify PostgreSQL is running
- Check credentials and permissions
- Verify network access
- Check `pg_hba.conf` for access rules

### Redis Connection Failed
- Verify Redis is running
- Check password if configured
- Verify port accessibility

## 📞 Support

For issues or questions:
- Check logs in `./logs/`
- Review health endpoint `/health`
- Check audit logs in database
- Contact: security-ops@company.local

## 📄 License

Proprietary - Internal Use Only

# Vercel Deployment Guide

## ☁️ Cloud Services Setup (Required)

### 1. PostgreSQL Database - Neon (Recommended - Free Tier)

**Why Neon?** Serverless PostgreSQL, perfect for Vercel, 512MB free tier.

1. Go to [neon.tech](https://neon.tech)
2. Sign up with GitHub
3. Create new project: `security-dashboard`
4. Copy the connection string (starts with `postgresql://`)
5. Add to Vercel environment variables as `DATABASE_URL`

**Alternative Options:**
- [Supabase](https://supabase.com) - 500MB free
- [Railway](https://railway.app) - $5/month credit free
- [ElephantSQL](https://www.elephantsql.com) - 20MB free

### 2. Redis - Upstash (Recommended - Free Tier)

**Why Upstash?** Serverless Redis, built for edge/serverless, 10K commands/day free.

1. Go to [upstash.com](https://upstash.com)
2. Sign up with GitHub
3. Create Redis database: 
   - Name: `security-dashboard-cache`
   - Region: Choose closest to your users
   - Type: Regional (free tier)
4. Copy the connection string (starts with `redis://` or `rediss://`)
5. Add to Vercel environment variables as `REDIS_URL`

**Alternative:**
- [Redis Cloud](https://redis.com/try-free/) - 30MB free

## 🚀 Vercel Deployment Steps

### Step 1: Initialize Database Schema

Before deploying, initialize your Neon database:

```bash
# Install psql if not already installed
# Download from: https://www.postgresql.org/download/windows/

# Connect to Neon database
psql "your-neon-connection-string"

# Run schema (copy-paste contents of src/database/schema.sql)
# OR use Neon's SQL Editor in their dashboard
```

### Step 2: Push to GitHub

```bash
cd "c:\Users\haryp\Desktop\FINAL YEAR PROJECT\security-dashboard-mvp-exec-friendly"
git init
git add .
git commit -m "Initial commit - Security Dashboard with backend"
git branch -M main
git remote add origin https://github.com/Perister2904/security-dashboard-mvp.git
git push -u origin main
```

### Step 3: Deploy to Vercel

#### Option A: Vercel Dashboard (Easiest)

1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "Add New Project"
4. Import `security-dashboard-mvp` repository
5. Configure project:
   - **Framework Preset:** Next.js
   - **Root Directory:** `./` (leave as is)
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`
6. Add Environment Variables:
   ```
   DATABASE_URL=postgresql://...
   REDIS_URL=redis://...
   JWT_SECRET=generate-random-string-here
   JWT_REFRESH_SECRET=generate-different-random-string
   NODE_ENV=production
   ```
7. Click "Deploy"

#### Option B: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Follow prompts:
# - Setup and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name? security-dashboard-mvp
# - Directory? ./
# - Override settings? No

# Add environment variables
vercel env add DATABASE_URL
vercel env add REDIS_URL
vercel env add JWT_SECRET
vercel env add JWT_REFRESH_SECRET
vercel env add NODE_ENV

# Deploy to production
vercel --prod
```

## 🔧 Configuration

### Frontend API URL Update

After deployment, update the frontend to use your Vercel backend URL:

**File:** `lib/api-client.ts`
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://your-app.vercel.app/api';
```

Add to Vercel environment variables:
```
NEXT_PUBLIC_API_URL=https://your-app.vercel.app/api
```

### CORS Configuration

The backend is already configured to allow your Vercel frontend URL. Just ensure `FRONTEND_URL` environment variable is set in Vercel:

```
FRONTEND_URL=https://your-app.vercel.app
```

## 🧪 Testing Your Deployment

### Test Database Connection

```bash
# From your local machine
curl https://your-app.vercel.app/api/health

# Expected response:
# {"status":"ok","database":"connected","redis":"connected"}
```

### Test Authentication

```bash
# Register a user
curl -X POST https://your-app.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePassword123!",
    "name": "Admin User",
    "role": "admin"
  }'

# Login
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePassword123!"
  }'
```

## 📝 Important Notes

### Serverless Limitations

1. **WebSocket:** Vercel serverless functions don't support persistent WebSocket connections. For real-time features:
   - Use Vercel's [Server-Sent Events (SSE)](https://vercel.com/docs/functions/streaming)
   - Or use [Pusher](https://pusher.com) / [Ably](https://ably.com) for real-time updates
   - Or deploy WebSocket server separately on Railway/Render

2. **Background Workers:** BullMQ workers need a persistent server. Options:
   - Deploy workers separately on [Railway](https://railway.app) or [Render](https://render.com)
   - Use Vercel Cron Jobs for scheduled tasks
   - Use Upstash QStash for background processing

3. **Function Timeout:** Vercel free tier has 10-second limit, Pro has 60 seconds

### Database Connection Pooling

The backend uses connection pooling optimized for serverless:
- Max 5 connections per function instance
- Idle timeout: 30 seconds
- Connection reuse enabled

### Cost Estimation (Free Tier)

- **Vercel:** 100GB bandwidth/month (enough for most projects)
- **Neon:** 512MB storage, unlimited compute hours
- **Upstash:** 10K commands/day (about 300-500 daily users)

Total: **$0/month** for small to medium usage!

## 🚨 Security Checklist

Before deploying to production:

- [ ] Use strong JWT secrets (32+ random characters)
- [ ] Enable SSL (Vercel provides this automatically)
- [ ] Set `NODE_ENV=production`
- [ ] Review and restrict CORS origins
- [ ] Enable rate limiting (already configured)
- [ ] Use environment variables for all secrets
- [ ] Enable Neon's IP allowlist if needed
- [ ] Set up monitoring (Vercel Analytics, Sentry)

## 🎯 Quick Start (TL;DR)

```bash
# 1. Setup cloud services
# - Create Neon PostgreSQL database → Copy DATABASE_URL
# - Create Upstash Redis → Copy REDIS_URL

# 2. Initialize database
psql "your-neon-url" -f backend/src/database/schema.sql

# 3. Push to GitHub
git init && git add . && git commit -m "Initial commit"
git remote add origin https://github.com/Perister2904/security-dashboard-mvp.git
git push -u origin main

# 4. Deploy on Vercel
# - Import repo at vercel.com
# - Add environment variables
# - Deploy!

# 5. Test
curl https://your-app.vercel.app/api/health
```

## 🆘 Troubleshooting

### "Database connection failed"
- Verify `DATABASE_URL` in Vercel environment variables
- Check Neon dashboard that database is active
- Ensure connection string includes `?sslmode=require`

### "Redis connection failed"
- Verify `REDIS_URL` in Vercel environment variables
- Check Upstash dashboard that database is active
- Ensure you're using `rediss://` (with SSL) for production

### "Function timeout"
- Reduce data fetch sizes
- Add pagination to queries
- Consider upgrading to Vercel Pro (60s timeout)

### "CORS errors"
- Set `FRONTEND_URL` environment variable
- Ensure frontend URL matches exactly (no trailing slash)

## 📚 Additional Resources

- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Neon Documentation](https://neon.tech/docs/introduction)
- [Upstash Redis Documentation](https://upstash.com/docs/redis)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)

# Quick Deployment Checklist

## ☁️ Before You Deploy

### 1. Setup Cloud Database (5 minutes)

**PostgreSQL - Neon (Recommended)**
1. Go to [neon.tech](https://neon.tech) → Sign in with GitHub
2. Create project: `security-dashboard`
3. Copy connection string (looks like: `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb`)
4. Run schema: Open Neon SQL Editor → Paste contents of `src/database/schema.sql` → Execute

**Redis - Upstash (Recommended)**
1. Go to [upstash.com](https://upstash.com) → Sign in with GitHub
2. Create Redis database: Regional, closest to your users
3. Copy connection string (looks like: `redis://default:xxx@region.upstash.io:6379`)

### 2. Push to GitHub (2 minutes)

```bash
cd "c:\Users\haryp\Desktop\FINAL YEAR PROJECT\security-dashboard-mvp-exec-friendly"
git init
git add .
git commit -m "Initial commit: Security Dashboard"
git branch -M main
git remote add origin https://github.com/Perister2904/security-dashboard-mvp.git
git push -u origin main
```

### 3. Deploy on Vercel (3 minutes)

1. Go to [vercel.com](https://vercel.com) → Sign in with GitHub
2. Click "Add New Project" → Import `security-dashboard-mvp`
3. Configure:
   - Framework: **Next.js**
   - Root Directory: **`./`** (leave default)
4. Add Environment Variables:
   ```
   DATABASE_URL=postgresql://your-neon-connection-string
   REDIS_URL=redis://your-upstash-connection-string
   JWT_SECRET=generate-random-32-char-string
   JWT_REFRESH_SECRET=generate-different-random-32-char-string
   NODE_ENV=production
   FRONTEND_URL=https://your-app.vercel.app
   ```
5. Click **Deploy**

### 4. Test (1 minute)

```bash
# Test backend health
curl https://your-app.vercel.app/api/health

# Expected: {"status":"ok","database":"connected","redis":"connected"}
```

## 🎯 Total Time: ~10 minutes

## 💰 Cost: **$0/month** (Free tiers)
- Vercel: 100GB bandwidth
- Neon: 512MB storage
- Upstash: 10K commands/day

## 📝 Environment Variables Needed

Copy these to Vercel:
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=your-random-secret-32-chars
JWT_REFRESH_SECRET=your-other-random-secret-32-chars
NODE_ENV=production
FRONTEND_URL=https://your-app.vercel.app
CORS_ORIGIN=https://your-app.vercel.app
```

## 🆘 Troubleshooting

**"Database connection failed"**
- Check DATABASE_URL is correct
- Ensure it includes `?sslmode=require` at the end
- Verify Neon database is active

**"Redis connection failed"**
- Check REDIS_URL is correct
- Ensure using `redis://` or `rediss://` (with SSL)
- Verify Upstash database is active

**"404 on /api routes"**
- Check vercel.json is in backend folder
- Ensure all files are committed to GitHub

## ✅ Done!
Your enterprise security dashboard is now live on Vercel! 🚀

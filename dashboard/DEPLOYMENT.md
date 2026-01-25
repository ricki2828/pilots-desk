# Supervisor Dashboard - Deployment Guide

This guide covers deploying the Pilot's Desk Supervisor Dashboard to production.

## Prerequisites

- PostgreSQL 15+ database
- Python 3.11+ with FastAPI backend
- Node.js 18+ for dashboard
- Reverse proxy (nginx/Caddy) for production

## Backend Setup

### 1. Database Initialization

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE pilots_desk;

# Run schema creation
psql -U postgres -d pilots_desk -f backend/app/db/schema.sql
```

### 2. Backend Configuration

Create `.env` file in `backend/` directory:

```bash
DATABASE_URL=postgresql://pilots_desk:changeme@localhost:5432/pilots_desk
JWT_SECRET_KEY=your-secret-key-here
ANTHROPIC_API_KEY=your-anthropic-key-here
OPENAI_API_KEY=your-openai-key-here  # Optional
```

### 3. Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 4. Run Backend

**Development:**
```bash
python -m app.main
# Runs on http://localhost:8006
```

**Production (with Gunicorn):**
```bash
gunicorn app.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8006 \
  --access-logfile logs/access.log \
  --error-logfile logs/error.log
```

## Dashboard Setup

### 1. Install Dependencies

```bash
cd dashboard
npm install
```

### 2. Configure Environment

Create `.env` file:

```bash
VITE_API_URL=https://api.pilotsdesk.com  # Your backend URL
```

### 3. Build Dashboard

```bash
npm run build
# Output in dist/ directory
```

### 4. Serve Dashboard

**Option A: Static Hosting (Vercel/Netlify)**

Deploy `dist/` folder to static hosting service.

**Option B: Nginx**

```nginx
server {
    listen 80;
    server_name dashboard.pilotsdesk.com;

    root /var/www/pilots-desk-dashboard/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # WebSocket proxy for supervisor endpoint
    location /api/supervisor/ws {
        proxy_pass http://localhost:8006;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # REST API proxy
    location /api/ {
        proxy_pass http://localhost:8006;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Database Maintenance

### Backup

```bash
# Daily backup
pg_dump pilots_desk > backup_$(date +%Y%m%d).sql
```

### 90-Day Retention Cleanup

The database includes an automatic cleanup function. Set up a cron job:

```cron
# Run cleanup daily at 2 AM
0 2 * * * psql -U pilots_desk -d pilots_desk -c "SELECT cleanup_old_data();"
```

Or use PostgreSQL's pg_cron extension:

```sql
-- Install pg_cron extension
CREATE EXTENSION pg_cron;

-- Schedule cleanup job
SELECT cron.schedule('cleanup-old-data', '0 2 * * *', 'SELECT cleanup_old_data()');
```

## Monitoring

### Health Checks

**Backend:**
```bash
curl http://localhost:8006/health
# Should return: {"status": "healthy", "llm_provider": "ready", ...}
```

**Database:**
```sql
SELECT COUNT(*) FROM active_calls;  -- Current active calls
SELECT COUNT(*) FROM call_metadata WHERE created_at > NOW() - INTERVAL '1 day';  -- Calls today
```

### Logs

**Backend Logs:**
- Location: `backend/logs/backend.log`
- Rotation: Set up logrotate

```bash
# /etc/logrotate.d/pilots-desk
/path/to/pilots-desk/backend/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 www-data www-data
}
```

**Dashboard Logs:**
- Check browser console for client-side errors
- Set up Sentry for production error tracking

## Scaling

### Backend Scaling

1. **Horizontal Scaling**: Deploy multiple backend instances behind load balancer
2. **WebSocket Considerations**: Use sticky sessions or Redis pub/sub for WebSocket broadcasting
3. **Database Connection Pooling**: Already configured (pool_size=10, max_overflow=20)

### Database Scaling

1. **Read Replicas**: For analytics queries
2. **Indexing**: Already configured for common queries
3. **Partitioning**: Consider partitioning `call_metadata` by date for very high volume

## Security

### Backend

- [ ] Change default database password
- [ ] Generate strong JWT secret key
- [ ] Enable HTTPS/TLS
- [ ] Implement rate limiting
- [ ] Set up firewall rules (only allow dashboard access)

### Dashboard

- [ ] Enable CSP headers
- [ ] Implement authentication (JWT from backend)
- [ ] Use HTTPS only
- [ ] Implement session timeout

## Troubleshooting

### WebSocket Connection Fails

**Check CORS configuration:**
```python
# backend/app/main.py
allow_origins=[
    "https://dashboard.pilotsdesk.com",  # Add your dashboard URL
]
```

**Check reverse proxy WebSocket upgrade:**
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

### Database Connection Errors

**Verify connection string:**
```bash
psql $DATABASE_URL
```

**Check pool exhaustion:**
```python
# Increase pool size if needed
pool_size=20,
max_overflow=40
```

### Dashboard Not Updating

**Check browser console:**
- WebSocket connection status
- Network errors
- JavaScript errors

**Verify backend is broadcasting:**
```bash
# Check supervisor WebSocket logs
tail -f backend/logs/backend.log | grep "Supervisor"
```

## Performance Optimization

### Backend

- Enable Gzip compression in reverse proxy
- Use connection pooling (already configured)
- Cache team summary queries (60-second TTL)

### Dashboard

- Already using production build (`npm run build`)
- Consider CDN for static assets
- Implement code splitting for larger dashboards

### Database

- Regularly run VACUUM ANALYZE
- Monitor slow queries
- Consider materialized views for heavy analytics

## Production Checklist

Backend:
- [ ] Database created and schema applied
- [ ] Environment variables configured
- [ ] Backend running with Gunicorn/supervisor
- [ ] Health check endpoint accessible
- [ ] Logs rotating correctly
- [ ] 90-day retention cron job scheduled

Dashboard:
- [ ] Environment variables set
- [ ] Production build created
- [ ] Static files deployed
- [ ] HTTPS enabled
- [ ] WebSocket proxy configured
- [ ] Authentication implemented

Security:
- [ ] Default passwords changed
- [ ] Firewall rules configured
- [ ] HTTPS/TLS enabled
- [ ] Rate limiting enabled
- [ ] Error tracking configured (Sentry/etc)

Monitoring:
- [ ] Health checks automated
- [ ] Log aggregation configured
- [ ] Alerts set up (downtime, errors)
- [ ] Backup schedule automated

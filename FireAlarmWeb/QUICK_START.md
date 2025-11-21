# 🚀 Quick Start Guide

## For Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Grafana 10+

### Setup Steps

1. **Install Dependencies**
```bash
npm install
```

2. **Create Environment File**
```bash
# Copy template
cp ENV_TEMPLATE.txt .env

# Edit with your values
nano .env
```

3. **Setup Database**
```bash
# Create database
createdb fire_monitoring

# Run migrations
psql -d fire_monitoring -f database_migration.sql
psql -d fire_monitoring -f INCIDENT_ALERTS_MIGRATION.sql
psql -d fire_monitoring -f official_incidents_migration.sql
```

4. **Start Application**
```bash
npm start
```

5. **Access Application**
```
http://localhost:8000
```

---

## For Production (AWS EC2 with Docker)

### Quick Setup

1. **SSH into your EC2 instance**
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

2. **Upload code**
```bash
# From your local machine
scp -i your-key.pem -r ./FireAlarmWeb ubuntu@your-ec2-ip:~/
```

3. **Run setup script**
```bash
cd ~/FireAlarmWeb
chmod +x setup.sh
./setup.sh
```

4. **Create admin user**
```bash
# Generate password hash
docker exec -it fire-monitoring-web node generateHashedPassword.js YourPassword123

# Access database
docker exec -it fire-monitoring-db psql -U fireuser -d fire_monitoring

# Create admin user
INSERT INTO users (username, email, password, role, status, created_at)
VALUES ('admin', 'admin@example.com', 'PASTE_HASH_HERE', 'admin', 'approved', NOW());
```

5. **Access your application**
```
http://your-domain-or-ip
```

---

## Default Ports

- **Web Application:** 8000
- **PostgreSQL:** 5432
- **Grafana:** 3000
- **Nginx:** 80, 443

---

## Useful Commands

### Docker Commands
```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f web-app

# Restart service
docker compose restart web-app

# Check status
docker compose ps
```

### Database Commands
```bash
# Access database
docker exec -it fire-monitoring-db psql -U fireuser -d fire_monitoring

# Backup database
docker exec fire-monitoring-db pg_dump -U fireuser fire_monitoring > backup.sql

# Restore database
docker exec -i fire-monitoring-db psql -U fireuser fire_monitoring < backup.sql
```

---

## Documentation

- **PROJECT_BLUEPRINT.md** - Complete system documentation
- **DEPLOYMENT.md** - Detailed deployment guide
- **nginx.conf** - Nginx configuration
- **docker-compose.yml** - Docker orchestration

---

## Troubleshooting

### Can't access application
```bash
# Check if services are running
docker compose ps

# Check logs
docker compose logs -f
```

### Database connection error
```bash
# Verify PostgreSQL is running
docker compose ps postgres

# Check connection
docker exec -it fire-monitoring-db psql -U fireuser -d fire_monitoring -c "SELECT NOW();"
```

### Grafana panels not loading
```bash
# Check Grafana is running
docker compose ps grafana

# Check proxy logs
docker compose logs web-app | grep grafana
```

---

## Support

For detailed information, see:
- PROJECT_BLUEPRINT.md (complete system architecture)
- DEPLOYMENT.md (full deployment guide)


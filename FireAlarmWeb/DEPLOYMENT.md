# 🚀 Deployment Guide - Fire Monitoring Web Application

Complete deployment instructions for AWS EC2 with Docker Compose and Nginx.

---

## 📋 Prerequisites

- AWS EC2 instance (t3.medium or larger recommended)
- Ubuntu 22.04 LTS
- Domain name pointed to your EC2 instance (optional but recommended)
- SSH access to your EC2 instance

---

## 🔧 Part 1: EC2 Instance Setup

### 1. Launch EC2 Instance

**Instance Configuration:**
- **AMI:** Ubuntu Server 22.04 LTS
- **Instance Type:** t3.medium (2 vCPU, 4 GB RAM) minimum
- **Storage:** 30 GB gp3 EBS volume
- **Security Group Rules:**

| Type | Protocol | Port Range | Source |
|------|----------|------------|--------|
| SSH | TCP | 22 | Your IP |
| HTTP | TCP | 80 | 0.0.0.0/0 |
| HTTPS | TCP | 443 | 0.0.0.0/0 |
| Custom TCP | TCP | 8000 | 0.0.0.0/0 (temporary for testing) |

### 2. Connect to Your Instance

```bash
ssh -i your-key.pem ubuntu@your-ec2-public-ip
```

### 3. Update System

```bash
sudo apt update && sudo apt upgrade -y
```

---

## 🐳 Part 2: Install Docker & Docker Compose

### 1. Install Docker

```bash
# Remove old versions
sudo apt remove docker docker-engine docker.io containerd runc

# Install prerequisites
sudo apt install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify installation
sudo docker --version
```

### 2. Add User to Docker Group

```bash
sudo usermod -aG docker $USER
newgrp docker

# Test without sudo
docker ps
```

---

## 📦 Part 3: Deploy the Application

### 1. Create Project Directory

```bash
mkdir -p ~/fire-monitoring-webapp
cd ~/fire-monitoring-webapp
```

### 2. Clone or Upload Your Code

**Option A: From Git**
```bash
git clone https://github.com/your-repo/FireAlarmWeb.git
cd FireAlarmWeb
```

**Option B: Upload via SCP**
```bash
# From your local machine
scp -i your-key.pem -r ./FireAlarmWeb ubuntu@your-ec2-ip:~/fire-monitoring-webapp/
```

### 3. Create Environment File

```bash
cd ~/fire-monitoring-webapp/FireAlarmWeb
cp .env.example .env
nano .env
```

**Edit `.env` with your values:**
```env
NODE_ENV=production
PORT=8000

DATABASE_URL=postgresql://fireuser:YourSecurePassword123@postgres:5432/fire_monitoring
POSTGRES_PASSWORD=YourSecurePassword123

SESSION_SECRET=$(openssl rand -base64 32)
```

**Generate a secure session secret:**
```bash
openssl rand -base64 32
# Copy the output and paste it into SESSION_SECRET in .env
```

### 4. Update nginx.conf

```bash
nano nginx.conf
```

Replace `your-domain.com` with:
- Your actual domain name (if you have one)
- OR your EC2 public IP address

```nginx
server_name your-ec2-public-ip;  # or your-domain.com
```

### 5. Create Required Directories

```bash
mkdir -p logs ssl
```

---

## 🚀 Part 4: Start the Application

### 1. Build and Start Containers

```bash
docker compose up -d
```

This will:
- Build the Node.js application
- Start PostgreSQL database
- Start Grafana
- Start the web application
- Start Nginx reverse proxy

### 2. Verify Containers are Running

```bash
docker compose ps
```

You should see:
```
NAME                           STATUS
fire-monitoring-db             Up (healthy)
fire-monitoring-grafana        Up (healthy)
fire-monitoring-web            Up (healthy)
fire-monitoring-nginx          Up (healthy)
```

### 3. Check Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f web-app
docker compose logs -f nginx
```

---

## 🗄️ Part 5: Database Setup

### 1. Access PostgreSQL Container

```bash
docker exec -it fire-monitoring-db psql -U fireuser -d fire_monitoring
```

### 2. Create Admin User

The database migrations should have run automatically. Now create your first admin user:

```sql
-- Create admin user (replace with your details)
INSERT INTO users (username, email, password, role, status, created_at)
VALUES (
  'admin',
  'admin@example.com',
  '$2b$10$YourHashedPasswordHere',  -- See below for generating this
  'admin',
  'approved',
  NOW()
);

-- Exit PostgreSQL
\q
```

### 3. Generate Password Hash

On your EC2 instance:

```bash
# Install Node.js temporarily to generate hash
docker exec -it fire-monitoring-web node -e "
const bcrypt = require('bcrypt');
bcrypt.hash('YourAdminPassword123', 10).then(hash => console.log(hash));
"
```

Copy the output and use it in the INSERT statement above.

**OR** use the `generateHashedPassword.js` script:

```bash
docker exec -it fire-monitoring-web node generateHashedPassword.js YourAdminPassword123
```

---

## 🌐 Part 6: Nginx Configuration

### Option 1: Using Docker Compose Nginx (Recommended)

The docker-compose.yml already includes Nginx. No additional setup needed!

### Option 2: System Nginx (Alternative)

If you prefer system-level Nginx instead of container:

```bash
# Install Nginx
sudo apt install -y nginx

# Copy configuration
sudo cp nginx.conf /etc/nginx/sites-available/fire-monitoring
sudo ln -s /etc/nginx/sites-available/fire-monitoring /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## 🔒 Part 7: SSL/HTTPS Setup (Recommended)

### 1. Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Obtain SSL Certificate

```bash
# Make sure your domain points to your EC2 IP
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### 3. Update nginx.conf

Uncomment the SSL lines in `nginx.conf`:

```nginx
listen 443 ssl http2;
ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
```

### 4. Reload Nginx

```bash
sudo systemctl reload nginx
# OR if using Docker Nginx
docker compose restart nginx
```

### 5. Set Up Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot automatically adds a renewal cron job
# Verify it exists
sudo systemctl list-timers | grep certbot
```

---

## ✅ Part 8: Verify Deployment

### 1. Test Application Access

Open your browser and navigate to:
- `http://your-domain.com` or `http://your-ec2-ip`
- You should see the login page

### 2. Test Login

- Login with the admin credentials you created
- You should be redirected to the dashboard

### 3. Check All Pages

- ✅ Dashboard
- ✅ Devices
- ✅ Analytics
- ✅ Incident Logs
- ✅ Export
- ✅ Settings

### 4. Verify Grafana Proxy

Check that Grafana panels load on:
- Dashboard page (map and alert table)
- Devices page (device list table)

### 5. Test Health Endpoint

```bash
curl http://your-domain.com/health
# Should return: healthy
```

---

## 📊 Part 9: Monitoring & Maintenance

### View Container Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f web-app
docker compose logs -f postgres
docker compose logs -f grafana
docker compose logs -f nginx
```

### Restart Services

```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart web-app
```

### Stop Services

```bash
docker compose down
```

### Update Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose up -d --build
```

### Database Backup

```bash
# Create backup
docker exec fire-monitoring-db pg_dump -U fireuser fire_monitoring > backup_$(date +%Y%m%d).sql

# Restore backup
docker exec -i fire-monitoring-db psql -U fireuser fire_monitoring < backup_20251121.sql
```

### View Resource Usage

```bash
docker stats
```

---

## 🔧 Part 10: Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs web-app

# Check container status
docker compose ps

# Restart container
docker compose restart web-app
```

### Database Connection Errors

```bash
# Check if PostgreSQL is running
docker compose ps postgres

# Check PostgreSQL logs
docker compose logs postgres

# Test connection
docker exec -it fire-monitoring-db psql -U fireuser -d fire_monitoring -c "SELECT NOW();"
```

### Nginx 502 Bad Gateway

```bash
# Check if web app is running
docker compose ps web-app

# Check web app logs
docker compose logs web-app

# Check nginx logs
docker compose logs nginx

# Verify nginx config
docker exec fire-monitoring-nginx nginx -t
```

### Grafana Panels Not Loading

```bash
# Check Grafana is running
docker compose ps grafana

# Check Grafana logs
docker compose logs grafana

# Verify proxy configuration in web app
docker compose logs web-app | grep grafana
```

### Port Already in Use

```bash
# Check what's using port 80
sudo lsof -i :80

# Kill the process (if needed)
sudo kill -9 <PID>

# Or change the port in docker-compose.yml
```

---

## 🔐 Security Checklist

- [ ] Changed default passwords in `.env`
- [ ] Generated strong SESSION_SECRET
- [ ] Configured firewall/security group properly
- [ ] Set up SSL/HTTPS
- [ ] Created admin user with strong password
- [ ] Disabled root login over SSH
- [ ] Set up automated backups
- [ ] Configured log rotation
- [ ] Updated security headers in nginx.conf
- [ ] Enabled fail2ban (optional but recommended)

---

## 📈 Performance Optimization

### 1. Enable Gzip Compression (Nginx)

Add to nginx.conf:
```nginx
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
```

### 2. Increase Connection Limits (PostgreSQL)

```bash
# Edit postgresql.conf
docker exec -it fire-monitoring-db vi /var/lib/postgresql/data/postgresql.conf

# Update these values:
max_connections = 200
shared_buffers = 256MB
```

### 3. Use Redis for Sessions (Production)

Install Redis and update `server.js`:
```javascript
const RedisStore = require('connect-redis')(session);
const redis = require('redis');
const redisClient = redis.createClient();

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
```

---

## 🎯 Quick Reference Commands

```bash
# Start application
docker compose up -d

# Stop application
docker compose down

# View logs
docker compose logs -f

# Restart service
docker compose restart web-app

# Rebuild and restart
docker compose up -d --build

# Database backup
docker exec fire-monitoring-db pg_dump -U fireuser fire_monitoring > backup.sql

# Access database
docker exec -it fire-monitoring-db psql -U fireuser -d fire_monitoring

# View running containers
docker compose ps

# Check resource usage
docker stats
```

---

## 📞 Support

If you encounter issues:
1. Check the logs: `docker compose logs -f`
2. Verify all containers are healthy: `docker compose ps`
3. Review this deployment guide
4. Check the PROJECT_BLUEPRINT.md for system architecture

---

**Deployment Complete! 🎉**

Your Fire Monitoring Web Application should now be running and accessible.


# 🔥 Fire Monitoring Web Application

A comprehensive IoT-based fire monitoring and alert management system for real-time device monitoring, incident verification, and official reporting.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📖 Overview

This application provides a complete fire monitoring solution that:
- ✅ Monitors real-time sensor data from IoT fire detection devices
- ✅ Processes multi-sensor readings (Flame, Smoke, Temperature, Gas)
- ✅ Generates intelligent alerts with persistence windows
- ✅ Visualizes data on interactive dashboards
- ✅ Manages incident verification workflow
- ✅ Exports official reports for BFP (Bureau of Fire Protection)
- ✅ Supports multi-user access with role-based permissions

---

## 🚀 Quick Start

### For Production (Docker - Recommended)

```bash
# 1. Clone repository
git clone https://github.com/your-repo/FireAlarmWeb.git
cd FireAlarmWeb

# 2. Run setup script
chmod +x setup.sh
./setup.sh

# 3. Create admin user (follow prompts in setup script)

# 4. Access application
# Open http://your-domain-or-ip in browser
```

### For Development

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp ENV_TEMPLATE.txt .env
# Edit .env with your database credentials

# 3. Setup database
createdb fire_monitoring
psql -d fire_monitoring -f database_migration.sql
psql -d fire_monitoring -f INCIDENT_ALERTS_MIGRATION.sql
psql -d fire_monitoring -f official_incidents_migration.sql

# 4. Start application
npm start

# 5. Access application
# Open http://localhost:8000 in browser
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| **[QUICK_START.md](QUICK_START.md)** | Quick setup guide for development and production |
| **[PROJECT_BLUEPRINT.md](PROJECT_BLUEPRINT.md)** | Complete system architecture and API documentation |
| **[DEPLOYMENT.md](DEPLOYMENT.md)** | Detailed AWS EC2 deployment guide with Docker |
| **[nginx.conf](nginx.conf)** | Nginx reverse proxy configuration |
| **[docker-compose.yml](docker-compose.yml)** | Docker container orchestration |

---

## 🏗️ System Architecture

```
IoT Sensors → InfluxDB → ETL Process → PostgreSQL
                                           ↓
                                    Node.js App ← → Grafana
                                           ↓
                                        Nginx
                                           ↓
                                      User Browser
```

### Technology Stack

**Backend:**
- Node.js 18+ with Express.js
- PostgreSQL 14+ (data storage)
- InfluxDB 2.x (time-series data)

**Frontend:**
- Vanilla JavaScript
- Chart.js (analytics)
- Grafana (embedded dashboards)

**Infrastructure:**
- Docker & Docker Compose
- Nginx (reverse proxy)
- AWS EC2 (hosting)

---

## 🎯 Key Features

### 🔐 Authentication & User Management
- Session-based authentication
- Role-based access control (Admin, Operator, Responder)
- User approval workflow (pending → approved/rejected)
- Secure password hashing with bcrypt

### 📊 Real-Time Monitoring
- Live device status tracking
- Multi-sensor data visualization (8 channels per device)
- Geographic mapping with barangay visualization
- Auto-refresh dashboards every 5 minutes

### 🚨 Alert Management
- 3-level severity system (Normal, Warning, Critical)
- Smart alert persistence windows (3s/5s) to reduce false positives
- Incident verification workflow
- Historical incident tracking

### 📈 Analytics
- Time-range filtering (hourly, daily, weekly, monthly, yearly)
- Device-specific analytics
- Multi-sensor trend analysis
- Interactive charts with zoom/pan capabilities

### 📤 Reporting & Export
- BFP-compliant incident reporting
- CSV/Excel export functionality
- Customizable report fields
- Audit trail for all incidents

---

## 🖥️ Application Pages

### Public Pages
- **Login** - User authentication
- **Signup** - New user registration (requires admin approval)

### Protected Pages (Login Required)
- **Dashboard** - Main monitoring interface with real-time stats
- **Devices** - Device management and status monitoring
- **Analytics** - Sensor data visualization and analysis
- **Incident Logs** - Incident verification and management
- **Export** - BFP official incident reporting
- **Settings** - User management (admin only)

---

## 🔌 API Endpoints

### Authentication (`/auth/*`)
- `POST /auth/signup` - Register new user
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `GET /auth/session` - Get current session

### Dashboard (`/api/dashboard/*`)
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/status` - Real-time system status

### Devices (`/api/devices/*`)
- `GET /api/devices/stats` - Device statistics

### Incidents (`/api/incidents*`)
- `GET /api/incidents` - Get pending and verified incidents
- `POST /api/incidents/verify` - Verify incident (admin only)

### Analytics (`/api/analytics/*`)
- `GET /api/analytics` - Sensor analytics data
- `GET /api/analytics/devices` - List of all devices

### Official Incidents (`/api/official-incidents*`)
- `GET /api/official-incidents` - Get official records
- `POST /api/official-incidents` - Create BFP record
- `GET /api/official-incidents/export` - Export to CSV/Excel

### User Management (`/api/users*`) - Admin Only
- `GET /api/users` - List all users
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `GET /api/users/pending` - Get pending registrations
- `POST /api/users/approve` - Approve user
- `POST /api/users/reject` - Reject user

See [PROJECT_BLUEPRINT.md](PROJECT_BLUEPRINT.md) for complete API documentation.

---

## 🗄️ Database Schema

### Main Tables
- **users** - User accounts and authentication
- **sensor_data_aggregated** - Hourly sensor readings
- **incident_alerts** - Confirmed alerts (ETL filtered)
- **system_metrics** - Pre-computed statistics
- **verified_incidents** - Admin-verified incidents
- **official_incidents** - BFP export records

See [PROJECT_BLUEPRINT.md](PROJECT_BLUEPRINT.md) for detailed schema.

---

## 🚀 Deployment

### AWS EC2 Deployment (Recommended)

**Requirements:**
- Ubuntu 22.04 LTS
- t3.medium or larger (2 vCPU, 4GB RAM minimum)
- 30GB storage
- Docker & Docker Compose installed

**Quick Deploy:**

```bash
# 1. SSH into EC2
ssh -i your-key.pem ubuntu@your-ec2-ip

# 2. Upload code
scp -i your-key.pem -r ./FireAlarmWeb ubuntu@your-ec2-ip:~/

# 3. Run setup
cd ~/FireAlarmWeb
chmod +x setup.sh
./setup.sh
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment guide including:
- EC2 instance configuration
- Security group setup
- SSL/HTTPS configuration
- Database initialization
- Monitoring and maintenance

---

## 🔒 Security

### Implemented Security Features
- ✅ Session-based authentication with secure cookies
- ✅ Password hashing with bcrypt (10 rounds)
- ✅ Role-based access control
- ✅ SQL injection protection (parameterized queries)
- ✅ HTTPS support (via nginx)
- ✅ Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
- ✅ Grafana access protected via authentication proxy
- ✅ User approval workflow

### Security Recommendations
1. Use strong `SESSION_SECRET` in production
2. Enable HTTPS with valid SSL certificates
3. Configure firewall/security groups properly
4. Implement rate limiting for authentication endpoints
5. Use Redis for session storage in production
6. Enable database connection pooling
7. Regular security updates and patches

---

## 📊 System Requirements

### Minimum Requirements
- **CPU:** 2 cores
- **RAM:** 4 GB
- **Storage:** 20 GB
- **OS:** Ubuntu 22.04 LTS or similar

### Recommended Requirements
- **CPU:** 4 cores
- **RAM:** 8 GB
- **Storage:** 50 GB SSD
- **OS:** Ubuntu 22.04 LTS
- **Network:** Stable internet connection

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file with the following:

```env
NODE_ENV=production
PORT=8000

DATABASE_URL=postgresql://user:password@host:5432/fire_monitoring
POSTGRES_PASSWORD=your_secure_password

SESSION_SECRET=your_very_long_random_secret_key

GRAFANA_URL=http://localhost:3000
```

See [ENV_TEMPLATE.txt](ENV_TEMPLATE.txt) for template.

### Port Configuration

| Service | Default Port |
|---------|-------------|
| Web Application | 8000 |
| PostgreSQL | 5432 |
| Grafana | 3000 |
| Nginx HTTP | 80 |
| Nginx HTTPS | 443 |

---

## 🐳 Docker Support

### Docker Compose Services

```yaml
services:
  - postgres      # PostgreSQL database
  - grafana       # Grafana dashboards
  - web-app       # Node.js application
  - nginx         # Reverse proxy
```

### Useful Docker Commands

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Restart a service
docker compose restart web-app

# Stop all services
docker compose down

# Rebuild and restart
docker compose up -d --build
```

---

## 🧪 Testing

### Manual Testing
1. Login with test credentials
2. Navigate through all pages
3. Verify device data displays correctly
4. Test incident verification workflow
5. Test export functionality

### Health Checks
- Application: `http://your-domain/health`
- Database: `docker compose ps postgres`
- Grafana: `docker compose ps grafana`

---

## 📈 Performance

### Optimization Features
- Database connection pooling
- Efficient SQL queries with proper indexing
- Materialized views for aggregations
- Static file caching (30 days)
- Gzip compression
- Auto-refresh intervals optimized (5 minutes)

### Monitoring
- Docker container health checks
- Database query performance tracking
- Nginx access and error logs
- Application logging

---

## 🛠️ Troubleshooting

### Common Issues

**Application won't start:**
```bash
# Check logs
docker compose logs -f web-app

# Verify environment variables
docker compose config
```

**Database connection error:**
```bash
# Test database connection
docker exec -it fire-monitoring-db psql -U fireuser -d fire_monitoring -c "SELECT NOW();"
```

**Grafana panels not loading:**
```bash
# Check Grafana is running
docker compose ps grafana

# Check proxy configuration
docker compose logs web-app | grep grafana
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed troubleshooting guide.

---

## 📝 Version History

**v1.0.0** (November 2025)
- ✅ Initial production release
- ✅ Complete incident management workflow
- ✅ BFP export system
- ✅ User approval system
- ✅ Device lookup fixes
- ✅ Grafana proxy integration
- ✅ Comprehensive documentation

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 📞 Support

For support and questions:
- Review the [PROJECT_BLUEPRINT.md](PROJECT_BLUEPRINT.md) for system architecture
- Check the [DEPLOYMENT.md](DEPLOYMENT.md) for deployment issues
- See [QUICK_START.md](QUICK_START.md) for setup help

---

## 🆕 New Enhancements Available!

### User Profile & Notifications (Ready to Implement)
- ✅ **Extended User Profiles** - Photos, birthday, full address
- ✅ **Email Verification** - FREE using Gmail (500/day)
- ✅ **SMS Notifications** - Twilio integration (FREE $15 trial)
- ✅ **Message Viewing** - See SMS/email history in app
- ✅ **Professional Templates** - Beautiful HTML emails

**See:** `ENHANCEMENT_SUMMARY.md` for quick start guide!

---

## 🎯 Roadmap

### Planned Features
- [ ] Real-time WebSocket updates
- [ ] Mobile responsive design
- [ ] PWA support
- [ ] Advanced analytics with AI/ML
- [ ] Multi-language support
- [ ] API rate limiting
- [ ] Redis session store
- [ ] Enhanced audit logging

---

**Built with ❤️ for fire safety and monitoring**


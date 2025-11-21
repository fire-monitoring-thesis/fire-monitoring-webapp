# 🔥 Fire Monitoring Web Application - Complete System Blueprint

**Version:** 1.0.0  
**Last Updated:** November 2025  
**Technology Stack:** Node.js, Express, PostgreSQL, InfluxDB, Grafana, Docker

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Backend API](#backend-api)
5. [Frontend Pages](#frontend-pages)
6. [Data Flow](#data-flow)
7. [Authentication & Authorization](#authentication--authorization)
8. [Deployment](#deployment)
9. [Configuration](#configuration)

---

## 🎯 System Overview

### Purpose
A comprehensive fire monitoring and alert management system that:
- Receives real-time sensor data from IoT fire detection devices
- Processes and aggregates sensor readings (flame, smoke, temperature, gas)
- Generates intelligent alerts with persistence windows to reduce false positives
- Provides visualization dashboards for monitoring
- Enables incident verification and official reporting for BFP (Bureau of Fire Protection)
- Supports multi-user access with role-based permissions

### Key Features
✅ Real-time device monitoring with status tracking  
✅ Multi-sensor data aggregation (Flame A/B, Smoke A/B, Temp A/B, Gas A/B)  
✅ Smart alert system with 3-level severity (Normal, Warning, Critical)  
✅ User approval workflow (pending → approved/rejected)  
✅ Incident verification and BFP export system  
✅ Geographic visualization with barangay mapping  
✅ Analytics with time-range filtering  
✅ CSV/Excel export capabilities  
✅ Session-based authentication  
✅ Grafana dashboard integration  

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     IoT Fire Sensors                         │
│              (Flame, Smoke, Temp, Gas detectors)            │
└────────────────────┬────────────────────────────────────────┘
                     │ MQTT/HTTP
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      InfluxDB                                │
│              (Time-series data storage)                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ ETL Process (Python)
                     │ • Alert persistence windows (3s/5s)
                     │ • Consistency checks
                     │ • Deduplication
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ • sensor_data_aggregated (hourly snapshots)          │  │
│  │ • incident_alerts (confirmed alerts only)            │  │
│  │ • system_metrics (computed by ETL)                   │  │
│  │ • verified_incidents (admin-verified)                │  │
│  │ • official_incidents (BFP export ready)              │  │
│  │ • users (authentication & roles)                     │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴─────────────┐
        ▼                          ▼
┌───────────────┐          ┌──────────────┐
│   Grafana     │          │  Node.js Web │
│  (Dashboards) │◄─────────│  Application │
└───────────────┘  Proxy   └──────┬───────┘
                                  │
                                  ▼
                           ┌─────────────┐
                           │   Nginx     │
                           │ (Rev Proxy) │
                           └──────┬──────┘
                                  │
                                  ▼
                            ┌──────────┐
                            │   User   │
                            │ Browser  │
                            └──────────┘
```

### Component Roles

**InfluxDB:** Stores raw time-series sensor data with high write throughput  
**ETL Process:** Validates, aggregates, and filters data before PostgreSQL insertion  
**PostgreSQL:** Relational database for aggregated data, incidents, and user management  
**Grafana:** Provides embedded visualization panels for maps and device tables  
**Node.js App:** REST API server, authentication, and static file hosting  
**Nginx:** Reverse proxy for SSL termination, load balancing, and routing  

---

## 🗄️ Database Schema

### PostgreSQL Tables

#### 1. **users**
User authentication and role management.

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'responder',
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Roles: 'admin', 'operator', 'responder'
-- Status: 'pending', 'approved', 'rejected'
```

#### 2. **sensor_data_aggregated**
Hourly aggregated sensor readings from all devices.

```sql
CREATE TABLE sensor_data_aggregated (
  id SERIAL PRIMARY KEY,
  m VARCHAR(50) NOT NULL,              -- Device ID
  timestamp_window TIMESTAMPTZ NOT NULL,
  
  -- Sensor channels (A & B variants)
  fa NUMERIC,  fb NUMERIC,             -- Flame sensors
  ga NUMERIC,  gb NUMERIC,             -- Gas sensors
  sa NUMERIC,  sb NUMERIC,             -- Smoke sensors
  ta NUMERIC,  tb NUMERIC,             -- Temperature sensors
  
  la NUMERIC,  lo NUMERIC,             -- Latitude, Longitude
  a VARCHAR(100),                      -- Location/address
  
  alert_level INTEGER DEFAULT 0,       -- 0=Normal, 1=Pre-alert, 2=Warning, 3=Critical
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sensor_m_time ON sensor_data_aggregated(m, timestamp_window DESC);
```

#### 3. **incident_alerts**
Confirmed alerts that passed ETL consistency checks.

```sql
CREATE TABLE incident_alerts (
  id SERIAL PRIMARY KEY,
  m VARCHAR(50) NOT NULL,
  time TIMESTAMPTZ NOT NULL,
  
  fa NUMERIC,  fb NUMERIC,
  ga NUMERIC,  gb NUMERIC,
  sa NUMERIC,  sb NUMERIC,
  ta NUMERIC,  tb NUMERIC,
  
  alert_level INTEGER NOT NULL,
  event_stage VARCHAR(50),             -- 'green', 'pre-alert', 'confirmed'
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_incident_alerts_m_time ON incident_alerts(m, time DESC);
CREATE INDEX idx_incident_alerts_alert_level ON incident_alerts(alert_level);
```

#### 4. **system_metrics**
Pre-computed system statistics by ETL (updated every 5 minutes).

```sql
CREATE TABLE system_metrics (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  active_devices INTEGER DEFAULT 0,
  alerts_today INTEGER DEFAULT 0,
  system_uptime NUMERIC DEFAULT 0,
  total_locations INTEGER DEFAULT 0
);
```

#### 5. **verified_incidents**
Incidents reviewed and verified by admin users.

```sql
CREATE TABLE verified_incidents (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  alert_level INTEGER NOT NULL,
  flame_value NUMERIC,
  smoke_value NUMERIC,
  temp_value NUMERIC,
  verified_by INTEGER REFERENCES users(id),
  verified_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_verified_incidents_device_id ON verified_incidents(device_id);
CREATE INDEX idx_verified_incidents_timestamp ON verified_incidents(timestamp);
```

#### 6. **official_incidents**
Complete incident records with BFP reporting fields.

```sql
CREATE TABLE official_incidents (
  id SERIAL PRIMARY KEY,
  verified_incident_id INTEGER REFERENCES verified_incidents(id),
  device_id VARCHAR(50) NOT NULL,
  incident_timestamp TIMESTAMP NOT NULL,
  alert_level INTEGER NOT NULL,
  
  -- Sensor data
  flame_value NUMERIC,
  smoke_value NUMERIC,
  temp_value NUMERIC,
  
  -- BFP required fields
  incident_type VARCHAR(100),
  barangay VARCHAR(100),
  city VARCHAR(100),
  establishment_type VARCHAR(100),
  probable_cause TEXT,
  estimated_damage NUMERIC,
  responding_units TEXT,
  casualties_injured INTEGER DEFAULT 0,
  casualties_fatalities INTEGER DEFAULT 0,
  narrative_remarks TEXT,
  
  -- Audit trail
  verified_by INTEGER REFERENCES users(id),
  verified_at TIMESTAMP,
  generated_by INTEGER REFERENCES users(id),
  generated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_official_incidents_device_id ON official_incidents(device_id);
CREATE INDEX idx_official_incidents_timestamp ON official_incidents(incident_timestamp);
```

---

## 🔌 Backend API

### Technology
- **Framework:** Express.js (Node.js)
- **Port:** 8000 (default)
- **Session Management:** express-session with in-memory store
- **Database Client:** node-postgres (pg)

### API Routes Structure

```
/auth/*              - Authentication endpoints
/api/*               - Main application API
/api/analytics/*     - Analytics data endpoints
/messages/*          - SMS/messaging endpoints (placeholder)
/grafana/*           - Authenticated proxy to Grafana
/protected/*         - Protected static pages (requires login)
```

### Authentication Endpoints (`/auth/*`)

#### POST `/auth/signup`
Create a new user account (status: pending).

**Body:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "securepass123",
  "role": "responder"
}
```

**Response:** Redirects to `/login.html?message=pending`

---

#### POST `/auth/login`
Authenticate user (only approved users can login).

**Body:**
```json
{
  "email": "john@example.com",
  "password": "securepass123"
}
```

**Response:** 
- Success: Redirects to `/protected/dashboard.html`
- Pending: Redirects to `/login.html?message=pending`
- Rejected: Redirects to `/login.html?message=rejected`

---

#### POST `/auth/logout`
Destroy user session.

**Response:** Redirects to `/login.html?message=logout`

---

#### GET `/auth/session`
Get current user information.

**Response:**
```json
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com",
  "role": "admin"
}
```

---

### Dashboard Endpoints (`/api/dashboard/*`)

#### GET `/api/dashboard/stats`
Get dashboard statistics.

**Response:**
```json
{
  "activeDevices": 12,
  "todayAlerts": 5,
  "systemUptime": "98.5%",
  "totalLocations": 8
}
```

**Data Source:** `system_metrics`, `incident_alerts`, `sensor_data_aggregated`

---

#### GET `/api/dashboard/status`
Get real-time system status.

**Response:**
```json
{
  "systemStatus": "Operational",
  "lastUpdate": "2 minutes ago",
  "lastUpdateTimestamp": "2025-11-21T10:30:00Z",
  "respondingDevices": 12,
  "alertingDevices": 0,
  "recentActivity": "System check completed at 10:30:00 AM",
  "activityDetails": "All 12 devices responding normally"
}
```

---

### Device Endpoints (`/api/devices/*`)

#### GET `/api/devices/stats`
Get device statistics.

**Response:**
```json
{
  "onlineDevices": 10,
  "offlineDevices": 2,
  "warningStatus": 1,
  "totalLocations": 8
}
```

---

### Incident Endpoints (`/api/incidents*`)

#### GET `/api/incidents`
Get pending and verified incidents.

**Query Parameters:**
- `type`: "all" | "pending" | "verified" (default: "all")
- `device`: Device ID filter (optional)
- `startDate`: Start date filter (optional)
- `endDate`: End date filter (optional)
- `limit`: Max results (default: 100)

**Response:**
```json
{
  "pending": [
    {
      "device_id": "081925BR98-1",
      "timestamp": "2025-11-21T09:15:00Z",
      "alert_level": 2,
      "flame_value": 850.5,
      "smoke_value": 450.2,
      "temp_value": 65.8
    }
  ],
  "verified": [...]
}
```

---

#### POST `/api/incidents/verify`
Verify a pending incident (admin only).

**Body:**
```json
{
  "device_id": "081925BR98-1",
  "timestamp": "2025-11-21T09:15:00Z",
  "alert_level": 2,
  "flame_value": 850.5,
  "smoke_value": 450.2,
  "temp_value": 65.8,
  "notes": "Confirmed fire incident in warehouse"
}
```

**Response:**
```json
{
  "success": true,
  "incident": { /* verified incident record */ }
}
```

---

### Analytics Endpoints (`/api/analytics/*`)

#### GET `/api/analytics`
Get sensor analytics data.

**Query Parameters:**
- `m`: Device ID (optional)
- `start`: Start date (optional)
- `end`: End date (optional)

**Response:**
```json
{
  "rows": [
    {
      "m": "081925BR98-1",
      "timestamp_window": "2025-11-21T09:00:00Z",
      "fa": 100.5,
      "fb": 850.2,
      "sa": 200.1,
      "sb": 450.0,
      "ta": 25.5,
      "tb": 65.8,
      "ga": 50.0,
      "gb": 75.0,
      "alert_level": 2
    }
  ]
}
```

---

#### GET `/api/analytics/devices`
Get list of all devices.

**Response:**
```json
{
  "devices": [
    "081925BR98-1",
    "081925BR98-2",
    "081925BR98-3"
  ]
}
```

---

### Official Incident Endpoints (`/api/official-incidents*`)

#### POST `/api/official-incidents`
Create official incident record for BFP export.

**Body:**
```json
{
  "verified_incident_id": 123,
  "device_id": "081925BR98-1",
  "incident_timestamp": "2025-11-21T09:15:00Z",
  "alert_level": 2,
  "flame_value": 850.5,
  "smoke_value": 450.2,
  "temp_value": 65.8,
  "incident_type": "Fire",
  "barangay": "Barangay 1",
  "city": "Quezon City",
  "establishment_type": "Commercial",
  "probable_cause": "Electrical malfunction",
  "estimated_damage": 50000.00,
  "responding_units": "BFP Station 1, Local Fire Department",
  "casualties_injured": 0,
  "casualties_fatalities": 0,
  "narrative_remarks": "Fire quickly contained"
}
```

---

#### GET `/api/official-incidents`
Get official incident records.

**Query Parameters:**
- `startDate`: Start date filter (optional)
- `endDate`: End date filter (optional)
- `limit`: Max results (default: 100)

**Response:**
```json
{
  "success": true,
  "records": [...]
}
```

---

#### GET `/api/official-incidents/export?format=csv|excel`
Export official incidents to CSV or Excel.

**Response:** File download

---

### User Management Endpoints (`/api/users*`)

#### GET `/api/users` (Admin only)
Get all users.

#### POST `/api/users` (Admin only)
Create new user.

#### PUT `/api/users/:id` (Admin only)
Update user.

#### DELETE `/api/users/:id` (Admin only)
Delete user.

#### GET `/api/users/pending` (Admin only)
Get pending user registrations.

#### POST `/api/users/approve` (Admin only)
Approve pending user.

#### POST `/api/users/reject` (Admin only)
Reject pending user.

---

## 🖥️ Frontend Pages

### Public Pages

#### `/login.html`
- User authentication form
- Supports email or username login
- Displays status messages (pending, rejected, logout)

#### `/signup.html`
- User registration form
- Creates account with "pending" status
- Requires admin approval before login

---

### Protected Pages (`/protected/*`)

All protected pages require authentication.

#### `/protected/dashboard.html`
**Purpose:** Main monitoring dashboard

**Features:**
- Real-time statistics (active devices, alerts, uptime, locations)
- System status banner with visual indicators
- Embedded Grafana barangay map
- Embedded Grafana alert status table
- Auto-refresh every 5 minutes
- Live sync ticker showing time since last update

**Data Sources:**
- `/api/dashboard/stats`
- `/api/dashboard/status`
- Grafana panels via `/grafana` proxy

---

#### `/protected/devices.html`
**Purpose:** Device management and monitoring

**Features:**
- Embedded Grafana device list table
- Device statistics cards (online, offline, warnings, locations)
- Auto-refresh every 5 minutes

**Data Sources:**
- `/api/devices/stats`
- Grafana panel via `/grafana` proxy

---

#### `/protected/analytics.html`
**Purpose:** Sensor data analytics and visualization

**Features:**
- Device filter dropdown
- Date range filters (start/end date)
- KPI cards (total alerts, active devices, max alert level)
- Multi-sensor line chart with zoom/pan
- Shows all 8 sensor channels (Flame A/B, Smoke A/B, Temp A/B, Gas A/B)
- Chart.js with zoom plugin

**Data Sources:**
- `/api/analytics`
- `/api/analytics/devices`

---

#### `/protected/incident-logs.html`
**Purpose:** Incident verification and management

**Features:**
- Two tabs: Pending Verification, Verified Incidents
- Device and date range filters
- Pending incidents table with "Verify" button (admin only)
- Verified incidents table with audit trail
- Auto-refresh every 5 minutes

**Data Sources:**
- `/api/incidents`
- `/api/incidents/verify` (admin only)

---

#### `/protected/export.html`
**Purpose:** BFP official incident reporting

**Features:**
- Three-step workflow:
  1. Select verified incident
  2. Complete BFP reporting fields
  3. Export to CSV/Excel
- Verified incidents list with selection
- BFP form fields (incident type, barangay, city, damage, casualties, etc.)
- View all official records in modal
- CSV/Excel export functionality

**Data Sources:**
- `/api/incidents?type=verified`
- `/api/official-incidents`
- `/api/official-incidents/export`
- `/api/analytics/devices`

---

#### `/protected/settings.html`
**Purpose:** User management (admin only)

**Features:**
- User list with role and status
- Add, edit, delete users
- Approve/reject pending registrations
- Password change functionality

**Data Sources:**
- `/api/users`
- `/api/users/pending`
- `/api/users/approve`
- `/api/users/reject`

---

#### `/protected/sms-messages.html`
**Purpose:** SMS notification management (placeholder)

**Status:** Future feature - UI placeholder only

---

## 🔄 Data Flow

### 1. Sensor Data Collection
```
IoT Sensors → MQTT/HTTP → InfluxDB
```
- Devices send readings every 1-5 seconds
- 8 sensor channels per device (FA, FB, GA, GB, SA, SB, TA, TB)
- Location data (latitude, longitude, address)

---

### 2. ETL Processing
```
InfluxDB → Python ETL → PostgreSQL
```

**ETL Rules:**
1. **Alert Persistence Windows:**
   - Critical (Level 3): Must persist for 3+ seconds
   - Warning (Level 2): Must persist for 5+ seconds
   
2. **Consistency Checks:**
   - Validates sensor readings are within expected ranges
   - Filters out noise and transient spikes
   
3. **Aggregation:**
   - Creates hourly snapshots
   - Computes averages, max, min values
   
4. **Output Tables:**
   - `sensor_data_aggregated` - Hourly device snapshots
   - `incident_alerts` - Confirmed alerts only
   - `system_metrics` - System-wide statistics

**ETL Schedule:** Runs every 5 minutes

---

### 3. Web Application Access
```
User Browser → Nginx → Node.js App → PostgreSQL
                ↓
              Grafana
```

**Request Flow:**
1. User accesses web app through nginx
2. Nginx routes to Node.js app (port 8000)
3. App checks session authentication
4. App queries PostgreSQL for data
5. For Grafana panels, app proxies requests to Grafana (port 3000)
6. Response returned to user

---

## 🔐 Authentication & Authorization

### Session Management
- **Library:** express-session
- **Store:** In-memory (default) - recommend Redis for production
- **Cookie:** `connect.sid` (HttpOnly, Secure in production)
- **Timeout:** 24 hours (default)

### User Roles

| Role | Permissions |
|------|------------|
| **admin** | • All operator permissions<br>• User management (approve/reject/delete)<br>• Incident verification<br>• Official incident creation<br>• Export reports |
| **operator** | • View all dashboards<br>• View analytics<br>• View incidents<br>• Device monitoring |
| **responder** | • View dashboards<br>• View device status<br>• View verified incidents |

### User Workflow
1. User signs up → Status: "pending"
2. Admin reviews → Approves or rejects
3. Approved user → Can login
4. Rejected user → Cannot login (shown rejection message)

### Protected Routes
All `/protected/*` pages require authentication:
```javascript
// middleware/auth.js
function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.redirect('/login.html');
}
```

---

## 🚀 Deployment

### Environment Requirements
- **Node.js:** 18.x or higher
- **PostgreSQL:** 14.x or higher
- **Grafana:** 10.x or higher
- **InfluxDB:** 2.x or higher
- **Nginx:** 1.20 or higher (for reverse proxy)

### Environment Variables
```env
# Application
NODE_ENV=production
PORT=8000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/fire_monitoring

# Session Secret
SESSION_SECRET=your-super-secret-session-key-here

# Grafana
GRAFANA_URL=http://localhost:3000
```

### Docker Deployment
See `docker-compose.yml` for container orchestration.

### AWS EC2 Deployment
See `DEPLOYMENT.md` for complete AWS setup instructions.

---

## ⚙️ Configuration

### Server Configuration (`server.js`)
```javascript
const PORT = process.env.PORT || 8000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// PostgreSQL Pool
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

// Session Configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'super-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction, // HTTPS only in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Grafana Proxy
app.use('/grafana', grafanaAuth, createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  pathRewrite: { '^/grafana': '' }
}));
```

### Database Connection
```javascript
// Test connection on startup
pool.connect()
  .then(client => {
    console.log('✅ Connected to PostgreSQL database successfully');
    client.release();
  })
  .catch(err => {
    console.error('❌ PostgreSQL connection error:', err.message);
  });
```

---

## 📊 System Monitoring

### Health Checks
- **Database:** Connection pool health
- **Grafana:** Proxy connectivity
- **Session Store:** Memory usage

### Performance Metrics
- **Page Load Time:** < 2 seconds
- **API Response Time:** < 500ms
- **Database Query Time:** < 200ms
- **Concurrent Users:** Supports 100+ simultaneous connections

### Auto-Refresh Intervals
- Dashboard: Every 5 minutes (300000ms)
- Devices Page: Every 5 minutes
- Incident Logs: Every 5 minutes
- Analytics: Manual refresh only

---

## 🔧 Maintenance

### Database Maintenance
```sql
-- Refresh materialized views (if used)
REFRESH MATERIALIZED VIEW sensor_data_hourly;
REFRESH MATERIALIZED VIEW sensor_data_daily;

-- Clean old data (example: keep 90 days)
DELETE FROM sensor_data_aggregated 
WHERE timestamp_window < NOW() - INTERVAL '90 days';

-- Vacuum and analyze
VACUUM ANALYZE;
```

### Log Rotation
Implement log rotation for:
- Application logs
- Nginx access logs
- Nginx error logs
- PostgreSQL logs

### Backup Strategy
- **Database:** Daily automated backups
- **Configuration:** Version controlled in Git
- **User data:** Included in database backups

---

## 📝 Version History

**v1.0.0** (November 2025)
- Initial production release
- Complete incident management workflow
- BFP export system
- User approval system
- Device lookup fixes
- Grafana proxy integration

---

## 📞 Support & Documentation

For technical support or questions:
- Review this blueprint document
- Check inline code comments
- Review API endpoint documentation above
- Check deployment guides (DEPLOYMENT.md, nginx-config/)

---

**End of Blueprint**


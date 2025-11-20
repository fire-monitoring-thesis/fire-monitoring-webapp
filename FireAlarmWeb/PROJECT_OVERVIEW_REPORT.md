## Fire Monitoring Web App – Comprehensive Report

### 1. Executive Summary
- Migrated every dashboard, analytics and quick snapshot to real-time data provided by the ETL (`sensor_data_aggregated`, `system_metrics`, `incident_alerts`).
- Implemented admin-controlled user approval, incident verification, and official incident exports to align with operations workflows.
- Modernized the UI with a minimalist layout, responsive cards, loading/error states, and consistent typography while retaining the original color palette.
- Tightened alignment between backend endpoints and the ETL business rules so that “system alerts” and “warning devices” now mirror `incident_alerts` logic (confirmed alerts only).

### 2. Data & Architecture Overview
- **Data Sources**
  - Raw telemetry → InfluxDB → ETL Python job.
  - ETL enforces alert persistence windows (3s red / 5s orange) before inserting into PostgreSQL.
- **PostgreSQL Tables**
  - `sensor_data_aggregated`: hour-level snapshots feeding dashboards & analytics.
  - `system_metrics`: ETL summary for uptime, total locations, responding devices.
  - `incident_alerts`: confirmed alerts that pass the consistency rules (now the base for “system alerts”).
  - `verified_incidents`, `official_incidents`: manual review + export pipelines.
- **Backend**
  - Node.js + Express + `pg` pool.
  - Session-based auth with role checks; admins gatekeep new users and verify incidents.
  - REST endpoints under `/api` and `/auth`; Grafana proxied through `/grafana` for iframe embeds.
- **Frontend**
  - Static HTML/JS with shared CSS theme (`public/styles/style.css`).
  - Chart.js for analytics, SweetAlert2 for toasts, custom JS modules per page.

### 3. Page-by-Page Highlights
| Page | Key Features | Data Source |
| --- | --- | --- |
| `dashboard.html` | Quick stats, live status banner, hero barangay map, Grafana alert matrix, real-time sync ticker | `/api/dashboard/stats`, `/api/dashboard/status`, Grafana via `/grafana/*` |
| `analytics.html` | Device/date filters, KPI chips, zoomable multi-sensor chart, loading/error states | `/api/analytics`, `/api/analytics/devices` |
| `devices.html` | Online/offline counts, confirmed alert devices, total locations | `/api/devices/stats` |
| `incident-logs.html` | Pending vs. verified tabs, filtering, admin verification actions | `/api/incidents`, `/api/incidents/verify` |
| `settings.html` | User profile, admin-only pending approvals | `/api/users/pending`, `/api/users/approve`, `/api/users/reject` |
| `export.html` | Official incident generator & exporter (CSV/Excel) | `/api/official-incidents` |

### 4. Recent Enhancements (Nov 20 2025)
- **Analytics Filters**: compact grid layout, improved spacing, consistent `btn-compact` styling to prevent overlap on smaller screens.
- **Incident Logs**: device filter now normalizes values from `/api/analytics/devices`; verification buttons pass data through safe `data-*` attributes; shared loading state for pending/verified panels.
- **Dashboard Panels**: Barangay map elevated to a hero panel with context + Grafana shortcut; alert status iframe framed as the “overall system real-time table”; Grafana embeds now route through `/grafana` for Nginx compatibility.
- **Real-Time Last Sync**: dashboard computes a live ticker from `lastUpdateTimestamp`, updating every second (e.g., “3:42:11 PM (45s ago)” instead of static “Just now”).
- **Backend Alignment**:
  - `/api/dashboard/stats`, `/api/dashboard/status`, `/api/devices/stats` now source alert counts strictly from `incident_alerts`.
  - Status endpoint returns `alertingDevices` count for UI messaging.

### 5. Incident & User Workflow
1. **Detection**: ETL writes confirmed alerts into `incident_alerts`.
2. **Pending Review**: `/api/incidents` lists unverified alerts (1 per device/timestamp, deduped against recently verified entries).
3. **Verification**: Admin confirms data (flame/smoke/temp) → `verified_incidents`.
4. **Official Export**: Create structured reports in `official_incidents` for BFP/export needs.
5. **User Access**: Signups default to `pending`; admins approve/reject via settings panel before login is allowed.

### 6. Monitoring & Grafana
- Express proxies Grafana through `/grafana`, keeping credentials/session centralized and avoiding mixed-content issues.
- Dashboard iframes auto-refresh with Grafana’s 5-minute cadence; fallback text guides operators to verify the `/grafana` reverse proxy/Nginx route if panels fail.
- System status banner cross-checks `system_metrics` timestamps to detect stale ETL runs (“No Live Data”, “Monitoring” states).

### 7. Testing & Verification
- Smoke-tested API endpoints via browser fetches (incident filters, analytics filters, dashboard stats/status).
- Lint pass on modified frontend/route files to ensure no syntax errors.
- Manual UX verification: responsive layout for filters/panels, button states, loading/empty states, and sidebar toggles.
- DB alignment confirmed by querying `incident_alerts` for counts inside the updated endpoints.

### 8. Next Recommendations
- Add automated integration tests mocking the ETL tables to catch regressions in `/api/dashboard/*`.
- Extend analytics to support presets (last 6h/12h) and multi-device comparisons.
- Surface verified incident summaries on the dashboard for command visibility.
- Harden Grafana proxy with auth tokens or signed cookies if exposed beyond the private network.
- Consider WebSocket push (or SSE) for faster status/banner updates instead of 5-minute polling.

---
Prepared for presentation & stakeholder review – November 20, 2025.


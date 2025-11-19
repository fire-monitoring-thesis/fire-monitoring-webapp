# Migration to sensor_data_aggregated Table

## Overview
All API endpoints have been updated to use the main `sensor_data_aggregated` table instead of materialized views for quick snapshots and analytics.

## Changes Made

### ✅ Analytics Endpoint (`routes/analytics.js`)
- **Status**: Already using `sensor_data_aggregated` ✓
- **Endpoint**: `/api/analytics`
- **Table**: `sensor_data_aggregated`
- **Columns**: `m`, `timestamp_window`, `fa`, `fb`, `ga`, `gb`, `sa`, `sb`, `ta`, `tb`, `la`, `lo`, `alert_level`

### ✅ Dashboard Statistics (`routes/api.js`)
- **Endpoint**: `/api/dashboard/stats`
- **Changes**:
  - **Today's Alerts**: Changed from `sensor_data_daily` (with `max_alert_level`) to `sensor_data_aggregated` (with `alert_level`)
  - **Active Devices**: Already using `sensor_data_aggregated` ✓
  - **Total Locations**: Already using `sensor_data_aggregated` ✓

### ✅ Dashboard Status (`routes/api.js`)
- **Endpoint**: `/api/dashboard/status`
- **Changes**:
  - **System Status**: Changed from `sensor_data_hourly` (with `max_alert_level`) to `sensor_data_aggregated` (with `alert_level`)
  - **Last Update**: Changed from `sensor_data_hourly` to `sensor_data_aggregated`
  - **Responding Devices**: Changed from `sensor_data_hourly` to `sensor_data_aggregated`

### ✅ Device Statistics (`routes/api.js`)
- **Endpoint**: `/api/devices/stats`
- **Changes**:
  - **Online Devices**: Changed from `sensor_data_hourly` to `sensor_data_aggregated`
  - **Warning Status**: Changed from `sensor_data_hourly` (with `max_alert_level`) to `sensor_data_aggregated` (with `alert_level`)
  - **Total Devices**: Already using `sensor_data_aggregated` ✓

### ✅ Incidents (`routes/api.js`)
- **Endpoint**: `/api/incidents`
- **Changes**:
  - **Pending Incidents**: Changed from `sensor_data_hourly` to `sensor_data_aggregated`
  - **Column Mappings**:
    - `max_alert_level` → `alert_level`
    - `avg_fa` → `fa` (flame_value)
    - `avg_sa` → `sa` (smoke_value)
    - `avg_ta` → `ta` (temp_value)

### ✅ Hourly Analytics (`routes/api.js`)
- **Endpoint**: `/api/analytics/hourly`
- **Changes**:
  - Changed from `sensor_data_hourly` to `sensor_data_aggregated`
  - Updated to explicitly select columns: `m`, `timestamp_window`, `fa`, `fb`, `ga`, `gb`, `sa`, `sb`, `ta`, `tb`, `la`, `lo`, `alert_level`

## Column Mapping Reference

### Materialized View → Aggregated Table
- `max_alert_level` → `alert_level`
- `avg_fa` → `fa`
- `avg_fb` → `fb`
- `avg_ga` → `ga`
- `avg_gb` → `gb`
- `avg_sa` → `sa`
- `avg_sb` → `sb`
- `avg_ta` → `ta`
- `avg_tb` → `tb`
- `timestamp_window` → `timestamp_window` (same)
- `m` → `m` (same)

## Benefits

1. **Real-time Data**: All endpoints now query the main aggregated table that updates every 5 minutes via ETL
2. **Consistency**: All quick snapshots use the same data source
3. **Simplified Architecture**: No dependency on materialized views for frontend data
4. **Better Performance**: Direct queries to the main table with proper indexes

## Database Schema

The `sensor_data_aggregated` table structure (from ETL config):
- `m` - Device ID
- `timestamp_window` - 5-minute time window
- `fa`, `fb` - Flame sensor values
- `ga`, `gb` - Gas sensor values
- `sa`, `sb` - Smoke sensor values
- `ta`, `tb` - Temperature sensor values
- `la`, `lo` - Latitude/Longitude
- `alert_level` - Alert level (0-3)
- `event_stage` - Event stage
- `readings_count` - Number of readings in the window
- `created_at` - Record creation timestamp

## Testing Checklist

- [ ] Dashboard stats load correctly
- [ ] Dashboard status shows correct system status
- [ ] Device stats show online/offline devices correctly
- [ ] Incidents page shows pending incidents from aggregated table
- [ ] Analytics page loads data correctly
- [ ] All quick snapshots update every 5 minutes

## Notes

- Materialized views are still maintained by the ETL process for potential future use
- The aggregated table is the single source of truth for all frontend quick snapshots
- All queries use proper time windows (10 minutes for active devices, 1 hour for warnings, etc.)


# Data Review & Fixes Summary

## Issues Found and Fixed

### 1. ✅ Duplicate Database Queries
**Problem**: Dashboard stats endpoint was running the same query twice (lines 182 and 188) to get total devices and total locations, which were identical.

**Fix**: Removed duplicate query and set `totalLocations = totalDevices` with a comment explaining the assumption that each device is at a unique location.

**Files Changed**: `routes/api.js`

### 2. ✅ Stale Last Update Data
**Problem**: Dashboard status endpoint was getting MAX timestamp from `sensor_data_hourly` without any time filter, which could return very old data if the system had historical data.

**Fix**: Added time filter to only get MAX timestamp from last 24 hours: `WHERE timestamp_window > NOW() - INTERVAL '24 hours'`

**Files Changed**: `routes/api.js`

### 3. ✅ Incorrect Activity Details Message
**Problem**: Activity details always said "All X devices responding normally" even when there were warnings or critical alerts.

**Fix**: Made activity details conditional based on system status:
- Operational: "All X devices responding normally"
- Warning: "X devices responding, some with warnings"
- Critical: "X devices responding, critical alerts detected"

**Files Changed**: `routes/api.js`

### 4. ✅ Analytics Query Ordering
**Problem**: Analytics queries were ordering by DESC, but charts need chronological (ASC) order for proper display.

**Fix**: Changed ORDER BY to ASC for both `/api/analytics` and `/api/analytics/hourly` endpoints. Frontend already sorts the data, so this ensures consistency.

**Files Changed**: `routes/analytics.js`, `routes/api.js`

### 5. ✅ Total Locations Logic
**Problem**: Total locations was calculated the same way as total devices, which was confusing and inefficient.

**Fix**: Clarified that total locations = total devices (assuming each device is at a unique location). Added comments explaining this assumption. If the system needs multiple devices per location, a separate locations table would be needed.

**Files Changed**: `routes/api.js` (both dashboard/stats and devices/stats endpoints)

## Data Logic Verification

### ✅ Dashboard Statistics (`/api/dashboard/stats`)
- **Active Devices**: Counts distinct devices from `sensor_data_aggregated` with data in last 10 minutes ✓
- **Today's Alerts**: Counts alerts from `sensor_data_daily` where `max_alert_level > 0` and date is today ✓
- **System Uptime**: Calculated as `(activeDevices / totalDevices) * 100` ✓
- **Total Locations**: Set equal to total devices (with assumption documented) ✓

### ✅ Dashboard Status (`/api/dashboard/status`)
- **System Status**: Based on MAX alert level from last hour:
  - `>= 3` = Critical
  - `> 0` = Warning
  - `0` = Operational ✓
- **Last Update**: MAX timestamp from last 24 hours (fixed to avoid stale data) ✓
- **Responding Devices**: Counts distinct devices with data in last 10 minutes ✓
- **Activity Details**: Now conditional based on system status ✓

### ✅ Device Statistics (`/api/devices/stats`)
- **Online Devices**: Counts distinct devices from `sensor_data_hourly` with data in last 10 minutes ✓
- **Offline Devices**: Calculated as `totalDevices - onlineDevices` ✓
- **Warning Status**: Counts distinct devices with `max_alert_level > 0` in last hour ✓
- **Total Locations**: Set equal to total devices (consistent with dashboard) ✓

### ✅ Incidents (`/api/incidents`)
- **Pending Incidents**: Gets incidents from `sensor_data_hourly` where:
  - `max_alert_level > 0`
  - NOT verified (using NOT EXISTS with 1-hour window match) ✓
- **Verified Incidents**: Gets from `verified_incidents` table with user join ✓
- **Filtering**: Supports device, startDate, endDate filters ✓

### ✅ Analytics (`/api/analytics`)
- **Time Ranges**: Correctly maps to materialized views:
  - hourly → `sensor_data_hourly`
  - daily → `sensor_data_daily`
  - weekly → `sensor_data_weekly`
  - monthly → `sensor_data_monthly`
  - yearly → `sensor_data_yearly` ✓
- **Ordering**: Now ASC for chronological display ✓
- **Device Filtering**: Supports optional device filter ✓

### ✅ Incident Verification (`/api/incidents/verify`)
- **Validation**: Requires device_id, timestamp, and alert_level ✓
- **Data Storage**: Saves to `verified_incidents` table with:
  - Device ID, timestamp, alert level
  - Sensor values (flame, smoke, temp)
  - Verified by (user ID from session)
  - Notes (optional) ✓
- **Access Control**: Admin only ✓

### ✅ User Approval System
- **Status Check**: Users with 'pending' or 'rejected' status cannot login ✓
- **Approval**: Admin can approve/reject users ✓
- **New Users**: Created with 'pending' status by default ✓
- **Admin-created Users**: Created with 'approved' status ✓

## Data Consistency Checks

### ✅ Materialized Views Usage
All analytics queries correctly use materialized views:
- Dashboard stats: `sensor_data_aggregated`, `sensor_data_daily`
- Dashboard status: `sensor_data_hourly`
- Device stats: `sensor_data_hourly`, `sensor_data_aggregated`
- Analytics: All time range views
- Incidents: `sensor_data_hourly` for pending

### ✅ Time Filters
All queries use appropriate time filters:
- Active/Online devices: Last 10 minutes
- Today's alerts: Current date
- System status: Last 1 hour
- Warning status: Last 1 hour
- Last update: Last 24 hours (fixed)

### ✅ Data Format Consistency
All endpoints return consistent data formats:
- Analytics: `{ range, view, rows: [...] }`
- Stats: `{ activeDevices, todayAlerts, systemUptime, totalLocations }`
- Status: `{ systemStatus, lastUpdate, respondingDevices, recentActivity, activityDetails }`

## Summary

All identified data logic issues have been fixed:
1. ✅ Removed duplicate queries
2. ✅ Fixed stale data issue in last update
3. ✅ Fixed incorrect activity details message
4. ✅ Fixed analytics query ordering
5. ✅ Clarified total locations logic

The system now has:
- ✅ Consistent data queries
- ✅ Logical data relationships
- ✅ Proper time filtering
- ✅ Correct status calculations
- ✅ Efficient database usage

**Status**: All data logic verified and fixed ✓


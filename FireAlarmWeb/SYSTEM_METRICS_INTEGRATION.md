# System Metrics Integration - Complete Update

## Overview
All snapshot views and quick statistics now fetch real, meaningful data from the database tables populated by the ETL process, specifically using the `system_metrics` table and `sensor_data_aggregated` table.

## Database Tables Used

### 1. `system_metrics` Table (Populated by ETL every 5 minutes)
- **timestamp** - When the metrics were calculated
- **active_devices** - Count of distinct devices with data in last 24 hours
- **alerts_today** - Count of alerts with `alert_level >= 2` today
- **system_uptime** - Percentage (already calculated: active_devices / total_devices * 100)
- **total_locations** - Count of distinct locations from 'a' column

### 2. `sensor_data_aggregated` Table (5-minute aggregated data)
- **m** - Device ID
- **timestamp_window** - 5-minute time window
- **fa, fb** - Flame sensor values
- **ga, gb** - Gas sensor values
- **sa, sb** - Smoke sensor values
- **ta, tb** - Temperature sensor values
- **la, lo** - Latitude/Longitude
- **a** - Location identifier
- **alert_level** - Alert level (0-3)
- **event_stage** - Event stage
- **readings_count** - Number of readings in the window

## Updated Endpoints

### ✅ `/api/dashboard/stats`
**Primary Source**: `system_metrics` table (most recent row)
**Fallback**: Calculated from `sensor_data_aggregated` if `system_metrics` is empty

**Returns**:
- `activeDevices` - From `system_metrics.active_devices` (devices in last 24 hours)
- `todayAlerts` - From `system_metrics.alerts_today` (alerts with `alert_level >= 2`)
- `systemUptime` - From `system_metrics.system_uptime` (percentage)
- `totalLocations` - From `system_metrics.total_locations` (distinct 'a' values)

**Fallback Logic**:
- If `system_metrics` is empty, calculates from `sensor_data_aggregated`:
  - Active devices: Last 24 hours
  - Alerts today: `alert_level >= 2` (matching ETL logic)
  - System uptime: Calculated percentage
  - Total locations: Distinct 'a' column values

### ✅ `/api/dashboard/status`
**Primary Sources**: 
- `system_metrics.timestamp` - For last update time
- `sensor_data_aggregated` - For current alert level and responding devices

**Returns**:
- `systemStatus` - Based on MAX `alert_level` from last hour:
  - `>= 3` = "Critical"
  - `> 0` = "Warning"
  - `0` = "Operational"
- `lastUpdate` - From `system_metrics.timestamp` (when ETL last ran)
- `respondingDevices` - Count of distinct devices with data in last 10 minutes
- `recentActivity` - Formatted activity message
- `activityDetails` - Status-based activity description

**Fallback**: Uses `sensor_data_aggregated.timestamp_window` if `system_metrics` is empty

### ✅ `/api/devices/stats`
**Primary Sources**:
- `sensor_data_aggregated` - For online/offline/warning devices
- `system_metrics.total_locations` - For total locations

**Returns**:
- `onlineDevices` - Devices with data in last 10 minutes
- `offlineDevices` - Total devices - online devices
- `warningStatus` - Devices with `alert_level > 0` in last hour
- `totalLocations` - From `system_metrics.total_locations` (with fallback to distinct 'a' column)

**Fallback**: Calculates locations from distinct 'a' column if `system_metrics` is empty

### ✅ `/api/incidents`
**Source**: `sensor_data_aggregated` for pending incidents
**Returns**:
- Pending incidents from `sensor_data_aggregated` where `alert_level > 0`
- Uses columns: `fa` (flame), `sa` (smoke), `ta` (temp) - matching ETL structure
- Verified incidents from `verified_incidents` table

### ✅ `/api/analytics`
**Source**: `sensor_data_aggregated`
**Returns**: Raw sensor data with all columns (fa, fb, ga, gb, sa, sb, ta, tb, la, lo, alert_level)

## Data Alignment with ETL

### Alert Level Thresholds
- **Dashboard Stats (`alerts_today`)**: Uses `alert_level >= 2` (matches ETL logic)
- **Incidents**: Uses `alert_level > 0` (shows all alerts for incident management)
- **System Status**: Uses MAX `alert_level` from last hour

### Time Windows
- **Active Devices**: Last 24 hours (matches ETL: `timestamp_window >= now - 24 hours`)
- **Today's Alerts**: Current date (matches ETL: `DATE(timestamp_window) = CURRENT_DATE`)
- **Online Devices**: Last 10 minutes (real-time status)
- **Warning Status**: Last 1 hour (recent warnings)

### Location Data
- Uses `a` column from `sensor_data_aggregated` for location identification
- `system_metrics.total_locations` stores distinct count of 'a' values
- Fallback to calculating from `sensor_data_aggregated` if metrics unavailable

## Benefits

1. **Performance**: Uses pre-calculated metrics from `system_metrics` instead of recalculating
2. **Consistency**: All endpoints use the same data source as the ETL process
3. **Real-time**: Quick snapshots reflect data updated every 5 minutes
4. **Reliability**: Fallback logic ensures endpoints work even if `system_metrics` is empty
5. **Accuracy**: All calculations match the ETL logic exactly

## Testing Checklist

- [ ] Dashboard stats show correct values from `system_metrics`
- [ ] Dashboard status shows correct system status and last update time
- [ ] Device stats show correct online/offline counts
- [ ] Total locations matches distinct 'a' column count
- [ ] All values update every 5 minutes (when ETL runs)
- [ ] Fallback logic works if `system_metrics` is empty
- [ ] Alert thresholds match ETL logic (`>= 2` for alerts_today)

## Notes

- The ETL process updates `system_metrics` every 5 minutes
- All endpoints have fallback logic to calculate from `sensor_data_aggregated` if needed
- Column names match exactly with ETL output (fa, sa, ta instead of avg_fa, etc.)
- Time windows match ETL calculations for consistency


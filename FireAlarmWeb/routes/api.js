// ===== IMPORTS & SETUP =====
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");

// ====== USER MANAGEMENT ENDPOINTS ======

// ✅ GET all users (admin only)
router.get("/users", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    const result = await req.pool.query(
      "SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Error fetching users" });
  }
});

// ✅ ADD a new user (admin only)
router.post("/users", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: "Admin access required" });
  }

  const { username, email, password, role } = req.body;

  if (!username || !email || !password || !role) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const existingUser = await req.pool.query(
      "SELECT id FROM users WHERE username = $1 OR email = $2",
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Username or email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await req.pool.query(
      "INSERT INTO users (username, email, password, role, status, created_at) VALUES ($1, $2, $3, $4, 'approved', NOW()) RETURNING id, username, email, role, created_at",
      [username, email, hashedPassword, role]
    );

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error("Error adding user:", err);
    res.status(500).json({ error: "Error adding user" });
  }
});

// ✅ UPDATE a user (admin only)
router.put("/users/:id", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: "Admin access required" });
  }

  const { id } = req.params;
  const { username, email, password, role } = req.body;

  if (!username || !email || !role) {
    return res.status(400).json({ error: "Username, email, and role are required" });
  }

  try {
    const existingUser = await req.pool.query(
      "SELECT id FROM users WHERE (username = $1 OR email = $2) AND id != $3",
      [username, email, id]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Username or email already exists" });
    }

    let query, params;

    if (password && password.trim() !== '') {
      const hashed = await bcrypt.hash(password, 10);
      query = "UPDATE users SET username = $1, email = $2, password = $3, role = $4 WHERE id = $5 RETURNING id, username, email, role, created_at";
      params = [username, email, hashed, role, id];
    } else {
      query = "UPDATE users SET username = $1, email = $2, role = $3 WHERE id = $4 RETURNING id, username, email, role, created_at";
      params = [username, email, role, id];
    }

    const result = await req.pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ error: "Error updating user" });
  }
});

// ✅ DELETE a user (admin only)
router.delete("/users/:id", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: "Admin access required" });
  }

  const { id } = req.params;

  try {
    const userToDelete = await req.pool.query(
      "SELECT username, role FROM users WHERE id = $1",
      [id]
    );

    if (userToDelete.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    if (parseInt(id) === req.session.user.id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    await req.pool.query("DELETE FROM users WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ error: "Error deleting user" });
  }
});

// ====== ADMIN CREDENTIAL CHECK ======
router.post("/verify-admin", async (req, res) => {
  const { adminEmail, adminPassword } = req.body;

  try {
    const result = await req.pool.query(
      "SELECT * FROM users WHERE email = $1 AND role = 'admin'",
      [adminEmail]
    );
    const admin = result.rows[0];

    if (admin && (await bcrypt.compare(adminPassword, admin.password))) {
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    res.status(500).json({ error: "Error verifying admin credentials" });
  }
});

// ====== DASHBOARD STATISTICS ======
router.get("/dashboard/stats", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Authentication required" });

  try {
    const pool = req.pool;

    // Get the most recent system metrics from the system_metrics table (populated by ETL every 5 minutes)
    const metricsResult = await pool.query(
      `SELECT 
        active_devices,
        alerts_today,
        system_uptime,
        total_locations,
        timestamp
       FROM system_metrics 
       ORDER BY timestamp DESC 
       LIMIT 1`
    );

    if (metricsResult.rows.length > 0) {
      const metrics = metricsResult.rows[0];
      res.json({
        activeDevices: parseInt(metrics.active_devices || 0),
        todayAlerts: parseInt(metrics.alerts_today || 0),
        systemUptime: `${parseFloat(metrics.system_uptime || 0).toFixed(1)}%`,
        totalLocations: parseInt(metrics.total_locations || 0)
      });
    } else {
      // Fallback: calculate from sensor_data_aggregated if system_metrics is empty
      const activeDevicesResult = await pool.query(
        `SELECT COUNT(DISTINCT m) as count 
         FROM sensor_data_aggregated 
         WHERE timestamp_window > NOW() - INTERVAL '24 hours'`
      );
      const activeDevices = parseInt(activeDevicesResult.rows[0]?.count || 0);

      const alertsResult = await pool.query(
        `SELECT COUNT(*) as count 
         FROM sensor_data_aggregated 
         WHERE alert_level >= 2 
         AND DATE(timestamp_window) = CURRENT_DATE`
      );
      const todayAlerts = parseInt(alertsResult.rows[0]?.count || 0);

      const totalDevicesResult = await pool.query(
        `SELECT COUNT(DISTINCT m) as count FROM sensor_data_aggregated`
      );
      const totalDevices = parseInt(totalDevicesResult.rows[0]?.count || 1);
      const uptimePercentage = totalDevices > 0 ? ((activeDevices / totalDevices) * 100).toFixed(1) : 0;

      // Get total locations from distinct 'a' column (location identifier)
      const locationsResult = await pool.query(
        `SELECT COUNT(DISTINCT a) as count FROM sensor_data_aggregated WHERE a IS NOT NULL`
      );
      const totalLocations = parseInt(locationsResult.rows[0]?.count || totalDevices);

      res.json({
        activeDevices,
        todayAlerts,
        systemUptime: `${uptimePercentage}%`,
        totalLocations
      });
    }
  } catch (err) {
    console.error("Error fetching dashboard stats:", err);
    res.status(500).json({ error: "Error fetching dashboard statistics" });
  }
});

// GET dashboard status
router.get("/dashboard/status", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Authentication required" });

  try {
    const pool = req.pool;

    // Get current alert level from sensor_data_aggregated (last hour)
    const statusResult = await pool.query(
      `SELECT MAX(alert_level) as max_level 
       FROM sensor_data_aggregated 
       WHERE timestamp_window > NOW() - INTERVAL '1 hour'`
    );
    const maxAlertLevel = parseInt(statusResult.rows[0]?.max_level || 0);

    let systemStatus = "Operational";
    if (maxAlertLevel >= 3) systemStatus = "Critical";
    else if (maxAlertLevel >= 2) systemStatus = "Warning";

    // Get most recent system_metrics timestamp (this is when ETL last ran)
    const metricsTimestampResult = await pool.query(
      `SELECT MAX(timestamp) as last_update 
       FROM system_metrics`
    );
    let lastUpdate = metricsTimestampResult.rows[0]?.last_update;

    // Fallback to sensor_data_aggregated if system_metrics is empty
    if (!lastUpdate) {
      const lastUpdateResult = await pool.query(
        `SELECT MAX(timestamp_window) as last_update 
         FROM sensor_data_aggregated
         WHERE timestamp_window > NOW() - INTERVAL '24 hours'`
      );
      lastUpdate = lastUpdateResult.rows[0]?.last_update || new Date();
    }

    // Get responding devices (devices with data in last 10 minutes)
    const respondingDevicesResult = await pool.query(
      `SELECT COUNT(DISTINCT m) as count 
       FROM sensor_data_aggregated 
       WHERE timestamp_window > NOW() - INTERVAL '10 minutes'`
    );
    const respondingDevices = parseInt(respondingDevicesResult.rows[0]?.count || 0);

    const lastUpdateTime = new Date(lastUpdate);
    const now = new Date();
    const diffMinutes = Math.floor((now - lastUpdateTime) / (1000 * 60));
    const timeAgo = diffMinutes < 1 ? "Just now" : `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;

    // Derive a friendlier status when no devices are currently reporting
    if (respondingDevices === 0) {
      if (diffMinutes > 15) {
        systemStatus = "No Live Data";
      } else if (systemStatus === "Operational") {
        systemStatus = "Monitoring";
      }
    }

    // Determine activity details based on system status and responding devices
    let activityDetails;
    if (respondingDevices === 0) {
      if (diffMinutes > 15) {
        activityDetails = "No devices have reported data recently";
      } else {
        activityDetails = "Waiting for devices to send their next updates";
      }
    } else if (systemStatus === "Operational") {
      activityDetails = `All ${respondingDevices} devices responding normally`;
    } else if (systemStatus === "Warning") {
      activityDetails = `${respondingDevices} devices responding, some with warnings`;
    } else {
      activityDetails = `${respondingDevices} devices responding, critical alerts detected`;
    }

    res.json({
      systemStatus,
      lastUpdate: timeAgo,
      lastUpdateTimestamp: lastUpdate,
      respondingDevices,
      recentActivity: `System check completed at ${lastUpdateTime.toLocaleTimeString()}`,
      activityDetails
    });
  } catch (err) {
    console.error("Error fetching dashboard status:", err);
    res.status(500).json({ error: "Error fetching dashboard status" });
  }
});

// ====== DEVICE STATISTICS ======
router.get("/devices/stats", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Authentication required" });

  try {
    const pool = req.pool;

    // Get online devices (devices with data in last 10 minutes)
    const onlineResult = await pool.query(
      `SELECT COUNT(DISTINCT m) as count 
       FROM sensor_data_aggregated 
       WHERE timestamp_window > NOW() - INTERVAL '10 minutes'`
    );
    const onlineDevices = parseInt(onlineResult.rows[0]?.count || 0);

    // Get total devices (all devices that have ever reported)
    const totalResult = await pool.query(
      `SELECT COUNT(DISTINCT m) as count FROM sensor_data_aggregated`
    );
    const totalDevices = parseInt(totalResult.rows[0]?.count || 0);
    const offlineDevices = totalDevices - onlineDevices;

    // Get devices with warnings (alert_level > 0 in last hour)
    const warningResult = await pool.query(
      `SELECT COUNT(DISTINCT m) as count 
       FROM sensor_data_aggregated 
       WHERE alert_level >= 2 
       AND timestamp_window > NOW() - INTERVAL '1 hour'`
    );
    const warningStatus = parseInt(warningResult.rows[0]?.count || 0);

    // Get total locations from system_metrics (populated by ETL)
    const metricsResult = await pool.query(
      `SELECT total_locations 
       FROM system_metrics 
       ORDER BY timestamp DESC 
       LIMIT 1`
    );
    
    let totalLocations;
    if (metricsResult.rows.length > 0 && metricsResult.rows[0].total_locations) {
      totalLocations = parseInt(metricsResult.rows[0].total_locations || 0);
    } else {
      // Fallback: get distinct locations from 'a' column in sensor_data_aggregated
      const locationsResult = await pool.query(
        `SELECT COUNT(DISTINCT a) as count 
         FROM sensor_data_aggregated 
         WHERE a IS NOT NULL`
      );
      totalLocations = parseInt(locationsResult.rows[0]?.count || totalDevices);
    }

    res.json({
      onlineDevices,
      offlineDevices,
      warningStatus,
      totalLocations
    });
  } catch (err) {
    console.error("Error fetching device stats:", err);
    res.status(500).json({ error: "Error fetching device statistics" });
  }
});

// ====== INCIDENTS ======
// Pending incidents are based on ETL-filtered alerts from incident_alerts,
// which already apply consistency and deduplication logic.
router.get("/incidents", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Authentication required" });

  try {
    const pool = req.pool;
    const { type = "all", device, startDate, endDate, limit = 100 } = req.query;

    let pendingIncidents = [];
    let verifiedIncidents = [];

    if (type === "all" || type === "pending") {
      let pendingQuery = `
        SELECT
          ia.m AS device_id,
          ia.time AS timestamp,
          ia.alert_level,
          ia.fb AS flame_value,
          ia.sb AS smoke_value,
          ia.tb AS temp_value
        FROM incident_alerts ia
        WHERE ia.alert_level >= 2
          AND NOT EXISTS (
            SELECT 1
            FROM verified_incidents vi
            WHERE vi.device_id = ia.m
              AND ABS(EXTRACT(EPOCH FROM (vi.timestamp - ia.time))) < 3600
          )
      `;

      const pendingParams = [];
      let paramIndex = 1;

      if (device) {
        pendingQuery += ` AND ia.m = $${paramIndex}`;
        pendingParams.push(device);
        paramIndex++;
      }
      if (startDate) {
        pendingQuery += ` AND ia.time >= $${paramIndex}`;
        pendingParams.push(startDate);
        paramIndex++;
      }
      if (endDate) {
        pendingQuery += ` AND ia.time <= $${paramIndex}`;
        pendingParams.push(endDate);
        paramIndex++;
      }

      pendingQuery += ` ORDER BY ia.time DESC LIMIT $${paramIndex}`;
      pendingParams.push(parseInt(limit));

      try {
        const pendingResult = await pool.query(pendingQuery, pendingParams);
        pendingIncidents = pendingResult.rows;
      } catch (pendingErr) {
        // If incident_alerts table doesn't exist yet, just log and return empty list
        console.error("Error fetching pending incidents (incident_alerts):", pendingErr);
        pendingIncidents = [];
      }
    }

    if (type === "all" || type === "verified") {
      let verifiedQuery = `
        SELECT 
          vi.*,
          u.username as verified_by_username
        FROM verified_incidents vi
        LEFT JOIN users u ON vi.verified_by = u.id
        WHERE 1=1
      `;
      const verifiedParams = [];
      let paramCount = 1;

      if (device) {
        verifiedQuery += ` AND vi.device_id = $${paramCount}`;
        verifiedParams.push(device);
        paramCount++;
      }
      if (startDate) {
        verifiedQuery += ` AND vi.timestamp >= $${paramCount}`;
        verifiedParams.push(startDate);
        paramCount++;
      }
      if (endDate) {
        verifiedQuery += ` AND vi.timestamp <= $${paramCount}`;
        verifiedParams.push(endDate);
        paramCount++;
      }

      verifiedQuery += ` ORDER BY vi.verified_at DESC LIMIT $${paramCount}`;
      verifiedParams.push(parseInt(limit));

      try {
        const verifiedResult = await pool.query(verifiedQuery, verifiedParams);
        verifiedIncidents = verifiedResult.rows;
      } catch (verifiedErr) {
        console.error("Error fetching verified incidents:", verifiedErr);
        verifiedIncidents = [];
      }
    }

    res.json({
      pending: pendingIncidents,
      verified: verifiedIncidents,
    });
  } catch (err) {
    console.error("Error fetching incidents (outer):", err);
    res.status(500).json({ error: "Error fetching incidents" });
  }
});

// POST verify incident
router.post("/incidents/verify", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: "Admin access required" });

  const { device_id, timestamp, alert_level, flame_value, smoke_value, temp_value, notes } = req.body;

  if (!device_id || !timestamp || alert_level === undefined) {
    return res.status(400).json({ error: "Device ID, timestamp, and alert level are required" });
  }

  try {
    const result = await req.pool.query(
      `INSERT INTO verified_incidents 
       (device_id, timestamp, alert_level, flame_value, smoke_value, temp_value, verified_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [device_id, timestamp, alert_level, flame_value || null, smoke_value || null, temp_value || null, req.session.user.id, notes || null]
    );

    res.json({ success: true, incident: result.rows[0] });
  } catch (err) {
    console.error("Error verifying incident:", err);
    res.status(500).json({ error: "Error verifying incident" });
  }
});

// ====== USER APPROVAL SYSTEM ======
router.get("/users/pending", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: "Admin access required" });

  try {
    const result = await req.pool.query(
      "SELECT id, username, email, role, created_at, status FROM users WHERE status = 'pending' ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching pending users:", err);
    res.status(500).json({ error: "Error fetching pending users" });
  }
});

router.post("/users/approve", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: "Admin access required" });

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "User ID is required" });

  try {
    const result = await req.pool.query(
      "UPDATE users SET status = 'approved' WHERE id = $1 RETURNING id, username, email, role, status",
      [userId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error("Error approving user:", err);
    res.status(500).json({ error: "Error approving user" });
  }
});

router.post("/users/reject", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: "Admin access required" });

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "User ID is required" });

  try {
    const result = await req.pool.query(
      "UPDATE users SET status = 'rejected' WHERE id = $1 RETURNING id, username, email, role, status",
      [userId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error("Error rejecting user:", err);
    res.status(500).json({ error: "Error rejecting user" });
  }
});

// ====== HOURLY CHART DATA ======
router.get("/analytics/hourly", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Authentication required" });

  try {
    const pool = req.pool;
    const { device, startDate, endDate } = req.query;

    // Use main aggregated table sensor_data_aggregated
    let query = `SELECT m, timestamp_window, fa, fb, ga, gb, sa, sb, ta, tb, la, lo, alert_level FROM sensor_data_aggregated WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    if (device) {
      query += ` AND m = $${paramIndex}`;
      params.push(device);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND timestamp_window >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND timestamp_window <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    // Limit to last 24 hours if no date range specified
    if (!startDate && !endDate) {
      query += ` AND timestamp_window >= NOW() - INTERVAL '24 hours'`;
    }

    // Order by ASC for chronological display in charts
    query += ` ORDER BY timestamp_window ASC LIMIT 500`;

    const result = await pool.query(query, params);

    // Return in same format as other analytics endpoints
    res.json({
      success: true,
      range: 'hourly',
      view: 'sensor_data_aggregated',
      rows: result.rows
    });
  } catch (err) {
    console.error("Error fetching hourly analytics:", err);
    res.status(500).json({ error: "Error fetching hourly chart data" });
  }
});

// ====== OFFICIAL INCIDENTS (BFP Export System) ======

// POST create official incident record
router.post("/official-incidents", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Authentication required" });

  const {
    verified_incident_id,
    device_id,
    incident_timestamp,
    alert_level,
    flame_value,
    smoke_value,
    temp_value,
    incident_type,
    barangay,
    city,
    establishment_type,
    probable_cause,
    estimated_damage,
    responding_units,
    casualties_injured,
    casualties_fatalities,
    narrative_remarks
  } = req.body;

  if (!verified_incident_id || !device_id || !incident_timestamp || !incident_type || !barangay || !city) {
    return res.status(400).json({ error: "Verified incident ID, device ID, timestamp, incident type, barangay, and city are required" });
  }

  try {
    // Get verified incident to get verified_by and verified_at
    const verifiedIncident = await req.pool.query(
      "SELECT verified_by, verified_at FROM verified_incidents WHERE id = $1",
      [verified_incident_id]
    );

    if (verifiedIncident.rows.length === 0) {
      return res.status(404).json({ error: "Verified incident not found" });
    }

    const result = await req.pool.query(
      `INSERT INTO official_incidents 
       (verified_incident_id, device_id, incident_timestamp, alert_level, flame_value, smoke_value, temp_value,
        incident_type, barangay, city, establishment_type, probable_cause, estimated_damage, responding_units,
        casualties_injured, casualties_fatalities, narrative_remarks, verified_by, verified_at, generated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       RETURNING *`,
      [
        verified_incident_id, device_id, incident_timestamp, alert_level,
        flame_value || null, smoke_value || null, temp_value || null,
        incident_type, barangay, city, establishment_type || null,
        probable_cause || null, estimated_damage || null, responding_units || null,
        casualties_injured || 0, casualties_fatalities || 0, narrative_remarks || null,
        verifiedIncident.rows[0].verified_by, verifiedIncident.rows[0].verified_at,
        req.session.user.id
      ]
    );

    res.json({ success: true, record: result.rows[0] });
  } catch (err) {
    console.error("Error creating official incident:", err);
    res.status(500).json({ error: "Error creating official incident record" });
  }
});

// GET official incidents
router.get("/official-incidents", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Authentication required" });

  try {
    const pool = req.pool;
    const { startDate, endDate, limit = 100 } = req.query;

    let query = `
      SELECT 
        oi.*,
        u1.username as verified_by_username,
        u2.username as generated_by_username
      FROM official_incidents oi
      LEFT JOIN users u1 ON oi.verified_by = u1.id
      LEFT JOIN users u2 ON oi.generated_by = u2.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (startDate) {
      query += ` AND oi.incident_timestamp >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      query += ` AND oi.incident_timestamp <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }

    query += ` ORDER BY oi.generated_at DESC LIMIT $${paramCount}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    res.json({ success: true, records: result.rows });
  } catch (err) {
    console.error("Error fetching official incidents:", err);
    res.status(500).json({ error: "Error fetching official incidents" });
  }
});

// GET export official incidents (CSV/Excel)
router.get("/official-incidents/export", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Authentication required" });

  try {
    const pool = req.pool;
    const format = req.query.format || 'csv';
    const { startDate, endDate } = req.query;

    let query = `
      SELECT 
        oi.id as "Incident ID",
        oi.device_id as "Device ID",
        oi.incident_timestamp as "Incident Time",
        oi.alert_level as "Alert Level",
        oi.flame_value as "Flame Value",
        oi.smoke_value as "Smoke Value",
        oi.temp_value as "Temperature",
        oi.incident_type as "Incident Type",
        oi.barangay as "Barangay",
        oi.city as "City",
        oi.establishment_type as "Establishment Type",
        oi.probable_cause as "Probable Cause",
        oi.estimated_damage as "Estimated Damage",
        oi.responding_units as "Responding Units",
        oi.casualties_injured as "Casualties Injured",
        oi.casualties_fatalities as "Casualties Fatalities",
        oi.narrative_remarks as "Narrative Remarks",
        u1.username as "Verified By",
        oi.verified_at as "Verified At",
        u2.username as "Generated By",
        oi.generated_at as "Generated At"
      FROM official_incidents oi
      LEFT JOIN users u1 ON oi.verified_by = u1.id
      LEFT JOIN users u2 ON oi.generated_by = u2.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (startDate) {
      query += ` AND oi.incident_timestamp >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      query += ` AND oi.incident_timestamp <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }

    query += ` ORDER BY oi.generated_at DESC`;

    const result = await pool.query(query, params);

    // Handle empty result
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: "No official incident records found to export" });
    }

    if (format === 'csv') {
      // Generate CSV
      const headers = Object.keys(result.rows[0] || {});
      const csvRows = [
        headers.join(','),
        ...result.rows.map(row => 
          headers.map(header => {
            const value = row[header];
            if (value === null || value === undefined) return '';
            const stringValue = String(value);
            // Escape commas and quotes
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          }).join(',')
        )
      ];

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="fire_incidents_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvRows.join('\n'));
    } else if (format === 'excel') {
      // For Excel, we'll return CSV with Excel MIME type (simple approach)
      // For full Excel support, you'd need a library like exceljs
      const headers = Object.keys(result.rows[0]);
      const csvRows = [
        headers.join(','),
        ...result.rows.map(row => 
          headers.map(header => {
            const value = row[header];
            if (value === null || value === undefined) return '';
            const stringValue = String(value);
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          }).join(',')
        )
      ];

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="fire_incidents_${new Date().toISOString().split('T')[0]}.xlsx"`);
      res.send(csvRows.join('\n'));
    } else {
      res.status(400).json({ error: "Invalid format. Use 'csv' or 'excel'" });
    }
  } catch (err) {
    console.error("Error exporting official incidents:", err);
    res.status(500).json({ error: "Error exporting official incidents" });
  }
});

// ===== EXPORT ROUTER =====
module.exports = router;

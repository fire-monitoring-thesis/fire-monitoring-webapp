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

    const activeDevicesResult = await pool.query(
      `SELECT COUNT(DISTINCT m) as count 
       FROM sensor_data_aggregated 
       WHERE timestamp_window > NOW() - INTERVAL '10 minutes'`
    );
    const activeDevices = parseInt(activeDevicesResult.rows[0]?.count || 0);

    const alertsResult = await pool.query(
      `SELECT COUNT(*) as count 
       FROM sensor_data_daily 
       WHERE max_alert_level > 0 
       AND DATE(timestamp_window) = CURRENT_DATE`
    );
    const todayAlerts = parseInt(alertsResult.rows[0]?.count || 0);

    // Get total devices (all devices that have ever reported, not just active)
    const totalDevicesResult = await pool.query(
      `SELECT COUNT(DISTINCT m) as count FROM sensor_data_aggregated`
    );
    const totalDevices = parseInt(totalDevicesResult.rows[0]?.count || 1);
    const uptimePercentage = totalDevices > 0 ? ((activeDevices / totalDevices) * 100).toFixed(1) : 0;

    // Total locations = total devices (assuming each device is at a unique location)
    // If your system has multiple devices per location, you'd need a separate locations table
    const totalLocations = totalDevices;

    res.json({
      activeDevices,
      todayAlerts,
      systemUptime: `${uptimePercentage}%`,
      totalLocations
    });
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

    const statusResult = await pool.query(
      `SELECT MAX(max_alert_level) as max_level 
       FROM sensor_data_hourly 
       WHERE timestamp_window > NOW() - INTERVAL '1 hour'`
    );
    const maxAlertLevel = parseInt(statusResult.rows[0]?.max_level || 0);

    let systemStatus = "Operational";
    if (maxAlertLevel >= 3) systemStatus = "Critical";
    else if (maxAlertLevel > 0) systemStatus = "Warning";

    // Get most recent update from last 24 hours to avoid stale data
    const lastUpdateResult = await pool.query(
      `SELECT MAX(timestamp_window) as last_update 
       FROM sensor_data_hourly
       WHERE timestamp_window > NOW() - INTERVAL '24 hours'`
    );
    const lastUpdate = lastUpdateResult.rows[0]?.last_update || new Date();

    const respondingDevicesResult = await pool.query(
      `SELECT COUNT(DISTINCT m) as count 
       FROM sensor_data_hourly 
       WHERE timestamp_window > NOW() - INTERVAL '10 minutes'`
    );
    const respondingDevices = parseInt(respondingDevicesResult.rows[0]?.count || 0);

    const lastUpdateTime = new Date(lastUpdate);
    const now = new Date();
    const diffMinutes = Math.floor((now - lastUpdateTime) / (1000 * 60));
    const timeAgo = diffMinutes < 1 ? "Just now" : `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;

    // Determine activity details based on system status
    let activityDetails;
    if (systemStatus === 'Operational') {
      activityDetails = `All ${respondingDevices} devices responding normally`;
    } else if (systemStatus === 'Warning') {
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

    const onlineResult = await pool.query(
      `SELECT COUNT(DISTINCT m) as count 
       FROM sensor_data_hourly 
       WHERE timestamp_window > NOW() - INTERVAL '10 minutes'`
    );
    const onlineDevices = parseInt(onlineResult.rows[0]?.count || 0);

    const totalResult = await pool.query(
      `SELECT COUNT(DISTINCT m) as count FROM sensor_data_aggregated`
    );
    const totalDevices = parseInt(totalResult.rows[0]?.count || 0);
    const offlineDevices = totalDevices - onlineDevices;

    const warningResult = await pool.query(
      `SELECT COUNT(DISTINCT m) as count 
       FROM sensor_data_hourly 
       WHERE max_alert_level > 0 
       AND timestamp_window > NOW() - INTERVAL '1 hour'`
    );
    const warningStatus = parseInt(warningResult.rows[0]?.count || 0);

    // Total locations = total devices (assuming each device is at a unique location)
    const totalLocations = totalDevices;

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
router.get("/incidents", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Authentication required" });

  try {
    const pool = req.pool;
    const { type = 'all', device, startDate, endDate, limit = 100 } = req.query;

    let pendingIncidents = [];
    let verifiedIncidents = [];

    if (type === 'all' || type === 'pending') {
      let pendingQuery = `
        SELECT 
          m as device_id,
          timestamp_window as timestamp,
          max_alert_level as alert_level,
          avg_fa as flame_value,
          avg_sa as smoke_value,
          avg_ta as temp_value
        FROM sensor_data_hourly
        WHERE max_alert_level > 0
        AND NOT EXISTS (
          SELECT 1 FROM verified_incidents vi
          WHERE vi.device_id = sensor_data_hourly.m
          AND ABS(EXTRACT(EPOCH FROM (vi.timestamp - sensor_data_hourly.timestamp_window))) < 3600
        )
      `;
      const pendingParams = [];
      let paramCount = 1;

      if (device) {
        pendingQuery += ` AND m = $${paramCount}`;
        pendingParams.push(device);
        paramCount++;
      }
      if (startDate) {
        pendingQuery += ` AND timestamp_window >= $${paramCount}`;
        pendingParams.push(startDate);
        paramCount++;
      }
      if (endDate) {
        pendingQuery += ` AND timestamp_window <= $${paramCount}`;
        pendingParams.push(endDate);
        paramCount++;
      }

      pendingQuery += ` ORDER BY timestamp_window DESC LIMIT $${paramCount}`;
      pendingParams.push(parseInt(limit));

      const pendingResult = await pool.query(pendingQuery, pendingParams);
      pendingIncidents = pendingResult.rows;
    }

    if (type === 'all' || type === 'verified') {
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

      const verifiedResult = await pool.query(verifiedQuery, verifiedParams);
      verifiedIncidents = verifiedResult.rows;
    }

    res.json({
      pending: pendingIncidents,
      verified: verifiedIncidents
    });
  } catch (err) {
    console.error("Error fetching incidents:", err);
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

    // Use materialized view sensor_data_hourly for consistency
    let query = `SELECT * FROM sensor_data_hourly WHERE 1=1`;
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
      view: 'sensor_data_hourly',
      rows: result.rows
    });
  } catch (err) {
    console.error("Error fetching hourly analytics:", err);
    res.status(500).json({ error: "Error fetching hourly chart data" });
  }
});

// ===== EXPORT ROUTER =====
module.exports = router;

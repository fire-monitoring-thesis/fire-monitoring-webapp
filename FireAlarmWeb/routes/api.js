// ===== IMPORTS & SETUP =====
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");

// ==========================================
// 1. USER MANAGEMENT ENDPOINTS
// ==========================================

// GET all users (admin only)
router.get("/users", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: "Admin access required" });
  }
  try {
    const result = await req.pool.query(
      "SELECT id, username, email, role, created_at, status FROM users ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Error fetching users" });
  }
});

// ADD a new user
router.post("/users", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: "Admin access required" });
  }
  const { username, email, password, role } = req.body;
  if (!username || !email || !password || !role) return res.status(400).json({ error: "All fields required" });

  try {
    const existing = await req.pool.query("SELECT id FROM users WHERE username = $1 OR email = $2", [username, email]);
    if (existing.rows.length > 0) return res.status(400).json({ error: "User already exists" });

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

// UPDATE a user
router.put("/users/:id", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: "Admin access required" });
  const { id } = req.params;
  const { username, email, password, role } = req.body;

  try {
    const existing = await req.pool.query("SELECT id FROM users WHERE (username = $1 OR email = $2) AND id != $3", [username, email, id]);
    if (existing.rows.length > 0) return res.status(400).json({ error: "Username/Email taken" });

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
    if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ error: "Error updating user" });
  }
});

// DELETE a user
router.delete("/users/:id", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: "Admin access required" });
  const { id } = req.params;
  if (parseInt(id) === req.session.user.id) return res.status(400).json({ error: "Cannot delete self" });

  try {
    await req.pool.query("DELETE FROM users WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ error: "Error deleting user" });
  }
});

// VERIFY ADMIN
router.post("/verify-admin", async (req, res) => {
  const { adminEmail, adminPassword } = req.body;
  try {
    const result = await req.pool.query("SELECT * FROM users WHERE email = $1 AND role = 'admin'", [adminEmail]);
    const admin = result.rows[0];
    if (admin && (await bcrypt.compare(adminPassword, admin.password))) {
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    res.status(500).json({ error: "Verification failed" });
  }
});

// ==========================================
// 2. DASHBOARD STATISTICS
// ==========================================

// DASHBOARD NUMBERS
router.get("/dashboard/stats", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Authentication required" });
  try {
    // Priority: Fetch from system_metrics (Heartbeat table)
    const metricsResult = await req.pool.query(
      `SELECT active_devices, alerts_today, system_uptime, total_locations 
       FROM system_metrics ORDER BY timestamp DESC LIMIT 1`
    );

    let stats = { activeDevices: 0, todayAlerts: 0, systemUptime: "100.0%", totalLocations: 0 };

    if (metricsResult.rows.length > 0) {
      const m = metricsResult.rows[0];
      stats.activeDevices = parseInt(m.active_devices || 0);
      stats.todayAlerts = parseInt(m.alerts_today || 0);
      stats.systemUptime = `${parseFloat(m.system_uptime || 100).toFixed(1)}%`;
      stats.totalLocations = parseInt(m.total_locations || 0);
    } else {
      // Fallback
      const fallbackActive = await req.pool.query(`SELECT COUNT(DISTINCT m) as count FROM sensor_data_aggregated WHERE timestamp_window > NOW() - INTERVAL '24 hours'`);
      stats.activeDevices = parseInt(fallbackActive.rows[0]?.count || 0);
    }
    res.json(stats);
  } catch (err) {
    console.error("Error stats:", err);
    res.status(500).json({ error: "Error fetching stats" });
  }
});

// DASHBOARD STATUS (The logic for "Operational", "No Live Data", etc.)
router.get("/dashboard/status", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Authentication required" });
  try {
    // 1. Check Ongoing Fires
    const incidentRes = await req.pool.query(
      `SELECT MAX(alert_level) as max_level, COUNT(DISTINCT m) as device_count
       FROM incident_alerts WHERE last_seen > NOW() - INTERVAL '20 minutes' AND alert_level >= 2`
    );
    const maxLvl = parseInt(incidentRes.rows[0]?.max_level || 0);
    const alertDevs = parseInt(incidentRes.rows[0]?.device_count || 0);

    // 2. Default Status
    let status = "Operational";
    if (maxLvl >= 3) status = "Critical";
    else if (maxLvl >= 2) status = "Warning";

    // 3. Check Freshness & Idle State
    const metricRes = await req.pool.query(`SELECT active_devices, timestamp FROM system_metrics ORDER BY timestamp DESC LIMIT 1`);
    const lastUpdate = metricRes.rows[0]?.timestamp || new Date();
    const activeDevs = parseInt(metricRes.rows[0]?.active_devices || 0);
    
    const diffMins = Math.floor((new Date() - new Date(lastUpdate)) / 60000);

    if (diffMins > 15) status = "No Live Data";
    else if (activeDevs === 0 && status === "Operational") status = "Monitoring (Idle)";

    res.json({
      systemStatus: status,
      lastUpdateTimestamp: lastUpdate,
      alertingDevices: alertDevs,
      respondingDevices: activeDevs
    });
  } catch (err) {
    console.error("Error status:", err);
    res.status(500).json({ error: "Error fetching status" });
  }
});

// DEVICE STATS
router.get("/devices/stats", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Authentication required" });
  try {
    const metricRes = await req.pool.query(`SELECT active_devices, total_locations FROM system_metrics ORDER BY timestamp DESC LIMIT 1`);
    const online = parseInt(metricRes.rows[0]?.active_devices || 0);
    const locs = parseInt(metricRes.rows[0]?.total_locations || 0);

    const totalRes = await req.pool.query(`SELECT COUNT(DISTINCT m) as count FROM sensor_data_aggregated`);
    const total = parseInt(totalRes.rows[0]?.count || 0);
    
    res.json({ onlineDevices: online, offlineDevices: Math.max(0, total - online), totalLocations: locs });
  } catch (err) {
    res.status(500).json({ error: "Device stats error" });
  }
});

// ==========================================
// 3. SYSTEM ANALYTICS ENDPOINTS (NEW)
// ==========================================

// A. 24-HOUR STATUS TIMELINE (Battery-Style Chart)
router.get("/analytics/hourly", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Authentication required" });

  try {
    const pool = req.pool;
    const { startDate, endDate } = req.query;

    const query = `
      SELECT 
        timestamp as timestamp_window, 
        status_level as alert_level 
      FROM system_metrics 
      WHERE timestamp >= $1::timestamp 
        AND timestamp <= $2::timestamp
      ORDER BY timestamp ASC
    `;

    const start = startDate ? `${startDate} 00:00:00` : 'NOW() - INTERVAL \'24 hours\'';
    const end = endDate ? `${endDate} 23:59:59` : 'NOW()';

    const result = await pool.query(query, [start, end]);
    res.json({ success: true, rows: result.rows });
  } catch (err) {
    console.error("Error fetching status timeline:", err);
    res.status(500).json({ error: "Error fetching status timeline" });
  }
});

// B. 30-DAY PERFORMANCE TRENDS (Active Devices & Uptime)
router.get("/analytics/performance", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Authentication required" });

  try {
    const pool = req.pool;
    const { days = 30 } = req.query; 

    const query = `
      SELECT 
        DATE(timestamp) as date, 
        AVG(system_uptime) as uptime, 
        MAX(active_devices) as "activeDevices"
      FROM system_metrics 
      WHERE timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE(timestamp)
      ORDER BY DATE(timestamp) ASC
    `;

    const result = await pool.query(query);
    res.json({ history: result.rows });
  } catch (err) {
    console.error("Error fetching performance history:", err);
    res.status(500).json({ error: "Error fetching performance history" });
  }
});

// ==========================================
// 4. INCIDENTS & APPROVALS (Standard)
// ==========================================

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
          ia.started_at AS timestamp,
          ia.last_seen,
          ia.alert_level,
          GREATEST(ia.fa, ia.fb) AS flame_value,
          GREATEST(ia.sa, ia.sb) AS smoke_value,
          GREATEST(ia.ta, ia.tb) AS temp_value
        FROM incident_alerts ia
        WHERE ia.alert_level >= 2
          AND NOT EXISTS (
            SELECT 1 FROM verified_incidents vi
            WHERE vi.device_id = ia.m AND ABS(EXTRACT(EPOCH FROM (vi.timestamp - ia.started_at))) < 3600
          )
      `;
      const pendingParams = [];
      let idx = 1;
      if (device) { pendingQuery += ` AND ia.m = $${idx++}`; pendingParams.push(device); }
      if (startDate) { pendingQuery += ` AND ia.started_at >= $${idx++}`; pendingParams.push(startDate); }
      if (endDate) { pendingQuery += ` AND ia.started_at <= $${idx++}`; pendingParams.push(endDate); }
      pendingQuery += ` ORDER BY ia.started_at DESC LIMIT $${idx}`;
      pendingParams.push(parseInt(limit));

      try {
        const res = await pool.query(pendingQuery, pendingParams);
        pendingIncidents = res.rows;
      } catch (e) { pendingIncidents = []; }
    }

    if (type === "all" || type === "verified") {
      let verifiedQuery = `
        SELECT vi.*, u.username as verified_by_username
        FROM verified_incidents vi
        LEFT JOIN users u ON vi.verified_by = u.id
        WHERE 1=1
      `;
      const verifiedParams = [];
      let idx = 1;
      if (device) { verifiedQuery += ` AND vi.device_id = $${idx++}`; verifiedParams.push(device); }
      if (startDate) { verifiedQuery += ` AND vi.timestamp >= $${idx++}`; verifiedParams.push(startDate); }
      if (endDate) { verifiedQuery += ` AND vi.timestamp <= $${idx++}`; verifiedParams.push(endDate); }
      verifiedQuery += ` ORDER BY vi.verified_at DESC LIMIT $${idx}`;
      verifiedParams.push(parseInt(limit));

      try {
        const res = await pool.query(verifiedQuery, verifiedParams);
        verifiedIncidents = res.rows;
      } catch (e) { verifiedIncidents = []; }
    }

    res.json({ pending: pendingIncidents, verified: verifiedIncidents });
  } catch (err) {
    res.status(500).json({ error: "Error fetching incidents" });
  }
});

router.post("/incidents/verify", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: "Admin access required" });
  const { device_id, timestamp, alert_level, flame_value, smoke_value, temp_value, notes } = req.body;
  if (!device_id || !timestamp || alert_level === undefined) return res.status(400).json({ error: "Fields required" });

  try {
    const result = await req.pool.query(
      `INSERT INTO verified_incidents (device_id, timestamp, alert_level, flame_value, smoke_value, temp_value, verified_by, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [device_id, timestamp, alert_level, flame_value, smoke_value, temp_value, req.session.user.id, notes]
    );
    res.json({ success: true, incident: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Error verifying incident" });
  }
});

// OFFICIAL INCIDENTS (BFP)
router.post("/official-incidents", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Auth required" });
  const { verified_incident_id, device_id, incident_timestamp, alert_level, flame_value, smoke_value, temp_value, incident_type, barangay, city, establishment_type, probable_cause, estimated_damage, responding_units, casualties_injured, casualties_fatalities, narrative_remarks } = req.body;

  try {
    const vRes = await req.pool.query("SELECT verified_by, verified_at FROM verified_incidents WHERE id = $1", [verified_incident_id]);
    if (vRes.rows.length === 0) return res.status(404).json({ error: "Verified incident not found" });

    const result = await req.pool.query(
      `INSERT INTO official_incidents 
       (verified_incident_id, device_id, incident_timestamp, alert_level, flame_value, smoke_value, temp_value, incident_type, barangay, city, establishment_type, probable_cause, estimated_damage, responding_units, casualties_injured, casualties_fatalities, narrative_remarks, verified_by, verified_at, generated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING *`,
      [verified_incident_id, device_id, incident_timestamp, alert_level, flame_value, smoke_value, temp_value, incident_type, barangay, city, establishment_type, probable_cause, estimated_damage, responding_units, casualties_injured, casualties_fatalities, narrative_remarks, vRes.rows[0].verified_by, vRes.rows[0].verified_at, req.session.user.id]
    );
    res.json({ success: true, record: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Error creating official incident" });
  }
});

router.get("/official-incidents", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Auth required" });
  try {
    const { startDate, endDate, limit = 100 } = req.query;
    let query = `SELECT oi.*, u1.username as verified_by_username, u2.username as generated_by_username FROM official_incidents oi LEFT JOIN users u1 ON oi.verified_by = u1.id LEFT JOIN users u2 ON oi.generated_by = u2.id WHERE 1=1`;
    const params = [];
    let idx = 1;
    if (startDate) { query += ` AND oi.incident_timestamp >= $${idx++}`; params.push(startDate); }
    if (endDate) { query += ` AND oi.incident_timestamp <= $${idx++}`; params.push(endDate); }
    query += ` ORDER BY oi.generated_at DESC LIMIT $${idx}`;
    params.push(parseInt(limit));

    const result = await req.pool.query(query, params);
    res.json({ success: true, records: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Error fetching official incidents" });
  }
});

// EXPORT OFFICIAL INCIDENTS
router.get("/official-incidents/export", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Auth required" });
  try {
    const format = req.query.format || 'csv';
    const { startDate, endDate } = req.query;
    let query = `SELECT oi.id, oi.device_id, oi.incident_timestamp, oi.alert_level, oi.incident_type, oi.barangay, oi.city, oi.probable_cause FROM official_incidents oi WHERE 1=1`;
    const params = [];
    let idx = 1;
    if (startDate) { query += ` AND oi.incident_timestamp >= $${idx++}`; params.push(startDate); }
    if (endDate) { query += ` AND oi.incident_timestamp <= $${idx++}`; params.push(endDate); }
    query += ` ORDER BY oi.generated_at DESC`;

    const result = await req.pool.query(query, params);
    if (!result.rows.length) return res.status(404).json({ error: "No records" });

    const headers = Object.keys(result.rows[0]);
    const csvRows = [headers.join(','), ...result.rows.map(row => headers.map(h => `"${String(row[h]||'').replace(/"/g, '""')}"`).join(','))];
    
    if (format === 'excel') res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    else res.setHeader('Content-Type', 'text/csv');
    
    res.setHeader('Content-Disposition', `attachment; filename="incidents_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'csv'}"`);
    res.send(csvRows.join('\n'));
  } catch (err) {
    res.status(500).json({ error: "Export error" });
  }
});

// USER APPROVALS
router.get("/users/pending", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: "Admin only" });
  try {
    const result = await req.pool.query("SELECT id, username, email, role, created_at, status FROM users WHERE status = 'pending' ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: "Error pending users" }); }
});

router.post("/users/approve", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: "Admin only" });
  try {
    const result = await req.pool.query("UPDATE users SET status = 'approved' WHERE id = $1 RETURNING *", [req.body.userId]);
    res.json({ success: true, user: result.rows[0] });
  } catch (e) { res.status(500).json({ error: "Error approving" }); }
});

router.post("/users/reject", async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: "Admin only" });
  try {
    const result = await req.pool.query("UPDATE users SET status = 'rejected' WHERE id = $1 RETURNING *", [req.body.userId]);
    res.json({ success: true, user: result.rows[0] });
  } catch (e) { res.status(500).json({ error: "Error rejecting" }); }
});

module.exports = router;
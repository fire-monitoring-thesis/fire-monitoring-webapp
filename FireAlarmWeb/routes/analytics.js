const express = require('express');
const router = express.Router();

// Map time ranges to materialized views
const VIEW_MAP = {
    hourly: "sensor_data_hourly",
    daily: "sensor_data_daily",
    weekly: "sensor_data_weekly",
    monthly: "sensor_data_monthly",
    yearly: "sensor_data_yearly"
};

// GET analytics data
// /api/analytics?range=daily&m=081925BR98-1
router.get('/', async (req, res) => {
    const pool = req.pool;
    const range = req.query.range || 'daily';
    const deviceId = req.query.m;  // optional: filter by device

    const view = VIEW_MAP[range];
    if (!view) {
        return res.status(400).json({ error: "Invalid time range" });
    }

    let query = `SELECT * FROM ${view}`;
    let params = [];

    if (deviceId) {
        query += ` WHERE m = $1`;
        params.push(deviceId);
    }

    // Order by ASC for chronological display (frontend will sort if needed)
    query += ` ORDER BY timestamp_window ASC LIMIT 500`;

    try {
        const result = await pool.query(query, params);
        console.log(`Analytics query: ${view}, device: ${deviceId || 'all'}, rows: ${result.rows.length}`);
        return res.json({ range, view, rows: result.rows });
    } catch (err) {
        console.error("Analytics query error:", err);
        console.error("Query was:", query);
        console.error("Params were:", params);
        return res.status(500).json({ error: err.message });
    }
});

// GET distinct devices for dropdown
// /api/analytics/devices
router.get('/devices', async (req, res) => {
    const pool = req.pool;
    try {
        // Try sensor_data_aggregated first, fallback to hourly view if it doesn't exist
        let result;
        try {
            result = await pool.query(`SELECT DISTINCT m FROM sensor_data_aggregated WHERE m IS NOT NULL ORDER BY m`);
        } catch (err) {
            // Fallback to hourly view if aggregated doesn't exist
            console.warn("sensor_data_aggregated not found, using sensor_data_hourly");
            result = await pool.query(`SELECT DISTINCT m FROM sensor_data_hourly WHERE m IS NOT NULL ORDER BY m`);
        }
        
        return res.json({ devices: result.rows });
    } catch (err) {
        console.error("Error fetching devices:", err);
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;

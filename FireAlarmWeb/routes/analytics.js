const express = require('express');
const router = express.Router();

// GET analytics data
// /api/analytics?m=081925BR98-1&start=2025-11-01&end=2025-11-20
router.get('/', async (req, res) => {
    const pool = req.pool;
    const deviceId = req.query.m;
    const start = req.query.start;
    const end = req.query.end;

    const params = [];
    const whereClauses = [];

    if (deviceId) {
        params.push(deviceId);
        whereClauses.push(`m = $${params.length}`);
    }
    if (start) {
        params.push(start);
        whereClauses.push(`timestamp_window >= $${params.length}::timestamptz`);
    }
    if (end) {
        params.push(end);
        whereClauses.push(`timestamp_window <= $${params.length}::timestamptz`);
    }

    const where = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const query = `
        SELECT m, timestamp_window, fa, fb, ga, gb, sa, sb, ta, tb, la, lo, alert_level
        FROM sensor_data_aggregated
        ${where}
        ORDER BY timestamp_window ASC
        LIMIT 500
    `;


    try {
        const result = await pool.query(query, params);
        console.log(`Analytics query rows: ${result.rows.length}`);
        res.json({ rows: result.rows });
    } catch (err) {
        console.error("Analytics query error:", err);
        return res.status(500).json({ error: err.message });
    }
});

// GET distinct devices for dropdown
router.get('/devices', async (req, res) => {
    const pool = req.pool;
    try {
        const result = await pool.query(`SELECT DISTINCT m FROM sensor_data_aggregated WHERE m IS NOT NULL ORDER BY m`);
        res.json({ devices: result.rows.map(r => r.m) });
    } catch (err) {
        console.error("Error fetching devices:", err);
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;

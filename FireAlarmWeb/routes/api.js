// ===== IMPORTS & SETUP =====
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");

// ====== USER MANAGEMENT ENDPOINTS ======

// ✅ GET all users (admin only)
router.get("/users", async (req, res) => {
  // Check if user is authenticated and is admin
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
  // Check if user is authenticated and is admin
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: "Admin access required" });
  }

  const { username, email, password, role } = req.body;

  // Validate required fields
  if (!username || !email || !password || !role) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    // Check if username or email already exists
    const existingUser = await req.pool.query(
      "SELECT id FROM users WHERE username = $1 OR email = $2",
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Username or email already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await req.pool.query(
      "INSERT INTO users (username, email, password, role, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, username, email, role, created_at",
      [username, email, hashed, role]
    );

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error("Error adding user:", err);
    res.status(500).json({ error: "Error adding user" });
  }
});

// ✅ UPDATE a user (admin only)
router.put("/users/:id", async (req, res) => {
  // Check if user is authenticated and is admin
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: "Admin access required" });
  }

  const { id } = req.params;
  const { username, email, password, role } = req.body;

  // Validate required fields
  if (!username || !email || !role) {
    return res.status(400).json({ error: "Username, email, and role are required" });
  }

  try {
    // Check if username or email already exists for other users
    const existingUser = await req.pool.query(
      "SELECT id FROM users WHERE (username = $1 OR email = $2) AND id != $3",
      [username, email, id]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Username or email already exists" });
    }

    let query, params;

    if (password && password.trim() !== '') {
      // Update with new password
      const hashed = await bcrypt.hash(password, 10);
      query = "UPDATE users SET username = $1, email = $2, password = $3, role = $4 WHERE id = $5 RETURNING id, username, email, role, created_at";
      params = [username, email, hashed, role, id];
    } else {
      // Update without changing password
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
  // Check if user is authenticated and is admin
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: "Admin access required" });
  }

  const { id } = req.params;

  try {
    // Prevent deleting the main admin user
    const userToDelete = await req.pool.query(
      "SELECT username, role FROM users WHERE id = $1",
      [id]
    );

    if (userToDelete.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent deleting yourself
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

// ✅ POST /verify-admin
// Used when a user attempts an admin-only action (e.g., role change, add user)
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

// ===== EXPORT ROUTER =====
module.exports = router;
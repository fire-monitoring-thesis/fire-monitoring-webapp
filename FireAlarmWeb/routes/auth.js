// 🔧 Dependencies and Setup
const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

// 🟩 ROUTE: POST /auth/signup
router.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  const pool = req.pool;

  try {
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.redirect('/signup.html?message=taken');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (username, email, password, is_active, created_at, role)
       VALUES ($1, $2, $3, $4, NOW(), $5)`,
      [username, email, hashedPassword, true, 'user']
    );

    return res.redirect('/login.html?message=signedup');
  } catch (err) {
    console.error('Signup error:', err);
    return res.redirect('/signup.html?message=server');
  }
});

// 🟦 ROUTE: POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const pool = req.pool;

  try {
    // Check if the input is an email or username
    const isEmail = email.includes('@');
    
    // Query based on whether input is email or username
    const result = await pool.query(
      isEmail 
        ? 'SELECT * FROM users WHERE email = $1'
        : 'SELECT * FROM users WHERE username = $1',
      [email]
    );

    if (
      result.rows.length === 0 ||
      !(await bcrypt.compare(password, result.rows[0].password))
    ) {
      return res.redirect('/login.html?message=invalid');
    }

    const user = result.rows[0];

    req.session.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role
    };

    return res.redirect('/protected/dashboard.html');
  } catch (err) {
    console.error('Login error:', err);
    return res.redirect('/login.html?message=server');
  }
});

// 🟥 ROUTE: POST /auth/logout  
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).send('Logout failed.');
    }
    res.clearCookie('connect.sid');
    return res.redirect('/login.html?message=logout');
  });
});

// 🟨 ROUTE: GET /auth/session
router.get('/session', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({
      username: req.session.user.username,
      email: req.session.user.email,
      role: req.session.user.role
    });
  } else {
    return res.status(401).json({ error: 'Not logged in' });
  }
});

// 🟦 ROUTE: GET /auth/current-user
router.get('/current-user', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({
      username: req.session.user.username,
    });
  } else {
    return res.status(401).json({ error: 'Not logged in' });
  }
});



// 📦 Export the router
module.exports = router;
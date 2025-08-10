const express = require('express');
const session = require('express-session');
const path = require('path');
const pg = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const messageRoutes = require('./routes/messages');

const { ensureAuthenticated } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'super-secret-key',
  resave: false,
  saveUninitialized: false
}));

// Attach pool to each request
app.use((req, res, next) => {
  req.pool = pool;
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/messages', messageRoutes);

app.use(express.static(path.join(__dirname, 'public')));

// Root route - redirect to login
app.get('/', (req, res) => {
  if (req.session && req.session.user) {
    res.redirect('/protected/dashboard.html');
  } else {
    res.redirect('/login.html');
  }
});

// Protect /protected pages
app.use('/protected', ensureAuthenticated);

app.get('/protected/:page', (req, res) => {
  const page = req.params.page;
  res.sendFile(path.join(__dirname, 'public/protected', page));
});

// Direct logout route for compatibility
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).send('Logout failed.');
    }
    res.clearCookie('connect.sid');
    return res.redirect('/login.html?message=logout');
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
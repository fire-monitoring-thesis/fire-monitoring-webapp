// -------------------------------
// Imports & Configuration
// -------------------------------
const express = require('express');
const session = require('express-session');
const path = require('path');
const pg = require('pg');
const dotenv = require('dotenv');

// Load environment variables (.env file)
dotenv.config();

// Route imports
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const messageRoutes = require('./routes/messages');
const { ensureAuthenticated } = require('./middleware/auth');

// -------------------------------
// Initialize Express App
// -------------------------------
const app = express();
const PORT = process.env.PORT || 8000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// -------------------------------
// PostgreSQL Connection
// -------------------------------
const isProduction = NODE_ENV === 'production';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction
    ? { rejectUnauthorized: false } // For cloud DBs (RDS, etc.)
    : false // Disable SSL for local or Docker internal network
});

// Test DB connection
pool.connect()
  .then(client => {
    console.log('✅ Connected to PostgreSQL database successfully');
    client.release();
  })
  .catch(err => {
    console.error('❌ PostgreSQL connection error:', err.message);
  });

// -------------------------------
// Middleware
// -------------------------------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'super-secret-key',  // ⚠️ replace with strong secret in prod
  resave: false,
  saveUninitialized: false
}));

// Attach DB pool to each request
app.use((req, res, next) => {
  req.pool = pool;
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------
// Routes
// -------------------------------
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/messages', messageRoutes);

// Root route - redirect based on session
app.get('/', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/protected/dashboard.html');
  }
  return res.redirect('/login.html');
});

// Protect /protected pages
app.use('/protected', ensureAuthenticated);

app.get('/protected/:page', (req, res) => {
  const page = req.params.page;
  const pagePath = path.join(__dirname, 'public/protected', page);
  res.sendFile(pagePath);
});

// Direct logout route
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

// -------------------------------
// Error Handling
// -------------------------------
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).send('Something went wrong!');
});

// -------------------------------
// Start Server
// -------------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT} (${NODE_ENV} mode)`);
});

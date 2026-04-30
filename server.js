// server.js  –  SK Cars Express Server
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { initDB } = require('./config/db');

const app  = express();
const PORT = process.env.PORT || 5000;

/* ─── MIDDLEWARE ─────────────────────────────────── */
app.use(cors({
  origin: true,   // allow all origins (change to specific domain in production)
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ─── STATIC FILES ───────────────────────────────── */
// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_DIR || 'uploads')));
// Serve frontend (public folder)
app.use(express.static(path.join(__dirname, 'public')));

/* ─── API ROUTES ─────────────────────────────────── */
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/cars',     require('./routes/cars'));
app.use('/api/bookings', require('./routes/bookings'));

/* ─── HEALTH CHECK ───────────────────────────────── */
app.get('/api/health', (req, res) =>
  res.json({ success: true, message: 'SK Cars API is running 🚗', timestamp: new Date() })
);

/* ─── FALLBACK: serve frontend for non-API routes ── */
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return;
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ─── GLOBAL ERROR HANDLER ───────────────────────── */
app.use((err, req, res, next) => {
  console.error('💥 Error:', err.message);
  if (err.code === 'LIMIT_FILE_SIZE')
    return res.status(400).json({ success: false, message: 'File too large (max 5MB)' });
  res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});

/* ─── START ──────────────────────────────────────── */
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n🚗  SK Cars API running at http://localhost:${PORT}`);
      console.log(`📁  Uploads served at   http://localhost:${PORT}/uploads`);
      console.log(`🔑  Admin login at       http://localhost:${PORT}/admin.html\n`);
    });
  })
  .catch(err => {
    console.error('❌  Failed to initialize database:', err.message);
    process.exit(1);
  });
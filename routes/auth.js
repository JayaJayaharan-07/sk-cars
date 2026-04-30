// routes/auth.js
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { pool } = require('../config/db');
require('dotenv').config();
 
const router = express.Router();
 
 
/* POST /api/auth/login */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('Login attempt:', username, '| password length:', password?.length);
 
  if (!username || !password)
    return res.status(400).json({ success: false, message: 'Username and password required' });
 
  try {
    const [rows] = await pool.query('SELECT * FROM admins WHERE username = ?', [username]);
    console.log('Admins found:', rows.length);
 
    if (rows.length === 0)
      return res.status(401).json({ success: false, message: 'Admin not found - visit /api/auth/reset-admin first' });
 
    const valid = await bcrypt.compare(password, rows[0].password);
    console.log('Password valid:', valid);
 
    if (!valid)
      return res.status(401).json({ success: false, message: 'Wrong password' });
 
    const token = jwt.sign(
      { id: rows[0].id, username: rows[0].username },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '8h' }
    );
 
    res.json({ success: true, token, username: rows[0].username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});
 
/* GET /api/auth/verify */
router.get('/verify', require('../middleware/auth'), (req, res) => {
  res.json({ success: true, admin: req.admin });
});
 
module.exports = router;
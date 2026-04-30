// routes/bookings.js  –  booking endpoints
const express  = require('express');
const { pool } = require('../config/db');
const auth     = require('../middleware/auth');

const router = express.Router();

/* POST /api/bookings  –  create booking (public) */
router.post('/', async (req, res) => {
  const { car_id, car_name, name, phone, city, note } = req.body;
  if (!car_id || !car_name || !name || !phone || !city)
    return res.status(400).json({ success: false, message: 'Required fields missing' });

  try {
    // Check car is available
    const [car] = await pool.query('SELECT id, sold FROM cars WHERE id=?', [car_id]);
    if (!car.length)   return res.status(404).json({ success: false, message: 'Car not found' });
    if (car[0].sold)   return res.status(400).json({ success: false, message: 'This car is already sold' });

    const [result] = await pool.query(
      'INSERT INTO bookings (car_id, car_name, name, phone, city, note) VALUES (?,?,?,?,?,?)',
      [car_id, car_name, name, phone, city, note || '']
    );
    res.status(201).json({ success: true, message: 'Booking successful', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* GET /api/bookings  –  list all (admin) */
router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM bookings ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* PATCH /api/bookings/:id/status  –  update status (admin) */
router.patch('/:id/status', auth, async (req, res) => {
  const { status } = req.body;
  if (!['pending', 'confirmed', 'cancelled'].includes(status))
    return res.status(400).json({ success: false, message: 'Invalid status' });

  try {
    await pool.query('UPDATE bookings SET status=? WHERE id=?', [status, req.params.id]);
    res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* DELETE /api/bookings/:id  –  delete booking (admin) */
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM bookings WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Booking deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

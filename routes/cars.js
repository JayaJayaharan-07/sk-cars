// routes/cars.js  –  public + admin car endpoints
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const { pool }  = require('../config/db');
const auth      = require('../middleware/auth');
const upload    = require('../config/multer');
require('dotenv').config();

const router  = express.Router();
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

/* ─── helper: attach images to car rows ─────────── */
async function attachImages(cars) {
  if (!cars.length) return cars;
  const ids = cars.map(c => c.id);
  const [imgs] = await pool.query(
    `SELECT * FROM car_images WHERE car_id IN (${ids.map(() => '?').join(',')}) ORDER BY is_primary DESC`,
    ids
  );
  return cars.map(car => ({
    ...car,
    images: imgs
      .filter(i => i.car_id === car.id)
      .map(i => ({
        id:         i.id,
        url:        i.filename.startsWith('http') ? i.filename : `${BASE_URL}/uploads/${i.filename}`,
        is_primary: i.is_primary
      }))
  }));
}

/* ════════════════════════════════════════════════
   PUBLIC ROUTES
════════════════════════════════════════════════ */

/* GET /api/cars  –  list all non-sold cars */
router.get('/', async (req, res) => {
  try {
    const { fuel, min, max, search } = req.query;
    let sql    = 'SELECT * FROM cars WHERE sold = 0';
    const args = [];

    if (fuel)   { sql += ' AND fuel = ?';                         args.push(fuel); }
    if (min)    { sql += ' AND price >= ?';                       args.push(+min); }
    if (max)    { sql += ' AND price <= ?';                       args.push(+max); }
    if (search) { sql += ' AND (name LIKE ? OR description LIKE ?)'; args.push(`%${search}%`, `%${search}%`); }

    sql += ' ORDER BY created_at DESC';
    const [rows] = await pool.query(sql, args);
    const cars   = await attachImages(rows);
    res.json({ success: true, data: cars });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* GET /api/cars/:id */
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM cars WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Car not found' });
    const [car] = await attachImages(rows);
    res.json({ success: true, data: car });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* ════════════════════════════════════════════════
   ADMIN ROUTES  (JWT protected)
════════════════════════════════════════════════ */

/* GET /api/cars/admin/all  –  all cars including sold */
router.get('/admin/all', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM cars ORDER BY created_at DESC');
    const cars   = await attachImages(rows);
    res.json({ success: true, data: cars });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* POST /api/cars  –  add new car + images */
router.post('/', auth, upload.array('images', 8), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { name, price, year, km, fuel, mileage, rating, reviews, badge, description } = req.body;

    if (!name || !price || !year || !km || !fuel || !mileage)
      return res.status(400).json({ success: false, message: 'Required fields missing' });

    const [result] = await conn.query(
      `INSERT INTO cars (name, price, year, km, fuel, mileage, rating, reviews, badge, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, price, year, km, fuel, mileage, rating || 4.5, reviews || 0, badge || '', description || '']
    );
    const carId = result.insertId;

    if (req.files && req.files.length) {
      for (let i = 0; i < req.files.length; i++) {
        // Cloudinary returns full URL in path, filename has public_id
        const imageUrl = req.files[i].path || req.files[i].filename;
        await conn.query(
          'INSERT INTO car_images (car_id, filename, is_primary) VALUES (?, ?, ?)',
          [carId, imageUrl, i === 0 ? 1 : 0]
        );
      }
    }

    await conn.commit();
    res.status(201).json({ success: true, message: 'Car added successfully', id: carId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    conn.release();
  }
});

/* PUT /api/cars/:id  –  update car details */
router.put('/:id', auth, upload.array('images', 8), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { name, price, year, km, fuel, mileage, rating, reviews, badge, description, sold } = req.body;

    await conn.query(
      `UPDATE cars SET name=?, price=?, year=?, km=?, fuel=?, mileage=?,
       rating=?, reviews=?, badge=?, description=?, sold=?, updated_at=NOW()
       WHERE id=?`,
      [name, price, year, km, fuel, mileage, rating, reviews, badge, description, sold || 0, req.params.id]
    );

    // Add new images if uploaded
    if (req.files && req.files.length) {
      const [existing] = await conn.query('SELECT id FROM car_images WHERE car_id=?', [req.params.id]);
      const isPrimary = existing.length === 0 ? 1 : 0;
      for (let i = 0; i < req.files.length; i++) {
        const imageUrl = req.files[i].path || req.files[i].filename;
        await conn.query(
          'INSERT INTO car_images (car_id, filename, is_primary) VALUES (?, ?, ?)',
          [req.params.id, imageUrl, i === 0 ? isPrimary : 0]
        );
      }
    }

    await conn.commit();
    res.json({ success: true, message: 'Car updated successfully' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    conn.release();
  }
});

/* PATCH /api/cars/:id/sold  –  mark as sold / unsold */
router.patch('/:id/sold', auth, async (req, res) => {
  try {
    const { sold } = req.body;
    await pool.query('UPDATE cars SET sold=? WHERE id=?', [sold ? 1 : 0, req.params.id]);
    res.json({ success: true, message: sold ? 'Car marked as sold' : 'Car restored to inventory' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/* DELETE /api/cars/:id  –  permanently remove car */
router.delete('/:id', auth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Delete physical image files
    const [imgs] = await conn.query('SELECT filename FROM car_images WHERE car_id=?', [req.params.id]);
    imgs.forEach(img => {
      const filePath = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads', img.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });

    await conn.query('DELETE FROM cars WHERE id=?', [req.params.id]);
    await conn.commit();
    res.json({ success: true, message: 'Car deleted permanently' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    conn.release();
  }
});

/* DELETE /api/cars/image/:imgId  –  remove single image */
router.delete('/image/:imgId', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM car_images WHERE id=?', [req.params.imgId]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Image not found' });

    const filePath = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads', rows[0].filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await pool.query('DELETE FROM car_images WHERE id=?', [req.params.imgId]);

    res.json({ success: true, message: 'Image deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

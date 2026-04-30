// config/db.js  –  MySQL connection pool + auto-schema setup
const mysql  = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = mysql.createPool({
  host:            process.env.DB_HOST     || 'localhost',
  port:            process.env.DB_PORT     || 3306,
  user:            process.env.DB_USER     || 'root',
  password:        process.env.DB_PASSWORD || '',
  database:        process.env.DB_NAME     || 'sk_cars',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit:      0,
});

/* ─── CREATE TABLES IF NOT EXIST ─────────────────── */
async function initDB() {
  const conn = await pool.getConnection();
  try {
    // ── Cars table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS cars (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        name        VARCHAR(150)  NOT NULL,
        price       DECIMAL(12,2) NOT NULL,
        year        YEAR          NOT NULL,
        km          VARCHAR(30)   NOT NULL,
        fuel        ENUM('Petrol','Diesel','CNG','Electric','Hybrid') NOT NULL,
        mileage     VARCHAR(20)   NOT NULL,
        rating      DECIMAL(2,1)  DEFAULT 4.5,
        reviews     INT           DEFAULT 0,
        badge       VARCHAR(50)   DEFAULT '',
        description TEXT,
        sold        TINYINT(1)    DEFAULT 0,
        created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // ── Car images table (one-to-many)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS car_images (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        car_id     INT         NOT NULL,
        filename   VARCHAR(255) NOT NULL,
        is_primary TINYINT(1)  DEFAULT 0,
        FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // ── Bookings table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        car_id     INT          NOT NULL,
        car_name   VARCHAR(150) NOT NULL,
        name       VARCHAR(100) NOT NULL,
        phone      VARCHAR(20)  NOT NULL,
        city       VARCHAR(100) NOT NULL,
        note       TEXT,
        status     ENUM('pending','confirmed','cancelled') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // ── Admins table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        username   VARCHAR(80)  NOT NULL UNIQUE,
        password   VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // ── Seed default admin if none exists
    const [rows] = await conn.query('SELECT id FROM admins LIMIT 1');
    if (rows.length === 0) {
      const hash = await bcrypt.hash(
        process.env.ADMIN_PASSWORD || 'Admin@123', 10
      );
      await conn.query(
        'INSERT INTO admins (username, password) VALUES (?, ?)',
        [process.env.ADMIN_USERNAME || 'admin', hash]
      );
      console.log('✅  Default admin created → username: admin  password: Admin@123');
    }

    console.log('✅  Database schema ready');
  } finally {
    conn.release();
  }
}

module.exports = { pool, initDB };

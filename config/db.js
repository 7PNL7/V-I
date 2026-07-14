const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  dialect: 'mysql',
  logging: false,
  define: {
    freezeTableName: true,
    timestamps: false
  }
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Kết nối MySQL thành công!');
    
    // === Manual table sync (bypass Sequelize sync which drops columns) ===
    try {
      const mysql = require('mysql2/promise');
      const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
      });
      
      // Ensure daily_capacity exists on pipeline table
      const [cols] = await conn.query("SHOW COLUMNS FROM pipeline LIKE 'daily_capacity'");
      if (cols.length === 0) {
        await conn.query("ALTER TABLE pipeline ADD COLUMN daily_capacity INT UNSIGNED DEFAULT 500 AFTER estimatedEndTime");
        console.log('✅ Migration: Added daily_capacity column');
      } else {
        console.log('✅ daily_capacity column exists');
      }
      
      // Ensure production_schedule table exists
      await conn.query(`CREATE TABLE IF NOT EXISTS production_schedule (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ma_pipe VARCHAR(20) NOT NULL,
        ma_dh VARCHAR(20) NOT NULL,
        ma_sp VARCHAR(20) NOT NULL,
        so_luong INT UNSIGNED NOT NULL,
        start_date DATE,
        end_date DATE,
        delivery_date DATE,
        status ENUM('queued','running','completed','overdue') DEFAULT 'queued',
        position INT DEFAULT 0,
        UNIQUE KEY uk_ma_dh (ma_dh)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      
      await conn.end();
      console.log('✅ Đồng bộ models thành công!');
    } catch (syncErr) {
      console.log('⚠️ Lỗi đồng bộ:', syncErr.message.substring(0, 120));
    }
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
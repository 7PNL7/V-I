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
    
    // Sync models (alter: true = thêm cột mới, không xóa dữ liệu cũ)
    const models = require('../models');
    await models.syncAll();
    console.log('✅ Đồng bộ models thành công!');
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
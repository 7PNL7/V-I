const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Material = sequelize.define('storage', {
  ma_nl: {
    type: DataTypes.STRING(20),
    primaryKey: true,
    comment: 'Mã nguyên liệu (VD: VAI001)'
  },
  ten_nl: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Tên nguyên liệu'
  },
  so_luong: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
    comment: 'Số lượng tồn kho'
  },
  unit: {
    type: DataTypes.STRING(20),
    defaultValue: '',
    comment: 'Đơn vị: m, cái, kg...'
  },
  type: {
    type: DataTypes.ENUM('fabric', 'button', 'thread', 'accessory', 'other'),
    defaultValue: 'other',
    comment: 'Loại nguyên liệu'
  },
  costPerUnit: {
    type: DataTypes.DECIMAL(12, 2),
    comment: 'Đơn giá'
  },
  supplier: {
    type: DataTypes.STRING(100),
    comment: 'Nhà cung cấp'
  }
});

module.exports = Material;
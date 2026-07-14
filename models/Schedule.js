const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Schedule = sequelize.define('production_schedule', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ma_pipe: { type: DataTypes.STRING(20), allowNull: false },
  ma_dh: { type: DataTypes.STRING(20), allowNull: false },
  ma_sp: { type: DataTypes.STRING(20), allowNull: false },
  so_luong: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  start_date: { type: DataTypes.DATEONLY, comment: 'Ngày bắt đầu dự kiến' },
  end_date: { type: DataTypes.DATEONLY, comment: 'Ngày kết thúc dự kiến' },
  delivery_date: { type: DataTypes.DATEONLY, comment: 'Hạn giao hàng' },
  status: { type: DataTypes.ENUM('queued', 'running', 'completed', 'overdue'), defaultValue: 'queued' },
  position: { type: DataTypes.INTEGER, defaultValue: 0, comment: 'Thứ tự trong hàng chờ' }
});

module.exports = Schedule;

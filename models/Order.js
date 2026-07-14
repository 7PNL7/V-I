const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Order = sequelize.define('order', {
  ma_dh: {
    type: DataTypes.STRING(20),
    primaryKey: true,
    comment: 'Mã đơn hàng'
  },
  ten_kh: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Tên khách hàng'
  },
  sdt: {
    type: DataTypes.STRING(15),
    comment: 'Số điện thoại'
  },
  ma_sp: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'Mã sản phẩm'
  },
  so_luong: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    comment: 'Số lượng đặt'
  },
  ngay_giao: {
    type: DataTypes.DATEONLY,
    comment: 'Ngày giao dự kiến'
  },
  ngay_nhan: {
    type: DataTypes.DATEONLY,
    comment: 'Ngày nhận đơn'
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'in_production', 'completed', 'cancelled'),
    defaultValue: 'pending',
    comment: 'Trạng thái đơn'
  },
  totalAmount: {
    type: DataTypes.DECIMAL(14, 2),
    comment: 'Tổng tiền'
  }
});

module.exports = Order;
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const ProductionLine = sequelize.define('pipeline', {
  ma_pipe: {
    type: DataTypes.STRING(20),
    primaryKey: true,
    comment: 'Mã dây chuyền (VD: DC-A)'
  },
  ten_pipe: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Tên dây chuyền'
  },
  status: {
    type: DataTypes.ENUM('IDLE', 'RUNNING', 'STOPPED'),
    defaultValue: 'IDLE',
    comment: 'Trạng thái'
  },
  ma_sp_dang_lam: {
    type: DataTypes.STRING(20),
    comment: 'Mã SP đang sản xuất'
  },
  ma_dh_dang_lam: {
    type: DataTypes.STRING(50),
    comment: 'Mã đơn hàng đang gán vào dây chuyền'
  },
  step_do_status: {
    type: DataTypes.ENUM('PENDING', 'RUNNING', 'DONE'),
    defaultValue: 'PENDING',
    comment: 'Trạng thái khâu đo'
  },
  step_may_status: {
    type: DataTypes.ENUM('PENDING', 'RUNNING', 'DONE'),
    defaultValue: 'PENDING',
    comment: 'Trạng thái khâu may'
  },
  step_kiem_thu_status: {
    type: DataTypes.ENUM('PENDING', 'RUNNING', 'DONE'),
    defaultValue: 'PENDING',
    comment: 'Trạng thái khâu kiểm thử'
  },
  startTime: {
    type: DataTypes.DATE,
    comment: 'Thời gian bắt đầu'
  },
  estimatedEndTime: {
    type: DataTypes.DATE,
    comment: 'Thời gian kết thúc dự kiến'
  },
  daily_capacity: {
    type: DataTypes.INTEGER,
    defaultValue: 500,
    comment: 'Số sản phẩm sản xuất tối đa mỗi ngày'
  }
});

module.exports = ProductionLine;
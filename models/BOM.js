const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const BOM = sequelize.define('bom', {
  ma_sp: {
    type: DataTypes.STRING(20),
    primaryKey: true,
    comment: 'Mã sản phẩm'
  },
  ma_nl: {
    type: DataTypes.STRING(20),
    primaryKey: true,
    comment: 'Mã nguyên liệu'
  },
  dinh_muc: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Định mức cho 1 sản phẩm'
  },
  don_vi: {
    type: DataTypes.STRING(20),
    defaultValue: '',
    comment: 'Đơn vị'
  }
}, {
  tableName: 'bom'
});

module.exports = BOM;

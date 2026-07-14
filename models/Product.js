const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Product = sequelize.define('product', {
  ma_sp: {
    type: DataTypes.STRING(20),
    primaryKey: true,
    comment: 'Mã sản phẩm (VD: MS-001)'
  },
  ten_sp: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Tên sản phẩm'
  },
  description: {
    type: DataTypes.TEXT,
    comment: 'Mô tả sản phẩm'
  },
  image: {
    type: DataTypes.STRING(255),
    comment: 'Đường dẫn ảnh'
  },
  price: {
    type: DataTypes.DECIMAL(12, 2),
    comment: 'Giá sản phẩm'
  },
  stock: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Tồn kho thành phẩm'
  }
});

module.exports = Product;
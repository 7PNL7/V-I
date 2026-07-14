const { sequelize } = require('../config/db');
const Product = require('./Product');
const Material = require('./Material');
const BOM = require('./BOM');
const Order = require('./Order');
const ProductionLine = require('./ProductionLine');
const User = require('./User');

// Định nghĩa quan hệ
Product.hasMany(BOM, { foreignKey: 'ma_sp', sourceKey: 'ma_sp' });
BOM.belongsTo(Product, { foreignKey: 'ma_sp', targetKey: 'ma_sp' });

Material.hasMany(BOM, { foreignKey: 'ma_nl', sourceKey: 'ma_nl' });
BOM.belongsTo(Material, { foreignKey: 'ma_nl', targetKey: 'ma_nl' });

Product.hasMany(Order, { foreignKey: 'ma_sp', sourceKey: 'ma_sp' });
Order.belongsTo(Product, { foreignKey: 'ma_sp', targetKey: 'ma_sp' });

Product.hasMany(ProductionLine, { foreignKey: 'ma_sp_dang_lam', sourceKey: 'ma_sp' });
ProductionLine.belongsTo(Product, { foreignKey: 'ma_sp_dang_lam', targetKey: 'ma_sp' });

const syncAll = async () => {
  await sequelize.sync({ alter: true });
};

module.exports = {
  Product, Material, BOM, Order, ProductionLine, User,
  syncAll
};

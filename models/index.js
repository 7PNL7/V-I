const { sequelize } = require('../config/db');
const Product = require('./Product');
const Material = require('./Material');
const BOM = require('./BOM');
const Order = require('./Order');
const ProductionLine = require('./ProductionLine');
const User = require('./User');
const Schedule = require('./Schedule');

// Định nghĩa quan hệ
Product.hasMany(BOM, { foreignKey: 'ma_sp', sourceKey: 'ma_sp' });
BOM.belongsTo(Product, { foreignKey: 'ma_sp', targetKey: 'ma_sp' });

Material.hasMany(BOM, { foreignKey: 'ma_nl', sourceKey: 'ma_nl' });
BOM.belongsTo(Material, { foreignKey: 'ma_nl', targetKey: 'ma_nl' });

Product.hasMany(Order, { foreignKey: 'ma_sp', sourceKey: 'ma_sp' });
Order.belongsTo(Product, { foreignKey: 'ma_sp', targetKey: 'ma_sp' });

Product.hasMany(ProductionLine, { foreignKey: 'ma_sp_dang_lam', sourceKey: 'ma_sp' });
ProductionLine.belongsTo(Product, { foreignKey: 'ma_sp_dang_lam', targetKey: 'ma_sp' });

// Schedule relationships
ProductionLine.hasMany(Schedule, { foreignKey: 'ma_pipe', sourceKey: 'ma_pipe' });
Schedule.belongsTo(ProductionLine, { foreignKey: 'ma_pipe', targetKey: 'ma_pipe' });
Order.hasOne(Schedule, { foreignKey: 'ma_dh', sourceKey: 'ma_dh' });
Schedule.belongsTo(Order, { foreignKey: 'ma_dh', targetKey: 'ma_dh' });

const syncAll = async () => {
  try {
    await sequelize.sync({ alter: true });
  } catch (e) {
    console.log('⚠️ Sync warning (non-fatal):', e.message.substring(0, 100));
    try { await sequelize.sync(); } catch(e2) { console.log('⚠️ Sync fallback failed:', e2.message.substring(0, 100)); }
  }
};

module.exports = {
  Product, Material, BOM, Order, ProductionLine, User, Schedule,
  syncAll
};

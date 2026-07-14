const { Order, Product, ProductionLine } = require('../models');
const { sequelize } = require('../config/db');

exports.getAll = async (req, res) => {
  const orders = await Order.findAll({ 
    include: Product,
    order: [['ngay_nhan', 'DESC']]
  });
  res.json(orders);
};

exports.create = async (req, res) => {
  try {
    const { ma_dh, ten_kh, sdt, ma_sp, so_luong, ngay_giao, ngay_nhan } = req.body;
    
    // Kiểm tra sản phẩm tồn tại
    const product = await Product.findByPk(ma_sp);
    if (!product) {
      return res.status(400).json({ msg: 'Sản phẩm không tồn tại' });
    }

    const order = await Order.create({ 
      ma_dh, ten_kh, sdt, ma_sp, so_luong, 
      ngay_giao, 
      ngay_nhan: ngay_nhan || new Date().toISOString().split('T')[0],
      status: 'pending'
    });
    res.json({ msg: 'Tạo đơn hàng thành công', ma_dh: order.ma_dh });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ msg: 'Mã đơn hàng đã tồn tại' });
    }
    res.status(500).json({ msg: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  await Order.update({ status: req.body.status }, { where: { ma_dh: req.params.id } });
  res.json({ msg: 'Cập nhật trạng thái thành công' });
};

// MRP: kiểm tra nguyên liệu thiếu
exports.checkMRP = async (req, res) => {
  const { sequelize } = require('../config/db');
  const [rows] = await sequelize.query(`
    SELECT o.ma_dh, o.ten_kh, p.ten_sp, s.ma_nl, s.ten_nl,
      CONCAT(b.dinh_muc, ' ', b.don_vi) AS dinh_muc,
      o.so_luong AS sl_dat,
      ROUND(o.so_luong * b.dinh_muc, 2) AS can,
      s.so_luong AS ton_kho,
      IF(s.so_luong >= o.so_luong * b.dinh_muc, 'ĐỦ', 'THIẾU') AS trang_thai
    FROM \`order\` o
    JOIN product p ON o.ma_sp = p.ma_sp
    JOIN bom b ON p.ma_sp = b.ma_sp
    JOIN storage s ON b.ma_nl = s.ma_nl
    WHERE o.ma_dh = ?
  `, { replacements: [req.params.id] });
  res.json(rows);
};

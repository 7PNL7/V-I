const { Product, BOM, Material } = require('../models');

exports.getAll = async (req, res) => {
  const products = await Product.findAll({ include: BOM });
  res.json(products);
};

exports.getJSON = async (req, res) => {
  const products = await Product.findAll({ include: BOM });
  res.json(products);
};

exports.create = async (req, res) => {
  try {
    const { ma_sp, ten_sp, description, price, stock } = req.body;
    await Product.create({ ma_sp, ten_sp, description, price, stock });
    res.json({ msg: 'Tạo sản phẩm thành công' });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') return res.status(400).json({ msg: 'Mã SP đã tồn tại' });
    res.status(500).json({ msg: err.message });
  }
};

exports.update = async (req, res) => {
  await Product.update(req.body, { where: { ma_sp: req.params.id } });
  res.json({ msg: 'Cập nhật thành công' });
};

exports.remove = async (req, res) => {
  try {
    await Product.destroy({ where: { ma_sp: req.params.id } });
    res.json({ msg: 'Xóa thành công' });
  } catch (err) {
    res.status(400).json({ msg: 'Không thể xóa (sản phẩm đang được sử dụng)' });
  }
};

// BOM
exports.getBOM = async (req, res) => {
  const bom = await BOM.findAll({
    where: { ma_sp: req.params.id },
    include: [Product, Material]
  });
  res.json(bom);
};

exports.addBOM = async (req, res) => {
  try {
    const { ma_sp, ma_nl, dinh_muc, don_vi } = req.body;
    await BOM.create({ ma_sp, ma_nl, dinh_muc, don_vi });
    res.json({ msg: 'Thêm BOM thành công' });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') return res.status(400).json({ msg: 'Nguyên liệu đã có trong BOM' });
    if (err.name === 'SequelizeForeignKeyConstraintError') return res.status(400).json({ msg: 'Nguyên liệu không tồn tại trong kho' });
    res.status(500).json({ msg: err.message });
  }
};

exports.removeBOM = async (req, res) => {
  try {
    await BOM.destroy({ where: { ma_sp: req.params.id, ma_nl: req.params.nlId } });
    res.json({ msg: 'Xóa BOM thành công' });
  } catch (err) {
    res.status(400).json({ msg: 'Lỗi khi xóa BOM' });
  }
};

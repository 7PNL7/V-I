const { Material, BOM } = require('../models');

exports.getAll = async (req, res) => {
  const materials = await Material.findAll();
  res.json(materials);
};

exports.create = async (req, res) => {
  await Material.create(req.body);
  res.json({ msg: 'Tạo nguyên liệu thành công' });
};

exports.update = async (req, res) => {
  await Material.update(req.body, { where: { ma_nl: req.params.id } });
  res.json({ msg: 'Cập nhật thành công' });
};

exports.remove = async (req, res) => {
  await Material.destroy({ where: { ma_nl: req.params.id } });
  res.json({ msg: 'Xóa thành công' });
};

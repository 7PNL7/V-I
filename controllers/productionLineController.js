const { ProductionLine, Product, Order, BOM, Material } = require('../models');
const { sequelize } = require('../config/db');

exports.getAll = async (req, res) => {
  const [rows] = await sequelize.query(
    `SELECT p.*, 
      pr.ma_sp AS product_ma_sp, pr.ten_sp AS product_ten_sp, 
      pr.description AS product_description, pr.image AS product_image,
      pr.price AS product_price, pr.stock AS product_stock
    FROM pipeline p
    LEFT JOIN product pr ON p.ma_sp_dang_lam = pr.ma_sp`
  );
  const lines = rows.map(row => {
    const product = row.product_ma_sp ? {
      ma_sp: row.product_ma_sp,
      ten_sp: row.product_ten_sp,
      description: row.product_description,
      image: row.product_image,
      price: row.product_price,
      stock: row.product_stock
    } : null;
    return {
      ma_pipe: row.ma_pipe,
      ten_pipe: row.ten_pipe,
      status: row.status,
      ma_sp_dang_lam: row.ma_sp_dang_lam,
      ma_dh_dang_lam: row.ma_dh_dang_lam,
      step_do_status: row.step_do_status,
      step_may_status: row.step_may_status,
      step_kiem_thu_status: row.step_kiem_thu_status,
      startTime: row.startTime,
      estimatedEndTime: row.estimatedEndTime,
      daily_capacity: row.daily_capacity,
      product
    };
  });
  res.json(lines);
};

exports.getDetail = async (req, res) => {
  try {
    const line = await ProductionLine.findByPk(req.params.id, { include: Product });
    let order = null;
    let bom = [];

    if (line?.ma_dh_dang_lam) {
      order = await Order.findByPk(line.ma_dh_dang_lam);
    }

    if (line?.ma_sp_dang_lam) {
      bom = await BOM.findAll({
        where: { ma_sp: line.ma_sp_dang_lam },
        include: [Material]
      });
    }

    res.json({
      pipeline: line,
      order,
      product: line?.product || null,
      bom: bom.map(item => ({
        ma_nl: item.ma_nl,
        ten_nl: item.storage?.ten_nl || item.ma_nl,
        dinh_muc: item.dinh_muc,
        don_vi: item.don_vi,
        ton_kho: item.storage?.so_luong ?? null
      }))
    });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

exports.updateStatus = async (req, res) => {
  const { status, ma_sp_dang_lam, ma_dh_dang_lam } = req.body;
  const updateData = { status };

  if (ma_sp_dang_lam !== undefined) {
    updateData.ma_sp_dang_lam = ma_sp_dang_lam;
  }
  if (ma_dh_dang_lam !== undefined) {
    updateData.ma_dh_dang_lam = ma_dh_dang_lam;
  }
  if (status === 'RUNNING' && ma_sp_dang_lam !== null) {
    updateData.startTime = new Date();
  }
  if (status === 'IDLE') {
    const oldPipe = await ProductionLine.findByPk(req.params.id);

    if (oldPipe && oldPipe.ma_sp_dang_lam && ma_sp_dang_lam === null) {
      const spCode = oldPipe.ma_sp_dang_lam;
      await Order.update(
        { status: 'approved' },
        { where: { ma_sp: spCode, status: 'in_production' } }
      );
    }

    updateData.ma_dh_dang_lam = null;
    updateData.ma_sp_dang_lam = null;
    updateData.step_do_status = 'PENDING';
    updateData.step_may_status = 'PENDING';
    updateData.step_kiem_thu_status = 'PENDING';
    updateData.startTime = null;
    updateData.estimatedEndTime = null;
  }

  await ProductionLine.update(updateData, { where: { ma_pipe: req.params.id } });

  const updated = await ProductionLine.findByPk(req.params.id, { include: Product });
  res.json({ msg: 'Cập nhật trạng thái thành công', pipeline: updated });
};

exports.updateStepStatus = async (req, res) => {
  try {
    const { step, status } = req.body;
    const fieldMap = {
      do: 'step_do_status',
      may: 'step_may_status',
      'kiem-thu': 'step_kiem_thu_status'
    };

    const field = fieldMap[step];
    if (!field) {
      return res.status(400).json({ msg: 'Khâu sản xuất không hợp lệ' });
    }

    const allowed = ['PENDING', 'RUNNING', 'DONE'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ msg: 'Trạng thái không hợp lệ' });
    }

    await ProductionLine.update({ [field]: status }, { where: { ma_pipe: req.params.id } });
    const updated = await ProductionLine.findByPk(req.params.id, { include: Product });
    res.json({ msg: 'Cập nhật khâu thành công', pipeline: updated });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

exports.updateCapacity = async (req, res) => {
  try {
    const { daily_capacity } = req.body;
    if (!daily_capacity || daily_capacity < 1 || daily_capacity > 99999) {
      return res.status(400).json({ msg: 'Công suất phải từ 1 đến 99999 sp/ngày' });
    }
    await sequelize.query(
      'UPDATE pipeline SET daily_capacity = ? WHERE ma_pipe = ?',
      { replacements: [Number(daily_capacity), req.params.id] }
    );
    const [rows] = await sequelize.query(
      'SELECT * FROM pipeline WHERE ma_pipe = ?',
      { replacements: [req.params.id] }
    );
    const updated = rows[0] || null;
    res.json({ msg: 'Cập nhật công suất thành công', pipeline: updated });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

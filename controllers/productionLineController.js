const { ProductionLine, Product, Order, BOM, Material } = require('../models');

exports.getAll = async (req, res) => {
  const lines = await ProductionLine.findAll({ include: Product });
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

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB, sequelize } = require('./config/db');

const app = express();

// Helper: get all pipelines with daily_capacity via raw SQL
async function getLinesWithCapacity() {
  const [rows] = await sequelize.query('SELECT * FROM pipeline');
  return rows;
}

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/production-lines', require('./routes/productionLines'));

// Admin Pages (EJS)
app.get('/', (req, res) => {
  res.render('index', { title: 'Hệ thống Quản lý Sản xuất May mặc' });
});

app.get('/admin/products', async (req, res) => {
  const { Product, BOM } = require('./models');
  const products = await Product.findAll({ include: BOM });
  res.render('products', { products, title: 'Quản lý Sản phẩm' });
});

app.get('/admin/materials', async (req, res) => {
  const { Material } = require('./models');
  const materials = await Material.findAll();
  res.render('materials', { materials, title: 'Quản lý Nguyên liệu' });
});

app.get('/admin/orders', async (req, res) => {
  const { Order, Product } = require('./models');
  const orders = await Order.findAll({ include: Product });
  res.render('orders', { orders, title: 'Quản lý Đơn hàng' });
});

app.get('/admin/production', async (req, res) => {
  const { Product } = require('./models');
  const lines = await getLinesWithCapacity();
  const products = await Product.findAll();
  res.render('production', { lines, products, title: 'Điều phối Dây chuyền Sản xuất' });
});

app.get('/admin/production/:id/detail', async (req, res) => {
  const { Product, Order, BOM, Material } = require('./models');

  const [lineRows] = await sequelize.query('SELECT p.*, pr.ma_sp AS product_ma_sp, pr.ten_sp AS product_ten_sp FROM pipeline p LEFT JOIN product pr ON p.ma_sp_dang_lam = pr.ma_sp WHERE p.ma_pipe = ?', { replacements: [req.params.id] });
  const line = lineRows[0];
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

  res.render('production-detail', {
    title: `Chi tiết ${req.params.id}`,
    line,
    order,
    product: line?.product_ma_sp ? { ma_sp: line.product_ma_sp, ten_sp: line.product_ten_sp } : null,
    bom: bom.map(item => ({
      ma_nl: item.ma_nl,
      ten_nl: item.storage?.ten_nl || item.ma_nl,
      dinh_muc: item.dinh_muc,
      don_vi: item.don_vi,
      ton_kho: item.storage?.so_luong ?? null
    })),
  });
});

app.get('/admin/schedule-planning', async (req, res) => {
  try {
    const { Order, Product } = require('./models');
    const orders = await Order.findAll({ 
      include: Product,
      order: [['ngay_nhan', 'DESC']]
    });
    const lines = await getLinesWithCapacity();
    res.render('schedule-planning', { 
      title: 'Lập lịch kế hoạch sản xuất',
      orders,
      lines
    });
  } catch (e) {
    console.error('Error loading schedule page:', e);
    res.render('schedule-planning', { 
      title: 'Lập lịch kế hoạch sản xuất',
      orders: [],
      lines: []
    });
  }
});

app.get('/api/status', (req, res) => {
  res.json({ 
    status: "running", 
    message: "Backend hoạt động bình thường",
    serverTime: new Date().toISOString()
  });
});

// Customer pages
app.get('/place-order', async (req, res) => {
  const { Product } = require('./models');
  const products = await Product.findAll();
  res.render('place-order', { products, title: 'Đặt hàng' });
});

// API: recent orders for customer page
app.get('/api/orders/recent', async (req, res) => {
  const { Order, Product } = require('./models');
  const orders = await Order.findAll({
    include: Product,
    order: [['ngay_nhan', 'DESC']],
    limit: 20
  });
  res.json(orders);
});

// Scheduling API - Đề xuất dây chuyền
app.post('/api/schedule/suggest-lines', async (req, res) => {
  try {
    const { ma_dh, ma_sp, so_luong, ngay_giao } = req.body;
    const { ProductionLine } = require('./models');

    const lines = await getLinesWithCapacity();
    
    const giao_date = new Date(ngay_giao);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const daysToDelivery = Math.ceil((giao_date - today) / (1000 * 60 * 60 * 24));

    const suggestions = lines.map(line => {
      const capacity = line.daily_capacity || 500;
      const production_days = Math.ceil(so_luong / capacity) || 1;
      let score = 100;
      let available_from = 'Sẵn sàng';
      let status_text = 'Khả dụng';
      let estimated_end = null;

      // Ưu tiên theo trạng thái dây chuyền
      if (line.status === 'IDLE') {
        score = 95;
        available_from = 'Ngay';
      } else if (line.status === 'RUNNING') {
        score = 60;
        status_text = 'Đang sản xuất';
        available_from = '~2-3 ngày';
      } else if (line.status === 'STOPPED') {
        score = 75;
        status_text = 'Tạm dừng';
        available_from = 'Sớm';
      }

      // === ƯU TIÊN ĐƠN GẦN NGÀY GIAO ===
      let urgencyPenalty = 0;
      if (daysToDelivery <= 3) urgencyPenalty = 45;      // Rất khẩn
      else if (daysToDelivery <= 7) urgencyPenalty = 25; // Khẩn
      else if (daysToDelivery <= 14) urgencyPenalty = 10;

      score = Math.max(30, score - urgencyPenalty);

      // Tính ngày kết thúc dự kiến
      const start_date = new Date(giao_date);
      start_date.setDate(start_date.getDate() - production_days);
      
      const est_date = new Date(start_date);
      est_date.setDate(est_date.getDate() + production_days);
      estimated_end = est_date.toISOString().split('T')[0];

      // Phạt thêm nếu có nguy cơ trễ
      if (est_date > giao_date) {
        score -= 35;
        status_text = 'Có nguy cơ trễ';
      }

      return {
        ma_pipe: line.ma_pipe,
        ten_pipe: line.ten_pipe,
        status: line.status,
        status_text,
        available_from,
        estimated_end,
        production_days,
        daily_capacity: capacity,
        score: Math.round(score),
        days_to_delivery: daysToDelivery
      };
    });

    // Sắp xếp theo điểm số giảm dần
    suggestions.sort((a, b) => b.score - a.score);

    res.json(suggestions);
  } catch (e) {
    console.error('Error in suggest-lines:', e);
    res.status(500).json({ msg: 'Lỗi server khi đề xuất dây chuyền' });
  }
});

// Get Gantt chart data
app.get('/api/schedule/gantt', async (req, res) => {
  try {
    const { ma_dh, ma_pipe } = req.query;
    const { Order } = require('./models');

    // Get the order and line
    const order = await Order.findOne({ where: { ma_dh } });
    const [lineRows] = await sequelize.query('SELECT * FROM pipeline WHERE ma_pipe = ?', { replacements: [ma_pipe] });
    const line = lineRows[0];

    if (!order || !line) {
      return res.status(404).json({ msg: 'Không tìm thấy' });
    }

    // Calculate production time
    const capacity = line.daily_capacity || 500;
    const production_days = Math.ceil(order.so_luong / capacity) || 1;
    
    // Calculate dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const giao_date = new Date(order.ngay_giao + 'T00:00:00');
    const start_date = new Date(giao_date);
    start_date.setDate(start_date.getDate() - production_days);

    // Generate dates: show from start_date to delivery_date, but at least 30 days view
    let displayStart = new Date(today);
    let displayEnd = new Date(today);
    displayEnd.setDate(displayEnd.getDate() + 30);

    // If production is in the future, adjust the view to show that range
    if (start_date > displayEnd) {
      displayStart = new Date(start_date);
      displayStart.setDate(displayStart.getDate() - 5); // Show 5 days before production
    }

    // Make sure we show up to the delivery date
    if (giao_date > displayEnd) {
      displayEnd = new Date(giao_date);
      displayEnd.setDate(displayEnd.getDate() + 5); // Show 5 days after delivery
    }

    const dates = [];
    const current = new Date(displayStart);
    while (current <= displayEnd && dates.length < 60) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    // Create schedule for the order
    const jobs = [];
    let currentDay = new Date(start_date);
    for (let i = 0; i < production_days; i++) {
      const dateStr = currentDay.toISOString().split('T')[0];
      if (dates.includes(dateStr)) {
        jobs.push({
          date: dateStr,
          ma_dh: order.ma_dh,
          label: `${order.ma_dh} (${order.so_luong} cái)`,
          status: 'RUNNING'
        });
      }
      currentDay.setDate(currentDay.getDate() + 1);
    }

    // Create line data with jobs
    const lineData = {
      ten_pipe: line.ten_pipe,
      ma_pipe: line.ma_pipe,
      jobs: jobs
    };

    res.json({
      dates,
      lines: [lineData],
      schedule_info: {
        start_date: start_date.toISOString().split('T')[0],
        end_date: new Date(start_date.getTime() + production_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        production_days: production_days,
        delivery_date: order.ngay_giao,
        status: start_date >= today ? 'Sẵn sàng' : 'Cần bắt đầu sớm'
      }
    });
  } catch (e) {
    console.error('Error:', e);
    res.status(500).json({ msg: 'Lỗi server' });
  }
});

// Get Gantt chart data for ALL production lines (multi-order support)
app.get('/api/schedule/gantt-all', async (req, res) => {
  try {
    const { ProductionLine, Order, Product, Schedule } = require('./models');
    const lines = await getLinesWithCapacity();
    const allOrders = await Order.findAll({ include: Product });
    const allSchedules = await Schedule.findAll({ order: [['ma_pipe', 'ASC'], ['position', 'ASC']] });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Helper: Convert JS Date to local date string YYYY-MM-DD
    const toLocalDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      return d.getFullYear() + '-' + 
        String(d.getMonth() + 1).padStart(2, '0') + '-' + 
        String(d.getDate()).padStart(2, '0');
    };

    let startDate, endDate;
    if (req.query.start_date && req.query.end_date) {
      startDate = new Date(req.query.start_date + 'T00:00:00');
      endDate = new Date(req.query.end_date + 'T00:00:00');
    } else {
      startDate = new Date(today);
      endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 30);
    }

    const dates = [];
    const current = new Date(startDate);
    while (current <= endDate && dates.length < 90) {
      dates.push(toLocalDate(current));
      current.setDate(current.getDate() + 1);
    }

    // Build line data with ALL scheduled orders
    const lineData = lines.map(line => {
      const jobs = [];
      const lineSchedules = allSchedules.filter(s => s.ma_pipe === line.ma_pipe);

      lineSchedules.forEach(sch => {
        const order = allOrders.find(o => o.ma_dh === sch.ma_dh);
        if (!order) return;

        const startLocal = toLocalDate(sch.start_date);
        const endLocal = toLocalDate(sch.end_date);

        const prodDays = endLocal && startLocal
          ? Math.round((new Date(endLocal + 'T00:00:00') - new Date(startLocal + 'T00:00:00')) / 86400000) + 1
          : Math.ceil(order.so_luong / (line.daily_capacity || 500)) || 1;

        const actualStart = startLocal || toLocalDate(today);
        const startDt = new Date(actualStart + 'T00:00:00');
        const deliveryDate = order.ngay_giao 
          ? toLocalDate(order.ngay_giao)
          : (sch.delivery_date ? toLocalDate(sch.delivery_date) : null);

        for (let d = 0; d < prodDays; d++) {
          const dateStr = toLocalDate(new Date(startDt.getTime() + d * 86400000));
          if (dates.includes(dateStr)) {
            const isOverdue = deliveryDate && dateStr >= deliveryDate;
            
            let jobStatus = sch.status;
            if (isOverdue) jobStatus = 'OVERDUE';
            else if (sch.status === 'running') jobStatus = 'RUNNING';
            else if (sch.status === 'completed') jobStatus = 'COMPLETED';
            else jobStatus = 'QUEUED';

            jobs.push({
              date: dateStr,
              ma_dh: order.ma_dh,
              label: `${order.ma_dh} (${order.so_luong} cái)`,
              status: jobStatus,
              product: order.product?.ten_sp || order.ma_sp,
              customer: order.ten_kh,
              delivery_date: deliveryDate,
              is_overdue: isOverdue,
              position: sch.position
            });
          }
        }
      });

      return {
        ten_pipe: line.ten_pipe,
        ma_pipe: line.ma_pipe,
        status: line.status,
        jobs
      };
    });

    // Count overdue orders
    const overdueCount = allSchedules.filter(s => {
      const o = allOrders.find(ord => ord.ma_dh === s.ma_dh);
      if (!o) return false;
      const delivery = o.ngay_giao ? toLocalDate(o.ngay_giao) : null;
      const endLocal = toLocalDate(s.end_date);
      return delivery && endLocal && endLocal > delivery;
    }).length;

    res.json({ dates, lines: lineData, stats: { total_scheduled: allSchedules.length, overdue: overdueCount } });
  } catch (e) {
    console.error('Error in gantt-all:', e);
    res.status(500).json({ msg: 'Lỗi server' });
  }
});

// Suggest optimal slot for an order on all lines
app.post('/api/schedule/suggest-slot', async (req, res) => {
  try {
    const { ma_dh, so_luong, ngay_giao } = req.body;
    const { ProductionLine, Schedule, Order } = require('./models');

    const toLocalDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      return d.getFullYear() + '-' + 
        String(d.getMonth() + 1).padStart(2, '0') + '-' + 
        String(d.getDate()).padStart(2, '0');
    };

    const order = ma_dh ? await Order.findOne({ where: { ma_dh } }) : null;

    const lines = await getLinesWithCapacity();
    const allSchedules = await Schedule.findAll({ order: [['position', 'ASC']] });

    const suggestions = lines.map(line => {
      const capacity = line.daily_capacity || 500;
      const prodDays = Math.ceil((so_luong || order?.so_luong || 1000) / capacity) || 1;
      const delivery = ngay_giao || (order?.ngay_giao ? toLocalDate(order.ngay_giao) : null);
      const today = toLocalDate(new Date());
      const lineSchedules = allSchedules.filter(s => s.ma_pipe === line.ma_pipe);
      
      let slotStart = today;
      if (lineSchedules.length > 0) {
        const lastSch = lineSchedules[lineSchedules.length - 1];
        const lastEnd = toLocalDate(lastSch.end_date);
        if (lastEnd) {
          const dt = new Date(lastEnd + 'T00:00:00');
          dt.setDate(dt.getDate() + 1);
          slotStart = toLocalDate(dt);
        }
      }

      const endDt = new Date(slotStart + 'T00:00:00');
      endDt.setDate(endDt.getDate() + prodDays - 1);
      const slotEnd = toLocalDate(endDt);

      const isOverdue = delivery && slotEnd > delivery;
      
      let score = 100;
      let statusText = 'Khả dụng';
      
      if (line.status !== 'IDLE') score -= 20;
      if (lineSchedules.length > 2) score -= 15;
      if (isOverdue) {
        score -= 40;
        statusText = `Có thể trễ hạn (kết thúc: ${slotEnd}, giao: ${delivery})`;
      }
      if (lineSchedules.length === 0) score += 10;

      return {
        ma_pipe: line.ma_pipe,
        ten_pipe: line.ten_pipe,
        status: line.status,
        daily_capacity: capacity,
        queue_length: lineSchedules.length,
        slot_start: slotStart,
        slot_end: slotEnd,
        production_days: prodDays,
        is_overdue: !!isOverdue,
        score: Math.max(10, Math.round(score)),
        status_text: statusText
      };
    });

    suggestions.sort((a, b) => b.score - a.score);
    res.json(suggestions);
  } catch (e) {
    console.error('Error in suggest-slot:', e);
    res.status(500).json({ msg: 'Lỗi server' });
  }
});

// Save schedule assignment (multi-order queue)
app.post('/api/schedule/assign', async (req, res) => {
  try {
    const { ma_dh, ma_pipe, start_date } = req.body;
    const { Order, ProductionLine, Schedule } = require('./models');

    const toLocalDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      return d.getFullYear() + '-' + 
        String(d.getMonth() + 1).padStart(2, '0') + '-' + 
        String(d.getDate()).padStart(2, '0');
    };

    const order = await Order.findOne({ where: { ma_dh } });
    const line = await ProductionLine.findOne({ where: { ma_pipe } });

    if (!order || !line) {
      return res.status(404).json({ msg: 'Không tìm thấy đơn hàng hoặc dây chuyền' });
    }

    // Check if order already scheduled - if so, remove old schedule
    const existing = await Schedule.findOne({ where: { ma_dh } });
    if (existing) {
      await Schedule.destroy({ where: { ma_dh } });
    }

    // Calculate production days
    const capacity = line.daily_capacity || 500;
    const prodDays = Math.ceil(order.so_luong / capacity) || 1;

    // Determine start date: if start_date provided, use it; else queue after last order
    let actualStart = start_date;
    if (!actualStart) {
      const lineSchedules = await Schedule.findAll({ 
        where: { ma_pipe }, 
        order: [['position', 'DESC']],
        limit: 1
      });
      if (lineSchedules.length > 0) {
        const lastEnd = toLocalDate(lineSchedules[0].end_date);
        const dt = new Date(lastEnd + 'T00:00:00');
        dt.setDate(dt.getDate() + 1);
        actualStart = toLocalDate(dt);
      } else {
        actualStart = toLocalDate(new Date());
      }
    }

    // Calculate end date
    const endDt = new Date(actualStart + 'T00:00:00');
    endDt.setDate(endDt.getDate() + prodDays - 1);
    const actualEnd = toLocalDate(endDt);

    // Get next position
    const maxPos = await Schedule.max('position', { where: { ma_pipe } });
    const nextPos = (maxPos || 0) + 1;

    // Check overdue
    const deliveryDate = order.ngay_giao ? toLocalDate(order.ngay_giao) : null;
    const isOverdue = deliveryDate && actualEnd > deliveryDate;
    const schStatus = isOverdue ? 'overdue' : 'queued';

    // Create schedule record
    await Schedule.create({
      ma_pipe,
      ma_dh,
      ma_sp: order.ma_sp,
      so_luong: order.so_luong,
      start_date: actualStart,
      end_date: actualEnd,
      delivery_date: deliveryDate,
      status: schStatus,
      position: nextPos
    });

    // Update pipeline if this is the first scheduled order
    if (nextPos === 1) {
      await line.update({
        ma_sp_dang_lam: order.ma_sp,
        ma_dh_dang_lam: order.ma_dh,
        status: 'IDLE',
        startTime: new Date(actualStart),
        estimatedEndTime: new Date(actualEnd)
      });
    }

    // Update order status
    await order.update({ status: 'in_production' });

    const msg = isOverdue 
      ? `✅ Đã xếp lịch! Lưu ý: đơn hàng có nguy cơ trễ hạn (giao: ${deliveryDate}, kết thúc: ${actualEnd})`
      : `✅ Đã xếp lịch #${nextPos} vào ${line.ten_pipe}! Bắt đầu: ${actualStart}, kết thúc: ${actualEnd}`;

    res.json({ msg, ma_dh, ma_pipe, position: nextPos, start_date: actualStart, end_date: actualEnd, is_overdue: isOverdue });
  } catch (e) {
    console.error('Error assigning:', e);
    res.status(500).json({ msg: 'Lỗi khi gán đơn hàng: ' + e.message });
  }
});

// Suggest split order across multiple lines to meet deadline
app.post('/api/schedule/split-suggestion', async (req, res) => {
  try {
    const { ma_dh } = req.body;
    const { Order, Product, ProductionLine, Schedule } = require('./models');

    const toLocalDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      return d.getFullYear() + '-' + 
        String(d.getMonth() + 1).padStart(2, '0') + '-' + 
        String(d.getDate()).padStart(2, '0');
    };

    const order = await Order.findOne({ where: { ma_dh }, include: Product });
    if (!order) return res.status(404).json({ msg: 'Không tìm thấy đơn hàng' });

    const today = toLocalDate(new Date());
    const delivery = order.ngay_giao ? toLocalDate(order.ngay_giao) : null;
    const totalQty = order.so_luong;
    
    const daysToDelivery = delivery 
      ? Math.round((new Date(delivery + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000)
      : 999;
    
    const lines = await ProductionLine.findAll();
    const avgRate = Math.round(lines.reduce((s, l) => s + (l.daily_capacity || 500), 0) / lines.length) || 500;
    const totalDaysNeeded = Math.ceil(totalQty / avgRate);

    const allSchedules = await Schedule.findAll({ order: [['position', 'ASC']] });

    let currentSchedule = null;
    let currentLine = null;
    const scheduleEntry = await Schedule.findOne({ where: { ma_dh } });
    if (scheduleEntry) {
      currentLine = lines.find(l => l.ma_pipe === scheduleEntry.ma_pipe);
      currentSchedule = {
        ma_pipe: scheduleEntry.ma_pipe,
        ten_pipe: currentLine?.ten_pipe || scheduleEntry.ma_pipe,
        start_date: toLocalDate(scheduleEntry.start_date),
        end_date: toLocalDate(scheduleEntry.end_date),
        status: scheduleEntry.status,
        position: scheduleEntry.position
      };
    }

    const lineCapacity = lines.map(line => {
      const cap = line.daily_capacity || 500;
      const lineSchedules = allSchedules.filter(s => s.ma_pipe === line.ma_pipe);
      let availableFrom = today;
      
      if (lineSchedules.length > 0) {
        const lastEnd = toLocalDate(lineSchedules[lineSchedules.length - 1].end_date);
        if (lastEnd) {
          const dt = new Date(lastEnd + 'T00:00:00');
          dt.setDate(dt.getDate() + 1);
          availableFrom = toLocalDate(dt);
        }
      }
      
      const daysAvail = delivery 
        ? Math.round((new Date(delivery + 'T00:00:00') - new Date(availableFrom + 'T00:00:00')) / 86400000)
        : 999;
      
      const maxCanProduce = Math.max(0, daysAvail * cap);
      
      return {
        ma_pipe: line.ma_pipe,
        ten_pipe: line.ten_pipe,
        available_from: availableFrom,
        days_available: daysAvail,
        max_produce_by_deadline: maxCanProduce,
        queue_length: lineSchedules.length,
        daily_capacity: cap
      };
    });

    const totalCapacity = lineCapacity.reduce((sum, l) => sum + l.max_produce_by_deadline, 0);
    const canMeetDeadline = totalCapacity >= totalQty;

    let splitSuggestions = [];
    
    if (!canMeetDeadline) {
      const totalDays = lineCapacity.reduce((sum, l) => sum + Math.max(0, l.days_available), 0);
      
      splitSuggestions = lineCapacity.filter(l => l.days_available > 0).map(l => {
        const ratio = totalDays > 0 ? Math.max(0, l.days_available) / totalDays : 0;
        const allocated = Math.round(totalQty * ratio);
        const prodDays = Math.ceil(allocated / (l.daily_capacity || 500));
        const endDt = new Date(l.available_from + 'T00:00:00');
        endDt.setDate(endDt.getDate() + prodDays - 1);
        
        return {
          ma_pipe: l.ma_pipe,
          ten_pipe: l.ten_pipe,
          quantity: allocated,
          production_days: prodDays,
          start_date: l.available_from,
          end_date: toLocalDate(endDt),
          can_finish_on_time: false,
          note: '⚠️ Không đủ thời gian, cần thêm line'
        };
      });
    } else {
      let remainingQty = totalQty;
      
      splitSuggestions = lineCapacity
        .filter(l => l.max_produce_by_deadline > 0)
        .sort((a, b) => b.days_available - a.days_available)
        .map(l => {
          const allocate = Math.min(remainingQty, l.max_produce_by_deadline);
          remainingQty -= allocate;
          const prodDays = Math.ceil(allocate / (l.daily_capacity || 500));
          const endDt = new Date(l.available_from + 'T00:00:00');
          endDt.setDate(endDt.getDate() + prodDays - 1);
          
          return {
            ma_pipe: l.ma_pipe,
            ten_pipe: l.ten_pipe,
            quantity: allocate,
            production_days: prodDays,
            start_date: l.available_from,
            end_date: toLocalDate(endDt),
            can_finish_on_time: true,
            note: allocate > 0 ? '✅ Có thể hoàn thành đúng hạn' : 'Không cần phân bổ'
          };
        })
        .filter(s => s.quantity > 0);
    }

    res.json({
      order: {
        ma_dh: order.ma_dh,
        ten_kh: order.ten_kh,
        product: order.product?.ten_sp || order.ma_sp,
        so_luong: totalQty,
        ngay_giao: delivery,
        total_days_needed: totalDaysNeeded,
        days_until_delivery: daysToDelivery
      },
      current_schedule: currentSchedule,
      can_meet_deadline: canMeetDeadline,
      total_capacity_by_deadline: totalCapacity,
      split_suggestions: splitSuggestions,
      line_capacity: lineCapacity
    });
  } catch (e) {
    console.error('Error in split-suggestion:', e);
    res.status(500).json({ msg: 'Lỗi server: ' + e.message });
  }
});

// Execute split: assign portions of an order to multiple lines
app.post('/api/schedule/split-assign', async (req, res) => {
  try {
    const { ma_dh, splits } = req.body;
    const { Order, ProductionLine, Schedule } = require('./models');

    const toLocalDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      return d.getFullYear() + '-' + 
        String(d.getMonth() + 1).padStart(2, '0') + '-' + 
        String(d.getDate()).padStart(2, '0');
    };

    const order = await Order.findOne({ where: { ma_dh } });
    if (!order) return res.status(404).json({ msg: 'Không tìm thấy đơn hàng' });

    // Remove existing schedule for this order
    await Schedule.destroy({ where: { ma_dh } });

    const results = [];
    for (const split of splits) {
      const { ma_pipe, quantity, start_date } = split;
      const line = await ProductionLine.findOne({ where: { ma_pipe } });
      if (!line) continue;

      const cap = line.daily_capacity || 500;
      const prodDays = Math.ceil(quantity / cap) || 1;
      let actualStart = start_date || toLocalDate(new Date());

      const lineSchedules = await Schedule.findAll({ 
        where: { ma_pipe }, 
        order: [['position', 'DESC']],
        limit: 1
      });
      if (lineSchedules.length > 0) {
        const lastEnd = toLocalDate(lineSchedules[0].end_date);
        if (lastEnd) {
          const dt = new Date(lastEnd + 'T00:00:00');
          dt.setDate(dt.getDate() + 1);
          const queuedStart = toLocalDate(dt);
          if (queuedStart > actualStart) actualStart = queuedStart;
        }
      }

      const endDt = new Date(actualStart + 'T00:00:00');
      endDt.setDate(endDt.getDate() + prodDays - 1);
      const actualEnd = toLocalDate(endDt);

      const maxPos = await Schedule.max('position', { where: { ma_pipe } });
      const nextPos = (maxPos || 0) + 1;

      const deliveryDate = order.ngay_giao ? toLocalDate(order.ngay_giao) : null;
      const isOverdue = deliveryDate && actualEnd > deliveryDate;
      const schStatus = isOverdue ? 'overdue' : 'queued';

      await Schedule.create({
        ma_pipe, ma_dh, ma_sp: order.ma_sp, so_luong: quantity,
        start_date: actualStart, end_date: actualEnd,
        delivery_date: deliveryDate, status: schStatus, position: nextPos
      });

      if (nextPos === 1) {
        await line.update({ ma_sp_dang_lam: order.ma_sp, ma_dh_dang_lam: ma_dh, status: 'IDLE' });
      }

      results.push({ ma_pipe: line.ten_pipe, quantity, start_date: actualStart, end_date: actualEnd, position: nextPos, is_overdue: isOverdue });
    }

    await order.update({ status: 'in_production' });
    res.json({ msg: `✅ Đã phân chia ${ma_dh} thành ${results.length} phần trên các dây chuyền!`, results });
  } catch (e) {
    console.error('Error in split-assign:', e);
    res.status(500).json({ msg: 'Lỗi khi phân chia: ' + e.message });
  }
});

// Move order to a different line
app.post('/api/schedule/move', async (req, res) => {
  try {
    const { ma_dh, ma_pipe, start_date } = req.body;
    const { Order, Schedule, ProductionLine } = require('./models');

    const toLocalDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      return d.getFullYear() + '-' + 
        String(d.getMonth() + 1).padStart(2, '0') + '-' + 
        String(d.getDate()).padStart(2, '0');
    };

    const order = await Order.findOne({ where: { ma_dh } });
    const schedule = await Schedule.findOne({ where: { ma_dh } });

    if (!order || !schedule) {
      return res.status(404).json({ msg: 'Không tìm thấy đơn hoặc lịch trình' });
    }

    // Get target line's daily capacity
    const targetLine = await ProductionLine.findOne({ where: { ma_pipe } });
    const moveCap = targetLine?.daily_capacity || 500;
    const prodDays = Math.ceil(order.so_luong / moveCap) || 1;
    const actualStart = start_date || schedule.start_date;
    const endDt = new Date(actualStart + 'T00:00:00');
    endDt.setDate(endDt.getDate() + prodDays - 1);
    const actualEnd = toLocalDate(endDt);
    const deliveryDate = order.ngay_giao ? toLocalDate(order.ngay_giao) : null;
    const isOverdue = deliveryDate && actualEnd > deliveryDate;
    const schStatus = isOverdue ? 'overdue' : 'queued';

    await schedule.update({
      ma_pipe, start_date: actualStart, end_date: actualEnd,
      delivery_date: deliveryDate, status: schStatus
    });

    res.json({ msg: `✅ Đã dời đơn ${ma_dh} sang ${ma_pipe} từ ${actualStart}`, ma_dh, ma_pipe, start_date: actualStart, end_date: actualEnd, is_overdue: isOverdue });
  } catch (e) {
    console.error('Error moving schedule:', e);
    res.status(500).json({ msg: 'Lỗi khi dời lịch: ' + e.message });
  }
});

// Swap positions of two orders
app.post('/api/schedule/swap', async (req, res) => {
  try {
    const { ma_dh_a, ma_dh_b } = req.body;
    const { Schedule } = require('./models');

    const scheduleA = await Schedule.findOne({ where: { ma_dh: ma_dh_a } });
    const scheduleB = await Schedule.findOne({ where: { ma_dh: ma_dh_b } });

    if (!scheduleA || !scheduleB) {
      return res.status(404).json({ msg: 'Không tìm thấy một trong các lịch trình' });
    }

    const temp = {
      ma_pipe: scheduleA.ma_pipe, start_date: scheduleA.start_date,
      end_date: scheduleA.end_date, delivery_date: scheduleA.delivery_date,
      status: scheduleA.status, position: scheduleA.position
    };

    await scheduleA.update({
      ma_pipe: scheduleB.ma_pipe, start_date: scheduleB.start_date,
      end_date: scheduleB.end_date, delivery_date: scheduleB.delivery_date,
      status: scheduleB.status, position: scheduleB.position
    });

    await scheduleB.update({
      ma_pipe: temp.ma_pipe, start_date: temp.start_date,
      end_date: temp.end_date, delivery_date: temp.delivery_date,
      status: temp.status, position: temp.position
    });

    res.json({ msg: `✅ Đổi chỗ ${ma_dh_a} và ${ma_dh_b} thành công`, ma_dh_a, ma_dh_b });
  } catch (e) {
    console.error('Error swapping schedule:', e);
    res.status(500).json({ msg: 'Lỗi khi đổi chỗ lịch: ' + e.message });
  }
});

const PORT = process.env.PORT || 3000;

// === Wait for DB connection BEFORE starting server ===
async function startServer() {
  await connectDB();
  
  app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('❌ Failed to start server:', err.message);
  process.exit(1);
});
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Kết nối Database MySQL
connectDB();

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
  const { ProductionLine, Product } = require('./models');
  const lines = await ProductionLine.findAll({ include: Product });
  const products = await Product.findAll();
  res.render('production', { lines, products, title: 'Điều phối Dây chuyền Sản xuất' });
});

app.get('/admin/production/:id/detail', async (req, res) => {
  const { ProductionLine, Product, Order, BOM, Material } = require('./models');

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

  res.render('production-detail', {
    title: `Chi tiết ${req.params.id}`,
    line,
    order,
    product: line?.product || null,
    bom: bom.map(item => ({
      ma_nl: item.ma_nl,
      ten_nl: item.storage?.ten_nl || item.ma_nl,
      dinh_muc: item.dinh_muc,
      don_vi: item.don_vi,
      ton_kho: item.storage?.so_luong ?? null
    })),
  });
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
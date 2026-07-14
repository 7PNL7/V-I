const jwt = require('jsonwebtoken');
const { User } = require('../models');

exports.register = async (req, res) => {
  try {
    const { username, password, fullName, phone, address } = req.body;
    const user = await User.create({ username, password, fullName, phone, address, role: 'customer' });
    res.json({ msg: 'Đăng ký thành công', userId: user.id });
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ where: { username } });
    if (!user) return res.status(401).json({ msg: 'Sai tài khoản hoặc mật khẩu' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ msg: 'Sai tài khoản hoặc mật khẩu' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, fullName: user.fullName } });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

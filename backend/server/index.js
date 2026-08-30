const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('../routes/auth.routes');
const usersRoutes = require('../routes/users.routes');
const walletRoutes = require('../routes/wallet.routes');
const adminRoutes = require('../routes/admin.routes');
const marketplaceRoutes = require('../routes/marketplace.routes');
const friendsRoutes = require('../routes/friends.routes');
const notificationsRoutes = require('../routes/notifications.routes');
const supportRoutes = require('../routes/support.routes');
const messagesRoutes = require('../routes/messages.routes');
const settingsRoutes = require('../routes/settings.routes');
const tasksRoutes = require('../routes/tasks.routes');
const telegramRoutes = require('../routes/telegram.routes');

const app = express();

app.use(helmet());
app.use(cors());

app.use(express.json({ limit: '6mb' }));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.get('/api/v1/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/marketplace', marketplaceRoutes);
app.use('/api/v1/friends', friendsRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/support', supportRoutes);
app.use('/api/v1/messages', messagesRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/tasks', tasksRoutes);
app.use('/api/v1/telegram', telegramRoutes);
// حساب المسار المطلق الكامل لجذر المشروع
const rootPath = path.resolve(__dirname, '../../');

// تقديم كافة الملفات الثابتة
app.use(express.static(rootPath));

// توجيه الصفحة الرئيسية باستخدام المسار المطلق
app.get('/', (req, res) => {
  res.sendFile(path.join(rootPath, 'index.html'));
});
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(Vilue backend listening on port ${PORT});
});
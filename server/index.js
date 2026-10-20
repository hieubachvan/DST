import express from 'express';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { openDb, ensureAdmin, verifySecret } from './db.js';
import { WorldManager } from './worlds.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const SESSION_MS = 12 * 60 * 60 * 1000; // phiên đăng nhập admin: 12 giờ

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const db = openDb();
ensureAdmin(db);
const worlds = new WorldManager(io, db);

app.use(express.json({ limit: '10kb' }));
app.get('/health', (_req, res) => res.send('ok'));

// ---------- API công khai ----------

app.get('/api/servers', (_req, res) => res.json(worlds.list()));

// ---------- API admin ----------

const sessions = new Map(); // token -> hết hạn lúc
const loginFails = new Map(); // ip -> { n, until }

app.post('/api/admin/login', (req, res) => {
  const ip = req.ip;
  const f = loginFails.get(ip);
  if (f && f.until > Date.now()) return res.status(429).json({ error: 'Đăng nhập sai quá nhiều lần, thử lại sau 1 phút.' });
  const { username, password } = req.body ?? {};
  const row = db.prepare('SELECT pass_hash FROM admins WHERE username = ?').get(String(username ?? ''));
  if (!row || !verifySecret(String(password ?? ''), row.pass_hash)) {
    const n = (f?.n ?? 0) + 1;
    loginFails.set(ip, { n: n >= 5 ? 0 : n, until: n >= 5 ? Date.now() + 60_000 : 0 });
    return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu.' });
  }
  loginFails.delete(ip);
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, Date.now() + SESSION_MS);
  res.json({ token });
});

function requireAdmin(req, res, next) {
  const token = (req.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const exp = sessions.get(token);
  if (!exp || exp < Date.now()) {
    sessions.delete(token);
    return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn, hãy đăng nhập lại.' });
  }
  next();
}

// Bọc handler: lỗi kiểm tra dữ liệu trả về 400 kèm thông báo
const handle = (fn) => (req, res) => {
  try {
    res.json(fn(req) ?? { ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

app.get('/api/admin/servers', requireAdmin, handle(() => worlds.list(true)));
app.post('/api/admin/servers', requireAdmin, handle((req) => worlds.create(req.body?.name, req.body?.passcode, req.body?.settings)));
app.patch('/api/admin/servers/:id', requireAdmin, handle((req) => worlds.update(req.params.id, req.body ?? {})));
app.delete('/api/admin/servers/:id', requireAdmin, handle((req) => worlds.remove(req.params.id)));

app.use(express.static(path.join(__dirname, '../dist')));

// ---------- Socket ----------

io.on('connection', (socket) => {
  let game = null;
  let player = null;

  // Bọc mọi handler để dữ liệu xấu từ client không làm sập server.
  const on = (event, fn) => socket.on(event, (data) => {
    try {
      fn(data);
    } catch (err) {
      console.error(`[${event}]`, err);
    }
  });
  const onPlayer = (event, fn) => on(event, (data) => player && fn(player, data));

  on('join', (data) => {
    if (player) return;
    const res = worlds.join(socket, data);
    if (res.error) return socket.emit('join:error', { message: res.error });
    ({ game, player } = res);
  });
  onPlayer('ready', (p) => game.onReady(p));
  onPlayer('pos', (p, d) => game.onPos(p, d));
  onPlayer('act', (p, d) => game.onAct(p, d));
  onPlayer('throw', (p, d) => game.onThrow(p, d));
  onPlayer('use', (p, d) => game.onUse(p, d));
  onPlayer('alt', (p, d) => game.onAlt(p, d));
  onPlayer('unequip', (p, d) => game.onUnequip(p, d));
  onPlayer('chest:store', (p, d) => game.onStore(p, d));
  onPlayer('chest:take', (p, d) => game.onTake(p, d));
  onPlayer('chest:close', (p) => game.onChestClose(p));
  onPlayer('craft', (p, d) => game.onCraft(p, d));
  onPlayer('chat', (p, d) => game.onChat(p, d));
  socket.on('disconnect', () => {
    if (player) game.leave(player);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Cổng ${PORT} đang bị chương trình khác dùng. Hãy tắt server cũ hoặc chạy với PORT khác.`);
    process.exit(1);
  }
  throw err;
});

// Lưu mọi thế giới đang chạy trước khi tắt (Ctrl+C, hoặc nền tảng deploy dừng server)
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    worlds.shutdown();
    db.close();
    console.log('Đã lưu các thế giới, tắt server.');
    process.exit(0);
  });
}

server.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});

// Quản lý nhiều server (thế giới): tạo/xóa, kiểm tra passcode, nạp thế giới từ DB khi có người vào
// và gỡ khỏi bộ nhớ khi không còn ai chơi.
import fs from 'node:fs';
import path from 'node:path';
import { Game } from './game.js';
import { DATA_DIR, hashSecret, verifySecret } from './db.js';
import { sanitizeSettings, presetOf } from '../shared/settings.js';

// Thế giới tạo trước khi có thông số kích thước bản đồ đã được khám phá tự do, nên giữ vô hạn.
const parseSettings = (json) => {
  try {
    const raw = (json && JSON.parse(json)) || {};
    return sanitizeSettings({ mapSize: 'infinite', ...raw });
  } catch { return sanitizeSettings({ mapSize: 'infinite' }); }
};

const UNLOAD_AFTER_MS = Number(process.env.UNLOAD_AFTER_MS) || 60_000; // vắng người quá 1 phút thì lưu và gỡ khỏi bộ nhớ
const MAX_FAILS = 5; // nhập sai passcode quá số lần này...
const LOCK_MS = 60_000; // ...thì phải chờ 1 phút

export class WorldManager {
  constructor(io, db) {
    this.io = io;
    this.db = db;
    this.active = new Map(); // id -> Game đang chạy
    this.emptySince = new Map();
    this.fails = new Map(); // "ip|server" -> { n, until }
    this.migrateLegacy();
    setInterval(() => this.unloadIdle(), 15_000);
  }

  // Thế giới từ phiên bản cũ (data/world.json) được chuyển thành server đầu tiên.
  migrateLegacy() {
    const legacy = path.join(DATA_DIR, 'world.json');
    if (!fs.existsSync(legacy)) return;
    const { n } = this.db.prepare('SELECT COUNT(*) AS n FROM servers').get();
    if (n > 0) return;
    const passcode = process.env.DEFAULT_PASSCODE || '1234';
    const row = this.create('Thế giới đầu tiên', passcode);
    const world = fs.readFileSync(legacy, 'utf8');
    const day = Math.floor((JSON.parse(world).t ?? 0) / 240) + 1;
    this.db.prepare('UPDATE servers SET world = ?, day = ? WHERE id = ?').run(world, day, row.id);
    fs.renameSync(legacy, `${legacy}.migrated`);
    console.log(`Đã chuyển thế giới cũ thành server "${row.name}" (id: ${row.id}, passcode: ${passcode}).`);
  }

  slug(name) {
    const base = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'server';
    let id = base;
    for (let i = 2; this.db.prepare('SELECT 1 FROM servers WHERE id = ?').get(id); i++) id = `${base}-${i}`;
    return id;
  }

  // Danh sách server. preset: gói thông số (easy / normal / hard, null nếu đã chỉnh riêng) để người chơi biết độ khó;
  // admin xem được thêm toàn bộ thông số.
  list(admin = false) {
    return this.db.prepare('SELECT id, name, day, settings, created_at FROM servers ORDER BY created_at').all().map((r) => {
      const game = this.active.get(r.id);
      const settings = parseSettings(r.settings);
      return {
        id: r.id, name: r.name, day: game ? game.day : r.day, online: game ? game.players.size : 0,
        preset: presetOf(settings), ...(admin && { settings }),
      };
    });
  }

  create(name, passcode, settings) {
    name = String(name ?? '').trim();
    passcode = String(passcode ?? '');
    if (name.length < 1 || name.length > 40) throw new Error('Tên server phải từ 1 đến 40 ký tự.');
    if (passcode.length < 4 || passcode.length > 32) throw new Error('Passcode phải từ 4 đến 32 ký tự.');
    const id = this.slug(name);
    const now = Date.now();
    // Thông số chỉ đặt lúc tạo; update() không đổi được.
    this.db.prepare('INSERT INTO servers (id, name, pass_hash, settings, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, name, hashSecret(passcode), JSON.stringify(sanitizeSettings(settings)), now, now);
    return { id, name };
  }

  update(id, { name, passcode }) {
    if (!this.db.prepare('SELECT 1 FROM servers WHERE id = ?').get(id)) throw new Error('Không tìm thấy server.');
    if (name !== undefined) {
      name = String(name).trim();
      if (name.length < 1 || name.length > 40) throw new Error('Tên server phải từ 1 đến 40 ký tự.');
      this.db.prepare('UPDATE servers SET name = ? WHERE id = ?').run(name, id);
      const game = this.active.get(id);
      if (game) game.name = name;
    }
    if (passcode !== undefined) {
      passcode = String(passcode);
      if (passcode.length < 4 || passcode.length > 32) throw new Error('Passcode phải từ 4 đến 32 ký tự.');
      this.db.prepare('UPDATE servers SET pass_hash = ? WHERE id = ?').run(hashSecret(passcode), id);
    }
  }

  remove(id) {
    const game = this.active.get(id);
    if (game) {
      game.kickAll('Server này đã bị admin xóa.');
      for (const t of game.timers) clearInterval(t); // không lưu nữa
      this.active.delete(id);
    }
    const { changes } = this.db.prepare('DELETE FROM servers WHERE id = ?').run(id);
    if (!changes) throw new Error('Không tìm thấy server.');
  }

  // Lấy thế giới đang chạy, hoặc nạp từ DB.
  load(id) {
    const running = this.active.get(id);
    if (running) return running;
    const row = this.db.prepare('SELECT id, name, world, settings FROM servers WHERE id = ?').get(id);
    if (!row) return null;
    const game = new Game(this.io, {
      id: row.id,
      name: row.name,
      settings: parseSettings(row.settings),
      data: row.world ? JSON.parse(row.world) : null,
      persist: (data, day) => {
        this.db.prepare('UPDATE servers SET world = ?, day = ?, updated_at = ? WHERE id = ?')
          .run(JSON.stringify(data), day, Date.now(), id);
      },
    });
    this.active.set(id, game);
    return game;
  }

  checkPasscode(id, passcode, ip) {
    const key = `${ip}|${id}`;
    const f = this.fails.get(key);
    if (f && f.until > Date.now()) {
      return `Nhập sai quá nhiều lần. Thử lại sau ${Math.ceil((f.until - Date.now()) / 1000)} giây.`;
    }
    const row = this.db.prepare('SELECT pass_hash FROM servers WHERE id = ?').get(id);
    if (!row) return 'Server không tồn tại.';
    if (verifySecret(passcode, row.pass_hash)) {
      this.fails.delete(key);
      return null;
    }
    const n = (f?.n ?? 0) + 1;
    this.fails.set(key, { n: n >= MAX_FAILS ? 0 : n, until: n >= MAX_FAILS ? Date.now() + LOCK_MS : 0 });
    return n >= MAX_FAILS ? 'Nhập sai quá nhiều lần. Thử lại sau 60 giây.' : `Sai passcode (còn ${MAX_FAILS - n} lần thử).`;
  }

  join(socket, data) {
    const id = String(data?.serverId ?? '');
    const error = this.checkPasscode(id, String(data?.passcode ?? ''), socket.handshake.address);
    if (error) return { error };
    const game = this.load(id);
    if (!game) return { error: 'Server không tồn tại.' };
    this.emptySince.delete(id);
    return { game, player: game.join(socket, data?.name, data?.token, data?.char) };
  }

  unloadIdle() {
    const now = Date.now();
    for (const [id, game] of this.active) {
      if (game.players.size > 0) {
        this.emptySince.delete(id);
        continue;
      }
      if (!this.emptySince.has(id)) this.emptySince.set(id, now);
      if (now - this.emptySince.get(id) < UNLOAD_AFTER_MS) continue;
      game.stop();
      this.active.delete(id);
      this.emptySince.delete(id);
      console.log(`Đã lưu và gỡ thế giới "${game.name}" khỏi bộ nhớ (không còn người chơi).`);
    }
  }

  shutdown() {
    for (const game of this.active.values()) game.stop();
  }
}

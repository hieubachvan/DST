// Cơ sở dữ liệu SQLite (dùng node:sqlite có sẵn trong Node, không cần cài thêm).
// Lưu tài khoản admin và các server (thế giới), mỗi server kèm passcode đã hash và dữ liệu thế giới.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');

// ---------- Mật khẩu ----------

export function hashSecret(secret) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(secret), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifySecret(secret, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const a = crypto.scryptSync(String(secret), salt, 64);
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- DB ----------

export function openDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(path.join(DATA_DIR, 'game.db'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS admins (
      username TEXT PRIMARY KEY,
      pass_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pass_hash TEXT NOT NULL,
      day INTEGER NOT NULL DEFAULT 1,
      world TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  return db;
}

// Tài khoản admin lấy từ biến môi trường; nếu không đặt thì dùng mặc định cho máy cá nhân.
export function ensureAdmin(db) {
  const username = process.env.ADMIN_USER || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin@123';
  if (!process.env.ADMIN_PASSWORD) {
    console.warn('⚠ Đang dùng mật khẩu admin mặc định (admin / admin@123). Đặt ADMIN_USER và ADMIN_PASSWORD khi deploy!');
  }
  const row = db.prepare('SELECT pass_hash FROM admins WHERE username = ?').get(username);
  // Cập nhật hash nếu mật khẩu trong biến môi trường đã đổi
  if (!row || !verifySecret(password, row.pass_hash)) {
    db.prepare('INSERT INTO admins (username, pass_hash) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET pass_hash = excluded.pass_hash')
      .run(username, hashSecret(password));
  }
}

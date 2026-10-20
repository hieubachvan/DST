// Cắt các bộ phận nhân vật tự vẽ (Pixilart, mỗi bộ phận một khung 200x200) sát theo nét vẽ,
// đặt tên theo bộ phận để dùng cho hoạt ảnh ghép mảnh (client/src/rig/hero.js).
// Chạy: node tools/crop-hero.mjs  ->  client/public/hero/<tên>.png
//                                   + client/src/rig/hero-parts.js (khung cắt của từng mảnh trên khung Pixilart).
//
// Các bộ phận vẽ cùng tỉ lệ nên giữ nguyên cỡ. Bản có đồ của một bộ phận (tay cầm rìu, đầu đội nón, thân mặc giáp)
// vẽ đúng chỗ bản gốc trên khung, nên cả nhóm được cắt chung một khung (hợp các khung bao): khớp vai / cổ / eo
// nằm cùng một chỗ, đổi đồ chỉ cần đổi ảnh. hero.js đặt khớp theo tọa độ trên khung Pixilart rồi quy đổi.
//
// Góc nhìn chưa vẽ đồ thì tự dựng tạm từ hình đã có (vẽ khung thật rồi thêm vào FRAMES là được thay):
//  - head_back_helmet: phần nón (chỗ khác nhau giữa đầu trước có nón / không nón) đặt lên đầu sau lưng.
//  - torso_back_logsuit: dùng lại giáp mặt trước.
//  - torso_right_logsuit / torso_left_logsuit: lấy vân giáp mặt trước tô vào hình thân nghiêng, giữ nét viền.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const IN = path.join(ROOT, 'pixilart-frames');
const OUT = path.join(ROOT, 'client', 'public', 'hero');
const OUT_JS = path.join(ROOT, 'client', 'src', 'rig', 'hero-parts.js');
const PAD = 1;
const S = 200; // cỡ khung Pixilart

// Tên bộ phận -> số khung Pixilart
const FRAMES = {
  head_front: 0, head_front_helmet: 1,
  head_left: 2, head_left_helmet: 3, head_right_helmet: 4, head_right: 5,
  head_back: 6,
  torso_front: 7, torso_front_logsuit: 8, torso_back: 9, torso_left: 10, torso_right: 11,
  shorts_side: 12, shorts_front: 13,
  arm_a: 14, arm_a_axe: 15, arm_b_axe: 16, arm_a_spear: 17, arm_b_spear: 18, arm_b: 19, // a: tay bên trái khung, b: bên phải
  leg_left: 20, leg_right: 21, // bàn chân chĩa sang trái / phải
};
// Các mảnh cắt chung một khung
const GROUPS = [
  ['head_front', 'head_front_helmet'], ['head_left', 'head_left_helmet'], ['head_right', 'head_right_helmet'],
  ['head_back', 'head_back_helmet'],
  ['torso_front', 'torso_front_logsuit'], ['torso_back', 'torso_back_logsuit'],
  ['torso_left', 'torso_left_logsuit'], ['torso_right', 'torso_right_logsuit'],
  ['arm_a', 'arm_a_axe', 'arm_a_spear'], ['arm_b', 'arm_b_axe', 'arm_b_spear'],
];

const load = (i) => PNG.sync.read(fs.readFileSync(path.join(IN, `pixil-frame-${i}.png`)));
const blank = () => new PNG({ width: S, height: S });
const px = (img, x, y) => img.data.subarray((y * S + x) * 4, (y * S + x) * 4 + 4);
const alpha = (img, x, y) => (x < 0 || y < 0 || x >= S || y >= S ? 0 : img.data[(y * S + x) * 4 + 3]);
const dark = (p) => p[3] > 0 && p[0] + p[1] + p[2] < 120; // nét viền đen

function bbox(img) {
  let x0 = S, y0 = S, x1 = -1, y1 = -1;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (!alpha(img, x, y)) continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

const imgs = Object.fromEntries(Object.entries(FRAMES).map(([name, i]) => [name, load(i)]));

// Nón sau lưng: các điểm của nón = chỗ đầu trước có nón khác đầu trước không nón; đặt giữa đỉnh đầu sau lưng.
{
  const bare = imgs.head_front, hat = imgs.head_front_helmet;
  const mask = blank();
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const a = px(bare, x, y), b = px(hat, x, y);
      if (b[3] && (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2] || a[3] !== b[3])) px(mask, x, y).set(b);
    }
  }
  const hb = bbox(mask), back = bbox(imgs.head_back);
  const dx = Math.round((back.x0 + back.x1) / 2 - (hb.x0 + hb.x1) / 2), dy = back.y0 + 2 - hb.y0;
  const out = blank();
  out.data.set(imgs.head_back.data);
  for (let y = hb.y0; y <= hb.y1; y++) {
    for (let x = hb.x0; x <= hb.x1; x++) {
      const p = px(mask, x, y);
      if (p[3] && x + dx >= 0 && x + dx < S && y + dy >= 0 && y + dy < S) px(out, x + dx, y + dy).set(p);
    }
  }
  imgs.head_back_helmet = out;
}

// Giáp sau lưng: dùng lại giáp mặt trước (vân giáp không có chi tiết trước / sau).
imgs.torso_back_logsuit = imgs.torso_front_logsuit;

// Giáp nghiêng: tô vân giáp (lấy dải giữa của giáp mặt trước) vào trong hình thân nghiêng, giữ nét viền.
for (const side of ['torso_left', 'torso_right']) {
  const body = imgs[side], armor = imgs.torso_front_logsuit;
  const b = bbox(body), ab = bbox(armor);
  const sx0 = ab.x0 + Math.round((ab.x1 - ab.x0) * 0.3), sw = Math.round((ab.x1 - ab.x0) * 0.4);
  const out = blank();
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const p = px(body, x, y);
      if (!p[3]) continue;
      if (dark(p)) { px(out, x, y).set(p); continue; }
      const u = (x - b.x0) / (b.x1 - b.x0 + 1), v = (y - b.y0) / (b.y1 - b.y0 + 1);
      const ax = sx0 + Math.floor(u * sw), ay = ab.y0 + Math.floor(v * (ab.y1 - ab.y0 + 1) * 0.92) + 4;
      const a = px(armor, ax, Math.min(ay, S - 1));
      px(out, x, y).set(a[3] && !dark(a) ? a : [70, 70, 70, 255]);
    }
  }
  imgs[`${side}_logsuit`] = out;
}

// Khung cắt: mảnh riêng lẻ theo khung bao của nó, mảnh trong nhóm theo hợp khung bao của cả nhóm.
const boxes = {};
for (const name of Object.keys(imgs)) boxes[name] = bbox(imgs[name]);
for (const g of GROUPS) {
  const u = g.map((n) => boxes[n]).reduce((a, b) => ({
    x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1),
  }));
  for (const n of g) boxes[n] = u;
}

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png') || f === 'parts.json') fs.unlinkSync(path.join(OUT, f));
const parts = {};
for (const [name, img] of Object.entries(imgs)) {
  const b = boxes[name];
  const x = Math.max(0, b.x0 - PAD), y = Math.max(0, b.y0 - PAD);
  const w = Math.min(S - 1, b.x1 + PAD) - x + 1, h = Math.min(S - 1, b.y1 + PAD) - y + 1;
  const out = new PNG({ width: w, height: h });
  PNG.bitblt(img, out, x, y, w, h, 0, 0);
  fs.writeFileSync(path.join(OUT, `${name}.png`), PNG.sync.write(out));
  parts[name] = { x, y, w, h };
}

const rows = Object.entries(parts).map(([n, p]) => `  ${n}: { x: ${p.x}, y: ${p.y}, w: ${p.w}, h: ${p.h} },`);
fs.writeFileSync(OUT_JS, `// Tạo bởi tools/crop-hero.mjs, đừng sửa tay.
// Khung cắt của từng mảnh nhân vật trên khung vẽ Pixilart 200x200 (ảnh ở client/public/hero/<tên>.png).
export const HERO_PARTS = {
${rows.join('\n')}
};
`);
console.log(`Đã cắt ${Object.keys(parts).length} mảnh vào ${path.relative(ROOT, OUT)}, khung cắt ghi ở ${path.relative(ROOT, OUT_JS)}`);

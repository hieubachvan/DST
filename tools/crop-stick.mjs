// Cắt các mảnh người que (testaction.png: đầu, thân và ba món vũ khí vẽ tay) cho hoạt ảnh ghép mảnh
// (client/src/rig/stick.js). Tay / chân không cắt từ ảnh: chúng có hai khớp (vai-khuỷu, hông-gối) nên
// stick.js tự vẽ từng đoạn cùng nét đen.
// Chạy: node tools/crop-stick.mjs  ->  client/public/stick/<tên>.png + client/src/rig/stick-parts.js
//
// Mỗi mảnh là một vùng nét liền (chọn bằng một điểm trên nét). Phần nằm trong nét (lưỡi kiếm, ruột chùy,
// kể cả mấy vạch rời trong chùy) giữ màu trắng; phần ngoài thành trong suốt, nét của mảnh khác lọt vào khung cũng bị bỏ.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'testaction.png');
const OUT = path.join(ROOT, 'client', 'public', 'stick');
const OUT_JS = path.join(ROOT, 'client', 'src', 'rig', 'stick-parts.js');
const PAD = 2;

// Tên -> { seed: điểm nằm trên nét, pts: các điểm mốc (tọa độ trên testaction.png) để stick.js đặt khớp }
//  grip: chỗ nắm tay; tip: đầu vũ khí (hướng grip -> tip là hướng vũ khí chĩa ra).
const PARTS = {
  head: { seed: [326, 167], pts: { neck: [326, 236] } },
  torso: { seed: [324, 350], pts: { neck: [324, 262], hip: [324, 438] } },
  sword: { seed: [700, 300], pts: { grip: [702, 288], tip: [872, 16] } },
  axe: { seed: [880, 320], pts: { grip: [890, 318], tip: [1102, 36] } },
  mace: { seed: [870, 610], pts: { grip: [892, 598], tip: [1090, 410] } },
};

const src = PNG.sync.read(fs.readFileSync(SRC));
const { width: W, height: H } = src;
const dark = (i) => src.data[i * 4 + 3] > 0 && src.data[i * 4] + src.data[i * 4 + 1] + src.data[i * 4 + 2] < 300;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Loang từ `starts` qua các ô thỏa `ok`, trong khung [x0, x1] x [y0, y1]; trả về mảng đánh dấu.
function flood(starts, ok, x0 = 0, y0 = 0, x1 = W - 1, y1 = H - 1) {
  const seen = new Uint8Array(W * H);
  const stack = [];
  for (const p of starts) if (!seen[p] && ok(p)) { seen[p] = 1; stack.push(p); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % W, y = (p / W) | 0;
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy;
      if (nx < x0 || ny < y0 || nx > x1 || ny > y1) continue;
      const q = ny * W + nx;
      if (!seen[q] && ok(q)) { seen[q] = 1; stack.push(q); }
    }
  }
  return seen;
}

function cropPart(name, { seed, pts }) {
  // điểm seed không trúng nét thì lấy điểm nét gần nhất (trong bán kính 30)
  let s = -1, best = 31 * 31;
  for (let dy = -30; dy <= 30; dy++) {
    for (let dx = -30; dx <= 30; dx++) {
      const p = (seed[1] + dy) * W + seed[0] + dx;
      if (dx * dx + dy * dy < best && dark(p)) { best = dx * dx + dy * dy; s = p; }
    }
  }
  if (s < 0) throw new Error(`${name}: không có nét nào gần điểm seed (${seed})`);
  const line = flood([s], dark);
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let p = 0; p < W * H; p++) {
    if (!line[p]) continue;
    const x = p % W, y = (p / W) | 0;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  x0 = Math.max(0, x0 - PAD); y0 = Math.max(0, y0 - PAD); x1 = Math.min(W - 1, x1 + PAD); y1 = Math.min(H - 1, y1 + PAD);
  // ngoài = loang từ viền khung qua mọi ô không thuộc nét của mảnh này
  const border = [];
  for (let x = x0; x <= x1; x++) border.push(y0 * W + x, y1 * W + x);
  for (let y = y0; y <= y1; y++) border.push(y * W + x0, y * W + x1);
  const outside = flood(border, (p) => !line[p], x0, y0, x1, y1);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y + y0) * W + x + x0, o = (y * w + x) * 4;
      if (outside[p]) continue;
      const v = dark(p) ? 0 : 255;
      out.data[o] = out.data[o + 1] = out.data[o + 2] = v;
      out.data[o + 3] = 255;
    }
  }
  // điểm mốc đổi sang tọa độ trong ảnh đã cắt
  const rel = Object.fromEntries(Object.entries(pts).map(([k, [px, py]]) => [k, [px - x0, py - y0]]));
  if (rel.grip && rel.tip) return upright(name, out, rel);
  fs.writeFileSync(path.join(OUT, `${name}.png`), PNG.sync.write(out));
  return { w, h, ...rel };
}

// Vũ khí: xoay ảnh cho đầu vũ khí nằm thẳng phía trên chỗ nắm, để co ngắn (sy) là co dọc theo thân vũ khí
// (vung về phía người xem khi nhìn thẳng / nhìn lưng).
function upright(name, img, { grip, tip }) {
  const len = Math.hypot(tip[0] - grip[0], tip[1] - grip[1]);
  const d = [(grip[0] - tip[0]) / len, (grip[1] - tip[1]) / len]; // đầu -> chỗ nắm: trục y ảnh mới
  const e = [d[1], -d[0]]; // trục x ảnh mới
  const at = (x, y) => (x < 0 || y < 0 || x >= img.width || y >= img.height ? null : img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));
  // khung bao sau khi xoay (tính quanh chỗ nắm)
  let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (!at(x, y)[3]) continue;
      const px = x - grip[0], py = y - grip[1];
      const u = px * e[0] + py * e[1], v = px * d[0] + py * d[1];
      u0 = Math.min(u0, u); v0 = Math.min(v0, v); u1 = Math.max(u1, u); v1 = Math.max(v1, v);
    }
  }
  const w = Math.ceil(u1 - u0) + 2 * PAD + 1, h = Math.ceil(v1 - v0) + 2 * PAD + 1;
  const gu = PAD - u0, gv = PAD - v0; // chỗ nắm trong ảnh mới
  const out = new PNG({ width: w, height: h });
  // lấy mẫu 2x2 trong mỗi điểm ảnh mới cho mịn cạnh
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, a = 0;
      for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const u = x + ox - gu, v = y + oy - gv;
        const p = at(Math.floor(grip[0] + u * e[0] + v * d[0]), Math.floor(grip[1] + u * e[1] + v * d[1]));
        if (!p || !p[3]) continue;
        r += p[0];
        a++;
      }
      if (!a) continue;
      const o = (y * w + x) * 4;
      out.data[o] = out.data[o + 1] = out.data[o + 2] = r / a;
      out.data[o + 3] = (a / 4) * 255;
    }
  }
  fs.writeFileSync(path.join(OUT, `${name}.png`), PNG.sync.write(out));
  const r1 = (v) => Math.round(v * 10) / 10;
  return { w, h, grip: [r1(gu), r1(gv)], tip: [r1(gu), r1(gv - len)] };
}

fs.mkdirSync(OUT, { recursive: true });
const info = Object.fromEntries(Object.entries(PARTS).map(([name, def]) => [name, cropPart(name, def)]));
const fmt = (v) => `{ ${Object.entries(v).map(([k, x]) => `${k}: ${Array.isArray(x) ? `[${x.join(', ')}]` : x}`).join(', ')} }`;
const body = Object.entries(info).map(([k, v]) => `  ${k}: ${fmt(v)},`).join('\n');
fs.writeFileSync(OUT_JS, `// Tạo bởi tools/crop-stick.mjs, đừng sửa tay.
// Cỡ ảnh và các điểm mốc (pixel, trong ảnh đã cắt) của mảnh người que ở client/public/stick/<tên>.png.
export const STICK_PARTS = {
${body}
};
`);
console.log(info);

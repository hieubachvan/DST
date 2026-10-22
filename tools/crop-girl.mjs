// Cắt nhân vật cô bé từ bảng thiết kế girl.jpeg cho hoạt ảnh ghép mảnh (client/src/rig/girl.js, chung khung xương
// với người que / lợn: tay / chân hai khớp).
// Chạy: node tools/crop-girl.mjs  ->  client/public/girl/<tên>.png + client/src/rig/girl-parts.js
//
// Bảng vẽ sẵn từng mảnh rời nhau nên chỉ cần cắt theo khung:
//  - đầu: nhìn thẳng (head, head_sad, head_angry là ba nét mặt), nhìn lưng (head_back), nhìn nghiêng sang phải (head_side)
//  - dress: váy (dùng cho cả 3 góc nhìn)
//  - upper / fore: bắp tay và cẳng tay (liền bàn tay) bên trái bảng; xoay cho trục khớp -> khớp thẳng đứng
//  - thigh / shin: chân bên trái bảng cắt đôi ở vạch ngang giữa tất và cẳng chân (shin liền giày). Giày vẽ mũi
//    chĩa sang trái nên lật ngang cho mũi chĩa sang phải như các mảnh nhìn ngang khác.
//
// Nền trắng thành trong suốt (loang từ viền khung qua các điểm gần trắng); mặt trắng có viền kín nên giữ nguyên.
// Mọi tọa độ dưới đây là pixel trên girl.jpeg (2480x3508).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'girl.jpeg');
const OUT = path.join(ROOT, 'client', 'public', 'girl');
const OUT_JS = path.join(ROOT, 'client', 'src', 'rig', 'girl-parts.js');

// Đầu: khung và khớp cổ (dưới cằm; nhìn nghiêng thì giữa tai và cằm).
const HEADS = {
  head: { box: [70, 575, 445, 830], neck: [245, 800] },
  head_sad: { box: [506, 574, 881, 830], neck: [688, 800] },
  head_angry: { box: [945, 582, 1320, 826], neck: [1118, 798] },
  head_back: { box: [1442, 570, 1817, 814], neck: [1630, 795] },
  head_side: { box: [1860, 547, 2217, 786], neck: [2070, 765] },
};
// Váy: neck là đỉnh (chỗ gắn đầu), hip là eo (giữa hai chân, trong váy, gấu váy che đầu đùi),
// shoulder là vai bên trái bảng khi nhìn thẳng, shoulderSide là vai khi nhìn ngang (giữa thân).
const DRESS = { box: [94, 868, 380, 1234], neck: [240, 885], hip: [240, 1195], shoulder: [168, 950], shoulderSide: [240, 950] };
// Tay / chân: [khớp trên, khớp giữa, điểm cuối] — tay là hai mảnh rời (box từng mảnh), chân một mảnh cắt đôi ở khớp giữa.
const ARM = {
  upper: { box: [45, 870, 118, 987], a: [97, 893], b: [66, 968] },
  fore: { box: [11, 976, 75, 1085], a: [57, 992], b: [42, 1048] },
};
const LEG = { box: [131, 1258, 199, 1402], pts: [[170, 1268], [170, 1327], [170, 1372]], cap: 6, names: ['thigh', 'shin'], flip: true };

const src = jpeg.decode(fs.readFileSync(SRC), { maxMemoryUsageInMB: 1024 });
const W = src.width;
const at = (x, y) => (y * W + x) * 4;
const nearWhite = (x, y) => {
  const i = at(x, y), r = src.data[i], g = src.data[i + 1], b = src.data[i + 2];
  return Math.min(r, g, b) > 215 && Math.max(r, g, b) - Math.min(r, g, b) < 28;
};

// Ảnh RGBA của khung box (tọa độ girl.jpeg), nền đã trong suốt.
function cutout([x0, y0, x1, y1]) {
  const w = x1 - x0, h = y1 - y0;
  const img = { x0, y0, w, h, data: new Uint8ClampedArray(w * h * 4) };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) img.data.set(src.data.subarray(at(x + x0, y + y0), at(x + x0, y + y0) + 4), (y * w + x) * 4);
  const seen = new Uint8Array(w * h), stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h || seen[y * w + x] || !nearWhite(x + x0, y + y0)) return;
    seen[y * w + x] = 1;
    stack.push(y * w + x);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop(), x = p % w, y = (p / w) | 0;
    img.data[p * 4 + 3] = 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  return img;
}

// Chỉ giữ khối điểm không trong suốt liền nhau lớn nhất.
function keepLargest(img) {
  const { w, h, data } = img;
  const label = new Int32Array(w * h).fill(-1);
  const sizes = [];
  for (let s = 0; s < w * h; s++) {
    if (label[s] >= 0 || !data[s * 4 + 3]) continue;
    const id = sizes.length, stack = [s];
    label[s] = id;
    let n = 0;
    while (stack.length) {
      const p = stack.pop(), x = p % w, y = (p / w) | 0;
      n++;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        const q = ny * w + nx;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && label[q] < 0 && data[q * 4 + 3]) { label[q] = id; stack.push(q); }
      }
    }
    sizes.push(n);
  }
  const best = sizes.indexOf(Math.max(...sizes));
  for (let p = 0; p < w * h; p++) if (label[p] !== best) data[p * 4 + 3] = 0;
}

// Cắt sát phần không trong suốt.
function trim(img) {
  let a = img.w, b = img.h, c = -1, d = -1;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (!img.data[(y * img.w + x) * 4 + 3]) continue;
      a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y);
    }
  }
  const w = c - a + 1, h = d - b + 1, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) data.set(img.data.subarray(((y + b) * img.w + a) * 4, ((y + b) * img.w + a + w) * 4), y * w * 4);
  return { x0: img.x0 + a, y0: img.y0 + b, w, h, data };
}

function write(name, img) {
  const png = new PNG({ width: img.w, height: img.h });
  png.data = Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength);
  fs.writeFileSync(path.join(OUT, `${name}.png`), PNG.sync.write(png));
}

// Mảnh cắt theo khung, điểm mốc points (tọa độ girl.jpeg) quy về tọa độ trong ảnh đã cắt.
function piece(name, box, points) {
  const img = cutout(box);
  keepLargest(img);
  const out = trim(img);
  write(name, out);
  return { w: out.w, h: out.h, ...Object.fromEntries(Object.entries(points).map(([k, [x, y]]) => [k, [x - out.x0, y - out.y0]])) };
}

// Một đoạn tay / chân: lấy các điểm thuộc `keep` của ảnh, xoay để a -> b chĩa thẳng xuống.
// Trả về ảnh mới, khớp a nằm ở (pivot) và độ dài đoạn.
function segment(img, keep, a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]; // trục đoạn -> trục y ảnh mới
  const e = [d[1], -d[0]]; // -> trục x ảnh mới
  let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (!img.data[(y * img.w + x) * 4 + 3] || !keep(x + img.x0, y + img.y0)) continue;
      const px = x + img.x0 - a[0], py = y + img.y0 - a[1];
      const u = px * e[0] + py * e[1], v = px * d[0] + py * d[1];
      u0 = Math.min(u0, u); v0 = Math.min(v0, v); u1 = Math.max(u1, u); v1 = Math.max(v1, v);
    }
  }
  const pad = 2;
  const w = Math.ceil(u1 - u0) + pad * 2 + 1, h = Math.ceil(v1 - v0) + pad * 2 + 1;
  const data = new Uint8ClampedArray(w * h * 4);
  const pu = pad - u0, pv = pad - v0; // vị trí khớp a trong ảnh mới
  const sample = (x, y) => {
    const xi = Math.round(x), yi = Math.round(y);
    if (xi < img.x0 || yi < img.y0 || xi >= img.x0 + img.w || yi >= img.y0 + img.h || !keep(xi, yi)) return null;
    const i = ((yi - img.y0) * img.w + (xi - img.x0)) * 4;
    return img.data[i + 3] ? img.data.subarray(i, i + 4) : null;
  };
  // lấy mẫu 2x2 trong mỗi điểm ảnh mới cho mịn cạnh
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const acc = [0, 0, 0, 0];
      for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const u = x + ox - pu, v = y + oy - pv;
        const p = sample(a[0] + u * e[0] + v * d[0], a[1] + u * e[1] + v * d[1]);
        if (!p) continue;
        for (let c = 0; c < 3; c++) acc[c] += p[c] * p[3];
        acc[3] += p[3];
      }
      if (!acc[3]) continue;
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) data[o + c] = acc[c] / acc[3];
      data[o + 3] = acc[3] / 4;
    }
  }
  return { img: { w, h, data }, pivot: [pu, pv], len };
}

// Lật ngang một đoạn (ảnh và điểm neo).
function mirror(s) {
  const { w, h, data } = s.img, out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.set(data.subarray((y * w + x) * 4, (y * w + x) * 4 + 4), (y * w + (w - 1 - x)) * 4);
  return { img: { w, h, data: out }, pivot: [w - s.pivot[0], s.pivot[1]], len: s.len };
}

const segInfo = (name, s) => {
  write(name, s.img);
  return { [name]: { w: s.img.w, h: s.img.h, joint: s.pivot.map((v) => +v.toFixed(1)), len: +s.len.toFixed(1) } };
};

function makeArm() {
  const info = {};
  for (const [name, { box, a, b }] of Object.entries(ARM)) {
    const img = cutout(box);
    keepLargest(img);
    Object.assign(info, segInfo(name, segment(img, () => true, a, b)));
  }
  return info;
}

function makeLeg({ box, pts: [a, m, b], cap, names, flip }) {
  const img = cutout(box);
  keepLargest(img);
  // đường cắt ngang qua khớp giữa (chân vẽ thẳng đứng); mảnh trên giữ nắp quanh khớp để che chỗ nối khi gập
  const top = segment(img, (x, y) => y < m[1] || Math.hypot(x - m[0], y - m[1]) < cap, a, m);
  const bottom = segment(img, (x, y) => y > m[1] - 3, m, b);
  const f = flip ? mirror : (s) => s;
  return { ...segInfo(names[0], f(top)), ...segInfo(names[1], f(bottom)) };
}

fs.mkdirSync(OUT, { recursive: true });
const info = {
  ...Object.fromEntries(Object.entries(HEADS).map(([name, { box, neck }]) => [name, piece(name, box, { neck })])),
  dress: piece('dress', DRESS.box, { neck: DRESS.neck, hip: DRESS.hip, shoulder: DRESS.shoulder, shoulderSide: DRESS.shoulderSide }),
  ...makeArm(),
  ...makeLeg(LEG),
};
const fmt = (v) => `{ ${Object.entries(v).map(([k, x]) => `${k}: ${Array.isArray(x) ? `[${x.join(', ')}]` : x}`).join(', ')} }`;
fs.writeFileSync(OUT_JS, `// Tạo bởi tools/crop-girl.mjs, đừng sửa tay.
// Cỡ ảnh và điểm mốc (pixel, trong ảnh đã cắt) của mảnh nhân vật cô bé ở client/public/girl/<tên>.png.
// head*: neck là khớp cổ; dress: neck / hip / shoulder (vai trái khi nhìn thẳng) / shoulderSide (vai khi nhìn ngang);
// tay / chân: joint là khớp trên, len là độ dài tới khớp dưới.
export const GIRL_PARTS = {
${Object.entries(info).map(([k, v]) => `  ${k}: ${fmt(v)},`).join('\n')}
};
`);
console.log(info);

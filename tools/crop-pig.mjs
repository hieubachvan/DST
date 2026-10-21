// Cắt nhân vật lợn từ bảng thiết kế lon.png cho hoạt ảnh ghép mảnh (client/src/rig/pig.js, chung khung xương
// với người que: tay / chân hai khớp).
// Chạy: node tools/crop-pig.mjs  ->  client/public/pig/<tên>.png + client/src/rig/pig-parts.js
//
//  - body: hình "Bên phải" (nhìn ngang, quay sang phải), bỏ phần chân thò dưới váy (chân ghép riêng).
//    Hình gốc vẽ tay dính liền thân, nên vùng tay được xóa: phần trên váy tô lại bằng màu da loang từ xung quanh
//    (cộng chút nhiễu cho giống nét cọ), phần trong váy chép váy từ bên cạnh sang.
//  - upper / fore: mảnh "Tay trái" cắt đôi ở khuỷu; thigh / shin: mảnh "Chân phải" cắt đôi ở gối.
//    Mảnh trên giữ một nắp tròn quanh khớp để che chỗ nối khi gập. Mỗi mảnh được xoay cho trục khớp -> khớp
//    thẳng đứng (như đoạn tay / chân người que) và thu nhỏ cho hợp cỡ thân.
//
// Nền trắng của bảng thành trong suốt (loang từ viền khung qua các điểm gần trắng).
// Mọi tọa độ dưới đây là pixel trên lon.png.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'lon.png');
const OUT = path.join(ROOT, 'client', 'public', 'pig');
const OUT_JS = path.join(ROOT, 'client', 'src', 'rig', 'pig-parts.js');

const BODY = {
  box: [1090, 78, 1300, 360],
  cutY: 334, // bỏ phần dưới đường này (chân thò dưới váy)
  hip: [1176, 314], // giữa hai chân, trong váy
  shoulder: [1186, 236],
  // vùng tay dính trên thân (trên mép váy) -> tô lại bằng màu da
  arm: [[1146, 226], [1168, 218], [1206, 220], [1226, 240], [1227, 296], [1180, 296], [1160, 262]],
  // vùng móng tay đè lên váy -> chép váy lệch sang trái skirtShift pixel
  skirt: [1178, 294, 1222, 340], skirtShift: 50,
  texShift: [-62, -50], // vùng lưng lấy vân da (lệch so với vùng tay)
};
// Thân nhìn thẳng / nhìn lưng: tay hai bên nằm ngoài viền thân nên chỉ cần cắt bỏ theo đường viền trong của tay
// (cut: các vùng bỏ đi), chân dưới váy bỏ như thân nghiêng. Vai: khớp vai bên trái màn hình (bên phải đối xứng qua eo).
const FACING = {
  front: {
    box: [20, 90, 250, 370], cutY: 330, hip: [132, 322], shoulder: [48, 224],
    cut: [
      [[18, 210], [53, 210], [58, 232], [79, 308], [76, 328], [76, 372], [18, 372]],
      [[252, 210], [212, 210], [208, 232], [187, 308], [189, 328], [189, 372], [252, 372]],
    ],
  },
  back: {
    box: [660, 85, 885, 365], cutY: 325, hip: [769, 318], shoulder: [686, 232],
    cut: [
      [[658, 223], [695, 223], [697, 230], [715, 320], [715, 367], [658, 367]],
      [[887, 223], [840, 223], [838, 230], [822, 320], [822, 367], [887, 367]],
    ],
  },
};
// Tay / chân: [điểm khớp trên, khớp giữa, điểm cuối], bán kính nắp ở khớp giữa, tỉ lệ thu nhỏ
const LIMBS = {
  arm: { box: [40, 470, 185, 645], pts: [[84, 494], [92, 548], [147, 612]], cap: 26, scale: 0.72, names: ['upper', 'fore'] },
  leg: { box: [560, 495, 665, 640], pts: [[613, 514], [613, 560], [613, 614]], cap: 32, scale: 0.5, names: ['thigh', 'shin'] },
};

const src = PNG.sync.read(fs.readFileSync(SRC));
const W = src.width;
const at = (x, y) => (y * W + x) * 4;
const nearWhite = (x, y) => {
  const i = at(x, y), r = src.data[i], g = src.data[i + 1], b = src.data[i + 2];
  return Math.min(r, g, b) > 212 && Math.max(r, g, b) - Math.min(r, g, b) < 28;
};

// Ảnh RGBA của khung box (tọa độ lon.png), nền đã trong suốt.
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

const inPoly = (poly, x, y) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

// Hạt ngẫu nhiên cố định (mỗi lần chạy ra cùng một ảnh).
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function makeBody() {
  const img = cutout(BODY.box);
  const { x0, y0, w, h, data } = img;
  const idx = (x, y) => ((y - y0) * w + (x - x0)) * 4;
  // váy: chép từ bên trái sang chỗ móng tay
  const [sx0, sy0, sx1, sy1] = BODY.skirt;
  for (let y = sy0; y < sy1; y++) for (let x = sx0; x < sx1; x++) data.set(data.slice(idx(x - BODY.skirtShift, y), idx(x - BODY.skirtShift, y) + 4), idx(x, y));
  // tay: vùng xóa gồm cả nét đen sát mép vùng (đường viền tay còn sót), để không loang màu đen vào trong
  const lum = (x, y) => { const i = idx(x, y); return (data[i] + data[i + 1] + data[i + 2]) / 3; };
  const isHole = (x, y) => inPoly(BODY.arm, x, y) || (y < BODY.skirt[1] && lum(x, y) < 110 &&
    [[-5, 0], [5, 0], [0, -5], [0, 5]].some(([dx, dy]) => inPoly(BODY.arm, x + dx, y + dy)));
  const hole = [];
  for (let y = y0 + 1; y < y0 + h - 1; y++) for (let x = x0 + 1; x < x0 + w - 1; x++) if (isHole(x, y)) hole.push([x, y]);
  const holeSet = new Set(hole.map(([x, y]) => y * W + x));
  // màu nền: loang từ viền vào trong (lặp trung bình các điểm bên cạnh không phải nét đen)
  const avg = [0, 0, 0];
  for (const [x, y] of hole) for (let c = 0; c < 3; c++) avg[c] += data[idx(x, y) + c] / hole.length;
  for (const [x, y] of hole) for (let c = 0; c < 3; c++) data[idx(x, y) + c] = avg[c];
  for (let it = 0; it < 800; it++) {
    for (const [x, y] of hole) {
      let n = 0;
      const acc = [0, 0, 0];
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (!holeSet.has(ny * W + nx) && lum(nx, ny) < 110) continue; // nét đen bên ngoài vùng: bỏ qua
        for (let c = 0; c < 3; c++) acc[c] += data[idx(nx, ny) + c];
        n++;
      }
      if (n) for (let c = 0; c < 3; c++) data[idx(x, y) + c] = acc[c] / n;
    }
  }
  // vân da: lấy chi tiết (điểm ảnh trừ trung bình quanh nó) từ một vùng lưng cách TEX lệch, cộng vào màu nền
  const [tx, ty] = BODY.texShift;
  const box = (x, y, r) => {
    const acc = [0, 0, 0];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) for (let c = 0; c < 3; c++) acc[c] += src.data[at(x + dx, y + dy) + c];
    return acc.map((v) => v / (2 * r + 1) ** 2);
  };
  for (const [x, y] of hole) {
    const rx = x + tx, ry = y + ty, mean = box(rx, ry, 4);
    const rl = (src.data[at(rx, ry)] + src.data[at(rx, ry) + 1] + src.data[at(rx, ry) + 2]) / 3;
    if (rl > 215 || mean.some((v) => v > 215)) continue; // lấy nhầm ra nền trắng ngoài thân
    for (let c = 0; c < 3; c++) data[idx(x, y) + c] += Math.max(-25, Math.min(25, src.data[at(rx, ry) + c] - mean[c])) + (rand() - 0.5) * 4;
  }
  // bỏ chân thò dưới váy
  for (let y = BODY.cutY; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) data[idx(x, y) + 3] = 0;
  keepLargest(img); // bỏ nét của hình bên cạnh lọt vào khung
  const out = trim(img);
  write('body', out);
  const rel = ([x, y]) => [x - out.x0, y - out.y0];
  return { w: out.w, h: out.h, hip: rel(BODY.hip), shoulder: rel(BODY.shoulder) };
}

function makeFacing(name, { box, cutY, hip, shoulder, cut }) {
  const img = cutout(box);
  const { x0, y0, w, h, data } = img;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (y >= cutY || cut.some((poly) => inPoly(poly, x, y))) data[((y - y0) * w + (x - x0)) * 4 + 3] = 0;
    }
  }
  keepLargest(img);
  const out = trim(img);
  write(name, out);
  const rel = ([x, y]) => [x - out.x0, y - out.y0];
  return { w: out.w, h: out.h, hip: rel(hip), shoulder: rel(shoulder) };
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

// Một đoạn tay / chân: lấy các điểm thuộc `keep` của ảnh, xoay để a -> b chĩa thẳng xuống, thu nhỏ theo scale.
// Trả về ảnh mới, khớp a nằm ở (pivot) và độ dài đoạn (đã thu nhỏ).
function segment(img, keep, a, b, scale) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]; // trục đoạn -> trục y ảnh mới
  const e = [d[1], -d[0]]; // -> trục x ảnh mới
  // khung bao sau khi xoay
  let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (!img.data[(y * img.w + x) * 4 + 3] || !keep(x + img.x0, y + img.y0)) continue;
      const px = x + img.x0 - a[0], py = y + img.y0 - a[1];
      const u = (px * e[0] + py * e[1]) * scale, v = (px * d[0] + py * d[1]) * scale;
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
        const u = (x + ox - pu) / scale, v = (y + oy - pv) / scale;
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
  return { img: { w, h, data }, pivot: [pu, pv], len: len * scale };
}

function makeLimb({ box, pts: [a, m, b], cap, scale, names }) {
  const img = cutout(box);
  // đường cắt qua khớp giữa, vuông góc với phân giác hai đoạn
  const unit = (p, q) => { const l = Math.hypot(q[0] - p[0], q[1] - p[1]); return [(q[0] - p[0]) / l, (q[1] - p[1]) / l]; };
  const d1 = unit(a, m), d2 = unit(m, b);
  const n = [d1[0] + d2[0], d1[1] + d2[1]];
  const side = (x, y) => (x - m[0]) * n[0] + (y - m[1]) * n[1];
  const top = segment(img, (x, y) => side(x, y) < 0 || Math.hypot(x - m[0], y - m[1]) < cap, a, m, scale);
  const bottom = segment(img, (x, y) => side(x, y) > -3, m, b, scale);
  const info = {};
  for (const [name, s] of [[names[0], top], [names[1], bottom]]) {
    write(name, s.img);
    info[name] = { w: s.img.w, h: s.img.h, joint: s.pivot.map((v) => +v.toFixed(1)), len: +s.len.toFixed(1) };
  }
  return info;
}

fs.mkdirSync(OUT, { recursive: true });
const info = {
  body: makeBody(), body_front: makeFacing('body_front', FACING.front), body_back: makeFacing('body_back', FACING.back),
  ...makeLimb(LIMBS.arm), ...makeLimb(LIMBS.leg),
};
const fmt = (v) => `{ ${Object.entries(v).map(([k, x]) => `${k}: ${Array.isArray(x) ? `[${x.join(', ')}]` : x}`).join(', ')} }`;
fs.writeFileSync(OUT_JS, `// Tạo bởi tools/crop-pig.mjs, đừng sửa tay.
// Cỡ ảnh và điểm mốc (pixel, trong ảnh đã cắt) của mảnh nhân vật lợn ở client/public/pig/<tên>.png.
// body: hip / shoulder là khớp hông / vai; tay / chân: joint là khớp trên, len là độ dài tới khớp dưới.
export const PIG_PARTS = {
${Object.entries(info).map(([k, v]) => `  ${k}: ${fmt(v)},`).join('\n')}
};
`);
console.log(info);

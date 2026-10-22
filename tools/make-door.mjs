// Tạo hình Cửa gỗ từ door.png (cửa gỗ trong vòm đá, nhìn thẳng) cho tường đá.
// Chạy: node tools/make-door.mjs  ->  assets/door.png (icon 64x64), assets/door_closed.png, assets/door_open.png
// rồi npm run sprites để chép vào client/public/sprites.
//
//  - Nền trắng thành trong suốt (loang từ viền ảnh qua các điểm gần trắng).
//  - door_open: lòng vòm (OPENING) tô tối, cánh cửa ép hẹp còn SWING px sát bản lề bên phải, như đã mở vào trong.
//  - Hình ngoài thế giới thu nhỏ sẵn còn rộng OUT_W (gấp 3 cỡ hiển thị 42px của một ô tường) bằng cách lấy trung bình
//    điểm ảnh, để game chỉ phải thu nhỏ thêm 3 lần, nét không bị răng cưa.
// Mọi tọa độ dưới đây là pixel trên door.png (556x740).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'door.png');
const OUT = path.join(ROOT, 'assets');

// Lòng vòm (cánh cửa): chữ nhật dưới + nửa hình tròn trên.
const OPENING = { x0: 118, x1: 442, y0: 255, y1: 722, cx: 280, cy: 255, r: 162 };
const SWING = 34; // bề rộng cánh cửa khi mở (ép từ cả cánh về sát mép phải)
const DARK = [35, 26, 18]; // màu lòng cửa khi mở
const OUT_W = 126;
const ICON = 64;

const src = PNG.sync.read(fs.readFileSync(SRC));
const { width: W, height: H } = src;

const inOpening = (x, y) => {
  const o = OPENING;
  if (x < o.x0 || x > o.x1 || y > o.y1) return false;
  return y >= o.cy || Math.hypot(x - o.cx, y - o.cy) <= o.r;
};

// Nền trắng -> trong suốt.
function clearBackground(data) {
  const white = (k) => {
    const i = k * 4, lo = Math.min(data[i], data[i + 1], data[i + 2]), hi = Math.max(data[i], data[i + 1], data[i + 2]);
    return lo > 225 && hi - lo < 25;
  };
  const seen = new Uint8Array(W * H), stack = [];
  const push = (k) => { if (!seen[k] && white(k)) { seen[k] = 1; stack.push(k); } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (stack.length) {
    const k = stack.pop(), x = k % W;
    data[k * 4 + 3] = 0;
    if (x > 0) push(k - 1);
    if (x < W - 1) push(k + 1);
    if (k >= W) push(k - W);
    if (k < W * (H - 1)) push(k + W);
  }
}

function openDoor(closed) {
  const data = Buffer.from(closed);
  const o = OPENING, wide = o.x1 - o.x0;
  for (let y = 0; y < H; y++) {
    for (let x = o.x0; x <= o.x1; x++) {
      if (!inOpening(x, y)) continue;
      const i = (y * W + x) * 4;
      const t = x - (o.x1 - SWING); // trong dải cánh cửa sát bản lề
      if (t >= 0) {
        // cánh cửa: cả bề rộng ép vào SWING px, tối đi một chút vì quay vào trong
        const sx = Math.round(o.x0 + (t / SWING) * wide);
        const j = (y * W + sx) * 4;
        if (inOpening(sx, y)) {
          for (let c = 0; c < 3; c++) data[i + c] = closed[j + c] * 0.72;
          data[i + 3] = 255;
          continue;
        }
      }
      // lòng cửa: tối dần về phía trên cho có chiều sâu
      const k = 0.75 + 0.25 * ((y - (o.cy - o.r)) / (o.y1 - (o.cy - o.r)));
      for (let c = 0; c < 3; c++) data[i + c] = DARK[c] * k;
      data[i + 3] = 255;
    }
  }
  return data;
}

// Thu nhỏ theo tỉ lệ k (< 1) bằng trung bình các điểm ảnh rơi vào mỗi điểm mới (có tính alpha).
function shrink(data, w, h, k) {
  const ow = Math.round(w * k), oh = Math.round(h * k);
  const out = Buffer.alloc(ow * oh * 4);
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      const sx0 = Math.floor(x / k), sx1 = Math.min(w, Math.floor((x + 1) / k));
      const sy0 = Math.floor(y / k), sy1 = Math.min(h, Math.floor((y + 1) / k));
      const acc = [0, 0, 0, 0];
      let n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const i = (sy * w + sx) * 4, a = data[i + 3];
          for (let c = 0; c < 3; c++) acc[c] += data[i + c] * a;
          acc[3] += a;
          n++;
        }
      }
      const o = (y * ow + x) * 4;
      if (acc[3]) for (let c = 0; c < 3; c++) out[o + c] = acc[c] / acc[3];
      out[o + 3] = n ? acc[3] / n : 0;
    }
  }
  return { data: out, w: ow, h: oh };
}

function write(name, { data, w, h }) {
  const png = new PNG({ width: w, height: h });
  data.copy(png.data);
  fs.writeFileSync(path.join(OUT, `${name}.png`), PNG.sync.write(png));
  console.log(`${name}.png ${w}x${h}`);
}

// Đặt ảnh vào giữa khung vuông size x size (icon).
function square({ data, w, h }, size) {
  const out = Buffer.alloc(size * size * 4), ox = (size - w) >> 1, oy = (size - h) >> 1;
  for (let y = 0; y < h; y++) data.copy(out, ((y + oy) * size + ox) * 4, y * w * 4, (y + 1) * w * 4);
  return { data: out, w: size, h: size };
}

const closed = Buffer.from(src.data);
clearBackground(closed);
write('door_closed', shrink(closed, W, H, OUT_W / W));
write('door_open', shrink(openDoor(closed), W, H, OUT_W / W));
write('door', square(shrink(closed, W, H, ICON / H), ICON));

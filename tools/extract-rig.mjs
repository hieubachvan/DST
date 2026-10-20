// Tách các bộ phận rời (đầu, thân, tay, chân...) từ một tấm hình bộ phận có nền trong suốt,
// dùng cho hoạt ảnh ghép mảnh (rig). Chạy: node tools/extract-rig.mjs [ảnh vào] [tên]
// Mặc định: Bearger.png ở thư mục gốc -> client/public/rig/bearger/p<số>.png + parts.json.
//
// Mỗi cụm điểm đục (alpha > SOLID) liền nhau là một mảnh; mảnh nhỏ hơn MIN_PX bị bỏ (vụn lông).
// Cắt theo khung bao, nới PAD điểm để lấy cả sợi lông mờ ở mép, nhưng xóa điểm thuộc mảnh khác.
// Lưu ý: tấm Bearger.png là hình gốc của game Don't Starve (Klei), chỉ dùng thử trên máy,
// các file sinh ra nằm trong .gitignore để không bị commit / deploy.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = path.resolve(ROOT, process.argv[2] ?? 'Bearger.png');
const name = process.argv[3] ?? 'bearger';
const OUT = path.join(ROOT, 'client', 'public', 'rig', name);
const SOLID = 60;
const MIN_PX = 600;
const PAD = 4;

const src = PNG.sync.read(fs.readFileSync(input));
const { width: W, height: H, data: d } = src;
const lab = new Int32Array(W * H);
const boxes = [];
for (let k = 0; k < W * H; k++) {
  if (d[k * 4 + 3] <= SOLID || lab[k]) continue;
  const id = boxes.length + 1;
  let x0 = W, y0 = H, x1 = 0, y1 = 0, n = 0;
  const st = [k];
  lab[k] = id;
  while (st.length) {
    const j = st.pop();
    n++;
    const x = j % W, y = (j / W) | 0;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    for (const m of [j - 1, j + 1, j - W, j + W]) {
      if (m < 0 || m >= W * H || lab[m] || d[m * 4 + 3] <= SOLID) continue;
      if ((m === j - 1 && x === 0) || (m === j + 1 && x === W - 1)) continue;
      lab[m] = id;
      st.push(m);
    }
  }
  boxes.push({ id, x0, y0, x1, y1, n });
}
// Thứ tự: theo hàng (mỗi hàng ~120px) rồi từ trái sang phải, để số thứ tự ổn định giữa các lần chạy.
const parts = boxes.filter((b) => b.n >= MIN_PX)
  .sort((a, b) => (Math.round(a.y0 / 120) - Math.round(b.y0 / 120)) || a.x0 - b.x0);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const manifest = {};
parts.forEach((b, i) => {
  const x0 = Math.max(0, b.x0 - PAD), y0 = Math.max(0, b.y0 - PAD);
  const x1 = Math.min(W - 1, b.x1 + PAD), y1 = Math.min(H - 1, b.y1 + PAD);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = (y0 + y) * W + x0 + x;
      if (lab[k] && lab[k] !== b.id) continue; // điểm của mảnh khác
      d.copy(out.data, (y * w + x) * 4, k * 4, k * 4 + 4);
    }
  }
  const key = `p${i}`;
  fs.writeFileSync(path.join(OUT, `${key}.png`), PNG.sync.write(out));
  manifest[key] = { w, h, x: x0, y: y0 };
});
fs.writeFileSync(path.join(OUT, 'parts.json'), JSON.stringify(manifest, null, 1));
console.log(`Đã tách ${parts.length} mảnh vào ${path.relative(ROOT, OUT)}`);

// Ghép các khung PNG rời (cùng cỡ, nền trong suốt) thành spritesheet một hàng ngang cho Phaser.
// Chạy: node tools/frames-to-sheet.mjs khoi client/public/sprites/smoke.png
// Khung xếp theo số trong tên file (pixil-frame-0, -1, ..., -12), không theo thứ tự chữ cái.

import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const [dir, out] = process.argv.slice(2);
if (!dir || !out) {
  console.error('Cách dùng: node tools/frames-to-sheet.mjs <thư mục khung> <ra.png>');
  process.exit(1);
}

const num = (f) => Number(f.match(/(\d+)\.png$/i)?.[1] ?? 0);
const files = fs.readdirSync(dir).filter((f) => /\.png$/i.test(f)).sort((a, b) => num(a) - num(b));
const frames = files.map((f) => PNG.sync.read(fs.readFileSync(path.join(dir, f))));
const { width: W, height: H } = frames[0];
for (const [i, fr] of frames.entries()) {
  if (fr.width !== W || fr.height !== H) throw new Error(`${files[i]}: ${fr.width}x${fr.height}, khác cỡ khung đầu ${W}x${H}`);
}

const sheet = new PNG({ width: W * frames.length, height: H });
frames.forEach((fr, k) => {
  for (let y = 0; y < H; y++) fr.data.copy(sheet.data, (y * W * frames.length + k * W) * 4, y * W * 4, (y + 1) * W * 4);
});
fs.writeFileSync(out, PNG.sync.write(sheet));
const clear = frames[0].data.filter((_, i) => i % 4 === 3 && frames[0].data[i] === 0).length;
console.log(`${out}: ${frames.length} khung ${W}x${H} (${files.join(', ')}); khung đầu trong suốt ${Math.round((clear / (W * H)) * 100)}%`);

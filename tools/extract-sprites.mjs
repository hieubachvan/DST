// Cắt từng hình trong các sprite sheet ở assets/sheets/, xóa nền, lưu thành PNG trong suốt
// vào client/public/sprites/. Chạy: npm run sprites
//
// Thêm hình mới: thêm một dòng vào bảng SPRITES với [tấm ảnh, x, y, rộng, cao] của khung chứa hình
// (tọa độ trên ảnh gốc, chừa dư vài pixel cũng được, miễn không dính hình bên cạnh).
// Quy ước tên: chữ thường, nối bằng "_"; tên vật phẩm trùng mã trong shared/data.js;
// khung hoạt ảnh dạng <đối_tượng>_<trạng_thái>_<hướng> hoặc <đối_tượng>_<trạng_thái>_<số khung>.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHEET_DIR = path.join(ROOT, 'assets', 'sheets');
const OUT = path.join(ROOT, 'client', 'public', 'sprites');

// mode "bg": ảnh RGB nền mờ, tách hình bằng cách loang nền từ mép khung.
// mode "alpha": ảnh có kênh alpha, hình đặc (alpha cao) còn nền bảng bán trong suốt.
const SHEETS = {
  s1: { file: 'characters-mobs-structures.png', mode: 'bg' },
  s2: { file: 'resources-plants.png', mode: 'bg' },
  s3: { file: 'flowers.png', mode: 'bg' },
  s4: { file: 'food-materials.png', mode: 'bg' },
  s5: { file: 'tools-items.png', mode: 'bg' },
  s6: { file: 'ui-hud.png', mode: 'bg' },
  s7: { file: 'ui-decorations.png', mode: 'bg' },
  anim: { file: 'player-animations.png', mode: 'alpha' },
  deer: { file: 'deerclops.png', mode: 'bg' },
  boom: { file: 'boomerang.png', mode: 'bg' },
};

// Tấm deerclops.png: lưới 4 cột x 6 hàng (mỗi ô ~256px). Hàng 2 = đi, hàng 5 = vồ.
// Bỏ các khung có chân đen dính vào nền tối (tách nền bị mất chân).
const DEER_SPRITES = {
  deerclops: ['deer', 55, 20, 200, 250],
  ...Object.fromEntries([[45, 280, 215, 240], [295, 280, 200, 240], [545, 280, 200, 240]]
    .map((b, i) => [`deerclops_walk_${i}`, ['deer', ...b]])),
  deerclops_atk_0: ['deer', 40, 1060, 230, 230],
  deerclops_atk_1: ['deer', 285, 1060, 245, 230],
};

// Nhãn cột trên tấm player-animations.png không khớp với hình vẽ (nhiều cột "Left" thực ra quay sang phải).
// Đặt tên theo hướng nhân vật thật sự quay mặt trên màn hình; cột trùng lặp thì bỏ (null).
// Các hướng bên trái được game tạo bằng cách lật ngang hình bên phải.
//   Cột trên ảnh: Down, Down-Left,  Left, Up-Left, Up,  Up-Right, Right,  Down-Right
const DIRS = ['down', 'down_right', null, null, 'up', null, 'right', 'up_right'];
const frames = (prefix, boxes) => Object.fromEntries(boxes.map((b, i) => [`${prefix}_${i}`, ['anim', ...b]]));
const directions = (prefix, boxes) => Object.fromEntries(boxes.map((b, i) => [DIRS[i], b]).filter(([d]) => d).map(([d, b]) => [`${prefix}_${d}`, ['anim', ...b]]));

// Tấm player-animations.png: nhân vật 8 hướng x 3 tư thế, hành động, trạng thái, thú, lửa trại động
const ANIM_SPRITES = {
  ...directions('player_idle', [[71, 98, 57, 109], [160, 97, 54, 111], [248, 96, 56, 111], [335, 96, 49, 112], [415, 95, 54, 113], [509, 94, 50, 112], [580, 97, 57, 111], [668, 97, 53, 110]]),
  ...directions('player_walk', [[71, 231, 56, 106], [160, 234, 54, 109], [245, 229, 58, 109], [335, 230, 49, 107], [416, 228, 52, 110], [510, 230, 50, 106], [579, 229, 55, 109], [670, 230, 51, 107]]),
  ...directions('player_run', [[73, 367, 55, 103], [161, 368, 57, 101], [247, 365, 56, 103], [336, 364, 49, 106], [415, 366, 54, 103], [508, 365, 52, 102], [579, 364, 61, 105], [671, 363, 52, 105]]),
  ...frames('player_chop', [[762, 82, 70, 80], [832, 86, 48, 76], [892, 84, 37, 77], [940, 84, 37, 78], [991, 85, 36, 76], [1040, 85, 38, 76], [1088, 85, 42, 76], [1138, 85, 36, 76]]),
  ...frames('player_mine', [[769, 203, 59, 79], [833, 205, 54, 79], [893, 207, 47, 77], [942, 208, 47, 77], [992, 208, 47, 76], [1040, 207, 46, 78], [1088, 208, 44, 76], [1144, 208, 33, 77]]),
  player_hurt_red: ['anim', 1223, 370, 45, 84],
  player_dead: ['anim', 1443, 393, 75, 43],
  ...frames('rabbit_dir', [[113, 640, 32, 52], [179, 642, 29, 51], [241, 642, 37, 50], [311, 641, 29, 52], [377, 641, 38, 51], [452, 641, 32, 51], [523, 643, 26, 51]]),
  ...frames('spider_dir', [[99, 779, 55, 37], [172, 777, 51, 38], [238, 775, 50, 40], [303, 779, 49, 36], [373, 775, 55, 37], [443, 773, 55, 39], [513, 777, 51, 38]]),
  ...frames('hound_dir', [[97, 916, 51, 67], [165, 913, 50, 72], [239, 913, 47, 70], [304, 914, 48, 68], [375, 914, 55, 69], [449, 917, 47, 69], [510, 918, 49, 67]]),
  ...frames('pig_dir', [[104, 577, 49, 55], [174, 577, 50, 48], [239, 577, 48, 48], [303, 578, 48, 49], [373, 583, 50, 42], [442, 578, 54, 46], [513, 585, 53, 42]]),
  ...frames('crow_dir', [[104, 709, 42, 45], [173, 710, 41, 41], [241, 711, 44, 43], [309, 710, 42, 43], [383, 710, 39, 42], [453, 710, 39, 43], [522, 712, 36, 42]]),
  ...frames('campfire_anim', [[689, 624, 37, 45], [751, 624, 33, 45], [810, 624, 32, 45], [864, 624, 32, 45], [924, 624, 34, 45], [980, 624, 40, 45], [1041, 624, 39, 45], [1105, 624, 35, 45]]),
};

const SPRITES = {
  // Nhân vật
  player_idle: ['s1', 13, 40, 54, 91],
  player_walk1: ['s1', 75, 41, 55, 90],
  player_walk2: ['s1', 138, 40, 54, 90],
  player_walk3: ['s1', 200, 42, 53, 87],
  player_run1: ['s1', 261, 44, 51, 83],
  player_run2: ['s1', 320, 45, 51, 82],
  player_run3: ['s1', 380, 40, 53, 86],
  player_hurt: ['s1', 437, 50, 39, 78],
  player_die: ['s1', 480, 62, 45, 64],
  // Quái / động vật
  rabbit: ['s1', 628, 57, 39, 71],
  spider: ['s1', 761, 70, 75, 54],
  pig: ['s1', 545, 58, 68, 67],
  crow: ['s1', 686, 70, 72, 56],
  bunnyman: ['s1', 855, 49, 42, 79],
  beefalo: ['s1', 912, 40, 84, 88],
  // Công trình
  campfire: ['s1', 1020, 52, 72, 80],
  chest: ['s1', 1191, 67, 61, 58],
  science: ['s1', 1272, 34, 71, 96],
  crockpot: ['s1', 1360, 58, 64, 72],
  tent: ['s1', 1096, 30, 89, 100],
  dryingrack: ['s1', 1434, 38, 89, 92],
  firepit: ['s5', 178, 261, 59, 58],
  // Tài nguyên trên mặt đất
  tree: ['s2', 18, 131, 71, 101],
  tree2: ['s2', 199, 131, 80, 100],
  birch: ['s2', 104, 137, 75, 93],
  dead_tree: ['s2', 305, 141, 55, 94],
  grass: ['s2', 582, 39, 69, 68],
  tall_grass: ['s2', 704, 35, 74, 74],
  bush_berries: ['s2', 816, 36, 79, 73],
  bush: ['s7', 1269, 30, 48, 54],
  boulder: ['s7', 1109, 41, 44, 43],
  flower0: ['s3', 40, 49, 51, 60],
  flower1: ['s3', 229, 47, 51, 62],
  flower2: ['s3', 133, 50, 50, 59],
  flower3: ['s3', 334, 48, 53, 60],
  flower4: ['s3', 445, 43, 54, 66],
  rose: ['s3', 546, 39, 59, 70],
  // Vật phẩm
  log: ['s2', 14, 44, 60, 62],
  rocks: ['s2', 94, 44, 64, 61],
  gold: ['s2', 184, 45, 62, 59],
  iron: ['s2', 273, 45, 64, 60],
  flint: ['s2', 361, 43, 55, 61],
  twigs: ['s2', 432, 42, 56, 63],
  cutgrass: ['s2', 499, 41, 52, 64],
  rope: ['s4', 569, 267, 53, 44],
  cutstone: ['s4', 688, 266, 50, 49],
  boards: ['s4', 922, 263, 53, 49],
  charcoal: ['s4', 809, 263, 49, 53],
  meat: ['s4', 22, 40, 62, 57],
  cookedmeat: ['s4', 100, 40, 66, 56],
  monstermeat: ['s4', 727, 33, 62, 66],
  cookedmonstermeat: ['s4', 883, 131, 63, 63],
  morsel: ['s4', 960, 140, 45, 42],
  cookedmorsel: ['s4', 969, 43, 51, 54],
  egg: ['s4', 343, 39, 44, 56],
  berries: ['s4', 326, 123, 65, 57],
  roastedberries: ['s4', 403, 126, 62, 49],
  jam: ['s4', 31, 121, 46, 59],
  meatballs: ['s4', 99, 129, 66, 50],
  ratatouille: ['s4', 322, 213, 61, 54],
  monsterstew: ['s4', 399, 220, 65, 53],
  carrot: ['s4', 254, 211, 50, 63],
  pumpkin: ['s4', 472, 40, 57, 57],
  salve: ['s6', 235, 42, 39, 70],
  bandage: ['s6', 291, 63, 46, 46],
  // Công cụ
  axe: ['s5', 28, 36, 64, 64],
  pickaxe: ['s5', 102, 41, 59, 58],
  shovel: ['s5', 185, 34, 57, 64],
  hammer: ['s5', 252, 132, 64, 59],
  spear: ['s5', 182, 130, 53, 65],
  torch: ['s5', 442, 28, 47, 70],
  trap: ['s5', 105, 146, 54, 42],
  backpack: ['s5', 29, 261, 54, 77],
  // Giao diện
  ui_health: ['s6', 12, 41, 72, 73],
  ui_hunger: ['s6', 84, 41, 72, 73],
  ui_sanity: ['s6', 156, 41, 70, 73],
  ui_sun: ['s6', 1082, 50, 57, 58],
  ui_sunset: ['s6', 1143, 48, 61, 61],
  ui_moon: ['s6', 1208, 47, 60, 62],
  skull: ['s7', 681, 39, 44, 46],
  boomerang: ['boom', 35, 60, 160, 175],
  ...ANIM_SPRITES,
  ...DEER_SPRITES,
};

// Hình rời đã có nền trong suốt: chép nguyên vẹn, không cắt.
// Vụ nổ: https://agresko.itch.io/explosion-animation---7x (Marek Sefcik), xem assets/explosion/readme.txt
const COPIES = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((i) => [`explosion_${i}`, `explosion/explosion_${i}.png`]));

const PAD = 3;
const BG_STEP = 16; // khác biệt màu tối đa giữa 2 điểm nền liền nhau
const BG_DIFF = 70; // khác biệt màu tối đa so với nền mờ ước lượng

const diff = (d, i, j) => Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]);

// Tách hình theo kênh alpha. Nền bảng có alpha thấp, nhưng sát hình có một quầng sáng
// màu trắng/xám (alpha tới ~236). Loang từ mép khung qua các điểm alpha thấp hoặc màu sáng
// trung tính; nét viền tối của hình chặn vệt loang nên chỗ sáng bên trong hình vẫn được giữ.
function alphaToBg(img) {
  const { data: d, width: W, height: H } = img;
  const bgLike = (k) => {
    const i = k * 4;
    if (d[i + 3] < 225) return true;
    const lo = Math.min(d[i], d[i + 1], d[i + 2]), hi = Math.max(d[i], d[i + 1], d[i + 2]);
    return lo > 185 && hi - lo < 28;
  };
  const bg = new Uint8Array(W * H);
  const stack = [];
  const seed = (k) => { if (!bg[k] && bgLike(k)) { bg[k] = 1; stack.push(k); } };
  for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }
  while (stack.length) {
    const k = stack.pop();
    const kx = k % W;
    for (const n of [k - 1, k + 1, k - W, k + W]) {
      if (n < 0 || n >= W * H || bg[n]) continue;
      if ((n === k - 1 && kx === 0) || (n === k + 1 && kx === W - 1)) continue;
      if (bgLike(n)) { bg[n] = 1; stack.push(n); }
    }
  }
  for (let k = 0; k < W * H; k++) d[k * 4 + 3] = bg[k] ? 0 : 255;
  return bg;
}

function extract(sheet, x, y, w, h, mode) {
  const x0 = Math.max(0, x - PAD), y0 = Math.max(0, y - PAD);
  const x1 = Math.min(sheet.width, x + w + PAD), y1 = Math.min(sheet.height, y + h + PAD);
  const W = x1 - x0, H = y1 - y0;
  const src = Buffer.alloc(W * H * 4);
  for (let yy = 0; yy < H; yy++) sheet.data.copy(src, yy * W * 4, ((y0 + yy) * sheet.width + x0) * 4, ((y0 + yy) * sheet.width + x1) * 4);
  if (mode === 'alpha') {
    const img = { data: src, width: W, height: H };
    return keepMain(img, alphaToBg(img));
  }

  // Nền ước lượng theo từng hàng: nội suy giữa màu mép trái và mép phải của hàng đó
  // (nền là dải màu mờ, đổi dần theo cả chiều dọc lẫn chiều ngang).
  const edge = [];
  for (let i = 0; i < W; i++) edge.push(i * 4, ((H - 1) * W + i) * 4);
  for (let j = 0; j < H; j++) edge.push(j * W * 4, (j * W + W - 1) * 4);
  const side = (col) => {
    const raw = [];
    for (let j = 0; j < H; j++) raw.push([0, 1, 2].map((c) => src[(j * W + col) * 4 + c]));
    // làm mượt theo chiều dọc để một điểm hình chạm mép không làm lệch nền
    return raw.map((_, j) => {
      const win = raw.slice(Math.max(0, j - 6), j + 7).map((v) => v.reduce((a, b) => a + b, 0));
      const sorted = [...win].sort((a, b) => a - b);
      const med = sorted[sorted.length >> 1];
      return raw[Math.max(0, j - 6) + win.indexOf(med)];
    });
  };
  const L = side(0), R = side(W - 1);
  const bgDist = (i) => {
    const k = i / 4, x = k % W, y = (k / W) | 0, t = x / (W - 1);
    let d = 0;
    for (let c = 0; c < 3; c++) d += Math.abs(src[i + c] - (L[y][c] + (R[y][c] - L[y][c]) * t));
    return d;
  };

  // Loang từ mép vào trong qua các điểm giống nền
  const bg = new Uint8Array(W * H);
  const stack = [];
  for (const i of edge) {
    const k = i / 4;
    if (!bg[k] && bgDist(i) < BG_DIFF * 1.5) { bg[k] = 1; stack.push(k); }
  }
  while (stack.length) {
    const k = stack.pop();
    const kx = k % W;
    for (const n of [k - 1, k + 1, k - W, k + W]) {
      if (n < 0 || n >= W * H || bg[n]) continue;
      if ((n === k - 1 && kx === 0) || (n === k + 1 && kx === W - 1)) continue;
      if (diff(src, k * 4, n * 4) < BG_STEP && bgDist(n * 4) < BG_DIFF) { bg[n] = 1; stack.push(n); }
    }
  }

  return keepMain({ data: src, width: W, height: H }, bg);
}

// Giữ thành phần lớn nhất (và các mảnh lớn khác như ngọn lửa), bỏ vụn chữ / vụn nền, cắt sát hình.
function keepMain({ data: src, width: W, height: H }, bg) {
  const lab = new Int32Array(W * H);
  const sizes = [0];
  for (let k = 0; k < W * H; k++) {
    if (bg[k] || lab[k]) continue;
    const id = sizes.length;
    let n = 0;
    const st = [k];
    lab[k] = id;
    while (st.length) {
      const j = st.pop();
      n++;
      const jx = j % W;
      for (const m of [j - 1, j + 1, j - W, j + W]) {
        if (m < 0 || m >= W * H || bg[m] || lab[m]) continue;
        if ((m === j - 1 && jx === 0) || (m === j + 1 && jx === W - 1)) continue;
        lab[m] = id;
        st.push(m);
      }
    }
    sizes.push(n);
  }
  const biggest = Math.max(...sizes);
  const keep = sizes.map((n) => n >= biggest * 0.12);

  // Alpha: điểm sát nền được làm mờ một nửa cho viền mượt
  const out = new PNG({ width: W, height: H });
  let bx0 = W, by0 = H, bx1 = -1, by1 = -1;
  for (let k = 0; k < W * H; k++) {
    const solid = !bg[k] && keep[lab[k]];
    if (!solid) continue;
    const kx = k % W, ky = (k / W) | 0;
    let edgeCount = 0;
    for (const m of [k - 1, k + 1, k - W, k + W]) {
      if (m < 0 || m >= W * H || bg[m] || !keep[lab[m]]) edgeCount++;
    }
    src.copy(out.data, k * 4, k * 4, k * 4 + 3);
    out.data[k * 4 + 3] = edgeCount ? 150 : 255;
    if (kx < bx0) bx0 = kx;
    if (kx > bx1) bx1 = kx;
    if (ky < by0) by0 = ky;
    if (ky > by1) by1 = ky;
  }
  if (bx1 < 0) throw new Error('không tìm thấy hình');

  // Cắt sát hình
  const cw = bx1 - bx0 + 1, ch = by1 - by0 + 1;
  const crop = new PNG({ width: cw, height: ch });
  for (let yy = 0; yy < ch; yy++) out.data.copy(crop.data, yy * cw * 4, ((by0 + yy) * W + bx0) * 4, ((by0 + yy) * W + bx1 + 1) * 4);
  return crop;
}

fs.mkdirSync(OUT, { recursive: true });
const sheets = {};
for (const [key, { file, mode }] of Object.entries(SHEETS)) {
  const p = path.join(SHEET_DIR, file);
  if (!fs.existsSync(p)) {
    console.warn(`Bỏ qua ${file}: không tìm thấy`);
    continue;
  }
  // Ảnh RGB không có alpha: pngjs vẫn trả về 4 kênh, đặt alpha = 255
  sheets[key] = { png: PNG.sync.read(fs.readFileSync(p)), mode };
}

const manifest = {};
for (const [name, [sheet, x, y, w, h]] of Object.entries(SPRITES)) {
  if (!sheets[sheet]) continue;
  try {
    const png = extract(sheets[sheet].png, x, y, w, h, sheets[sheet].mode);
    fs.writeFileSync(path.join(OUT, `${name}.png`), PNG.sync.write(png));
    manifest[name] = [png.width, png.height];
  } catch (err) {
    console.warn(`Lỗi ${name}: ${err.message}`);
  }
}
for (const [name, file] of Object.entries(COPIES)) {
  const p = path.join(ROOT, 'assets', file);
  if (!fs.existsSync(p)) {
    console.warn(`Bỏ qua ${file}: không tìm thấy`);
    continue;
  }
  const png = PNG.sync.read(fs.readFileSync(p));
  fs.copyFileSync(p, path.join(OUT, `${name}.png`));
  manifest[name] = [png.width, png.height];
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`Đã xuất ${Object.keys(manifest).length} hình vào ${path.relative(ROOT, OUT)}`);

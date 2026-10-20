// Quản lý hình ảnh (sprite) được cắt từ các sprite sheet bằng `npm run sprites`.
// Món nào chưa có hình thì tự dùng emoji hoặc hình vẽ bằng code.
import { ITEMS } from '../../shared/data.js';

export const SPRITE_URL = `${import.meta.env.BASE_URL}sprites/`;

// Tên sprite -> [rộng, cao], nạp từ manifest.json
export const art = new Map();

// Vật phẩm dùng hình có tên khác mã vật phẩm
const ITEM_OVERRIDES = {
  petals: 'flower1', dug_grass: 'grass', dug_sapling: 'dead_tree', dug_bush: 'bush',
  goldenaxe: 'axe', goldenpickaxe: 'pickaxe', fangspear: 'spear', poisonboomerang: 'boomerang',
};
// Đồ vàng / đồ độc dùng lại hình đồ thường, nhuộm màu: mã vật phẩm -> [màu nhuộm trong game, class CSS cho icon].
const TINTS = {
  goldenaxe: [0xffd24a, 'golden'], goldenpickaxe: [0xffd24a, 'golden'],
  fangspear: [0x9be36a, 'venom'], poisonboomerang: [0x9be36a, 'venom'],
};
export const itemTint = (id) => TINTS[id]?.[0] ?? null;

export async function loadArt() {
  try {
    const res = await fetch(`${SPRITE_URL}manifest.json`);
    if (!res.ok) return;
    for (const [name, size] of Object.entries(await res.json())) art.set(name, size);
  } catch {
    // Không có sprite: game vẫn chạy với hình vẽ bằng code.
  }
}

// Nhân vật ghép mảnh (rig): tên -> parts.json ({ p0: { w, h }, ... }). Chỉ có khi đã chạy
// `node tools/extract-rig.mjs` trên máy (mảnh hình không commit / deploy); không có thì game dùng sprite thường.
export const RIG_URL = `${import.meta.env.BASE_URL}rig/`;
export const rigParts = new Map();

export async function loadRigs(names) {
  await Promise.all(names.map(async (name) => {
    try {
      const res = await fetch(`${RIG_URL}${name}/parts.json`);
      if (res.ok) rigParts.set(name, await res.json());
    } catch {
      // Không có mảnh (hoặc trả về trang khác): dùng sprite thường.
    }
  }));
}

export function itemSprite(id) {
  const key = ITEM_OVERRIDES[id] ?? id;
  return art.has(key) ? key : null;
}

// HTML cho biểu tượng vật phẩm/công thức trong giao diện.
export function iconHtml(id, fallback) {
  const key = itemSprite(id);
  if (key) return `<img class="ic sprite${TINTS[id] ? ` ${TINTS[id][1]}` : ''}" src="${SPRITE_URL}${key}.png" alt="">`;
  return `<span class="ic">${fallback ?? ITEMS[id]?.icon ?? '?'}</span>`;
}

export function spriteImg(key, cls = 'ic sprite') {
  return art.has(key) ? `<img class="${cls}" src="${SPRITE_URL}${key}.png" alt="">` : null;
}

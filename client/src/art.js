// Quản lý hình ảnh (sprite) được cắt từ các sprite sheet bằng `npm run sprites`.
// Món nào chưa có hình thì tự dùng emoji hoặc hình vẽ bằng code.
import { ITEMS } from '../../shared/data.js';

export const SPRITE_URL = `${import.meta.env.BASE_URL}sprites/`;

// Tên sprite -> [rộng, cao], nạp từ manifest.json
export const art = new Map();

// Vật phẩm dùng hình có tên khác mã vật phẩm
const ITEM_OVERRIDES = {
  petals: 'flower1', dug_grass: 'grass', dug_sapling: 'dead_tree', dug_bush: 'bush',
  goldenaxe: 'axe', goldenpickaxe: 'pickaxe',
};
// Đồ vàng dùng lại hình đồ thường, nhuộm màu vàng.
const GOLDEN = new Set(['goldenaxe', 'goldenpickaxe']);
export const GOLD_TINT = 0xffd24a;
export const isGolden = (id) => GOLDEN.has(id);

export async function loadArt() {
  try {
    const res = await fetch(`${SPRITE_URL}manifest.json`);
    if (!res.ok) return;
    for (const [name, size] of Object.entries(await res.json())) art.set(name, size);
  } catch {
    // Không có sprite: game vẫn chạy với hình vẽ bằng code.
  }
}

export function itemSprite(id) {
  const key = ITEM_OVERRIDES[id] ?? id;
  return art.has(key) ? key : null;
}

// HTML cho biểu tượng vật phẩm/công thức trong giao diện.
export function iconHtml(id, fallback) {
  const key = itemSprite(id);
  if (key) return `<img class="ic sprite${GOLDEN.has(id) ? ' golden' : ''}" src="${SPRITE_URL}${key}.png" alt="">`;
  return `<span class="ic">${fallback ?? ITEMS[id]?.icon ?? '?'}</span>`;
}

export function spriteImg(key, cls = 'ic sprite') {
  return art.has(key) ? `<img class="${cls}" src="${SPRITE_URL}${key}.png" alt="">` : null;
}

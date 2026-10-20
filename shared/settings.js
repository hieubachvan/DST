// Thông số thế giới: admin chọn lúc tạo server (từ một gói có sẵn rồi chỉnh từng ô), sau đó không đổi được nữa.
// Dùng chung cho server (kiểm tra, áp dụng) và client (vẽ form tạo server, đồng hồ ngày đêm, hướng dẫn).
//
// Thêm thông số mới: thêm một dòng vào SETTINGS (giá trị mặc định = cách game chạy trước khi có thông số đó),
// thêm giá trị cho gói Dễ / Khó nếu muốn khác mặc định, rồi đọc this.cfg.<key> ở server/game.js.

export const SETTING_GROUPS = [
  { id: 'world', name: 'Bản đồ', icon: '🗺️' },
  { id: 'time', name: 'Thời gian', icon: '🕒' },
  { id: 'survival', name: 'Sinh tồn', icon: '🍖' },
  { id: 'mobs', name: 'Quái thường', icon: '🕷️' },
  { id: 'hounds', name: 'Chó săn', icon: '🐕' },
  { id: 'queen', name: 'Nhện chúa', icon: '👑' },
  { id: 'bosses', name: 'Boss', icon: '👹' },
];

// Tỉ lệ ban ngày / chạng vạng / ban đêm trong một ngày.
export const PHASE_SPLITS = {
  longday: { name: 'Ngày dài', day: 0.6, dusk: 0.25 },
  normal: { name: 'Cân bằng', day: 0.5, dusk: 0.25 },
  longnight: { name: 'Đêm dài', day: 0.35, dusk: 0.25 },
};

// Kích thước bản đồ: bán kính hòn đảo quanh điểm hồi sinh (đơn vị thế giới, người chơi chạy 200/giây).
// Thế giới tạo trước khi có thông số này được coi là 'infinite' (xem worlds.js).
export const MAP_SIZES = {
  small: { name: 'Nhỏ', r: 5000 },
  medium: { name: 'Vừa', r: 7500 },
  large: { name: 'Lớn', r: 11000 },
  infinite: { name: 'Vô hạn', r: Infinity },
};
export const mapRadius = (settings) => MAP_SIZES[settings?.mapSize]?.r ?? MAP_SIZES.medium.r;

// type: 'num' (min, max, step, unit; zero: chữ hiện khi bằng 0) | 'bool' | 'select' (options: { giá trị: tên }).
// Thông số "def" là cách game chạy mặc định; riêng nhóm boss mạnh lên sau mỗi lần bị hạ là luật mới, mặc định bật sẵn.
// needs: chỉ có tác dụng khi thông số bật/tắt đó đang bật (form làm mờ, bảng tóm tắt bỏ qua).
export const SETTINGS = [
  { key: 'mapSize', group: 'world', label: 'Kích thước bản đồ', type: 'select', def: 'medium',
    options: Object.fromEntries(Object.entries(MAP_SIZES).map(([k, v]) => [k, v.name])),
    desc: 'Thế giới là một hòn đảo bao quanh bởi biển. Vô hạn: đi mãi không hết (server nặng dần theo vùng đã khám phá).' },
  { key: 'dayMinutes', group: 'time', label: 'Độ dài một ngày', type: 'num', min: 2, max: 20, step: 1, unit: 'phút', def: 4 },
  { key: 'phases', group: 'time', label: 'Tỉ lệ ngày / đêm', type: 'select', def: 'normal',
    options: Object.fromEntries(Object.entries(PHASE_SPLITS).map(([k, v]) => [k, v.name])) },

  { key: 'hunger', group: 'survival', label: 'Tốc độ đói', type: 'num', min: 0.5, max: 2, step: 0.25, unit: '×', def: 1 },
  { key: 'spoil', group: 'survival', label: 'Tốc độ đồ ăn hư', type: 'num', min: 0, max: 2, step: 0.25, unit: '×', zero: 'Không hư', def: 1 },
  { key: 'regrow', group: 'survival', label: 'Tốc độ tài nguyên mọc lại', type: 'num', min: 0.5, max: 3, step: 0.25, unit: '×', def: 1 },
  { key: 'abandonDays', group: 'survival', label: 'Công trình bỏ hoang mục sau', type: 'num', min: 0, max: 30, step: 1, unit: 'ngày', zero: 'Không bao giờ', def: 5,
    desc: 'Không ai tới gần công trình trong chừng này ngày thì nó sập.' },

  { key: 'spiders', group: 'mobs', label: 'Số nhện quanh mỗi người', type: 'num', min: 0, max: 3, step: 0.5, unit: '×', zero: 'Không có', def: 1 },
  { key: 'animals', group: 'mobs', label: 'Số thú (thỏ, lợn, bò lông)', type: 'num', min: 0, max: 3, step: 0.5, unit: '×', zero: 'Không có', def: 1 },
  { key: 'nightSpiders', group: 'mobs', label: 'Nhện kéo tới ban đêm', type: 'bool', def: true },

  { key: 'hounds', group: 'hounds', label: 'Có chó săn tấn công', type: 'bool', def: true },
  { key: 'houndDay', group: 'hounds', needs: 'hounds', label: 'Đợt chó săn đầu tiên vào ngày', type: 'num', min: 2, max: 30, step: 0.5, unit: '', def: 5.5 },
  { key: 'houndCount', group: 'hounds', needs: 'hounds', label: 'Số chó mỗi đợt', type: 'num', min: 0.5, max: 3, step: 0.5, unit: '×', def: 1 },

  { key: 'spiderQueen', group: 'queen', label: 'Có ổ Nhện chúa trong rừng', type: 'bool', def: true },
  { key: 'queenHp', group: 'queen', needs: 'spiderQueen', label: 'Máu Nhện chúa', type: 'num', min: 0.5, max: 3, step: 0.25, unit: '×', def: 1 },
  { key: 'queenRespawn', group: 'queen', needs: 'spiderQueen', label: 'Bị hạ thì ổ có Nhện chúa mới sau', type: 'num', min: 1, max: 30, step: 1, unit: 'ngày', def: 6 },
  { key: 'poison', group: 'queen', needs: 'spiderQueen', label: 'Sức độc khi bị Nhện chúa đánh', type: 'num', min: 0, max: 2, step: 0.25, unit: '×', zero: 'Không độc', def: 1,
    desc: 'Mặc định mỗi lần trúng độc mất tổng cộng 30 máu trong 8 giây, bỏ qua giáp. Thuốc đắp / Thuốc giải chữa khỏi.' },

  { key: 'deerclops', group: 'bosses', label: 'Có boss Deerclops', type: 'bool', def: true },
  { key: 'deerclopsDay', group: 'bosses', needs: 'deerclops', label: 'Deerclops tới lần đầu vào ngày', type: 'num', min: 3, max: 60, step: 1, unit: '', def: 11 },
  { key: 'deerclopsHp', group: 'bosses', needs: 'deerclops', label: 'Máu Deerclops', type: 'num', min: 0.5, max: 3, step: 0.25, unit: '×', def: 1 },
  { key: 'bearger', group: 'bosses', label: 'Có boss Bearger', type: 'bool', def: true },
  { key: 'beargerDay', group: 'bosses', needs: 'bearger', label: 'Bearger tới lần đầu vào ngày', type: 'num', min: 3, max: 60, step: 1, unit: '', def: 20 },
  { key: 'beargerHp', group: 'bosses', needs: 'bearger', label: 'Máu Bearger', type: 'num', min: 0.5, max: 3, step: 0.25, unit: '×', def: 1 },
  { key: 'bossReturnKilled', group: 'bosses', label: 'Boss bị hạ thì quay lại sau', type: 'num', min: 3, max: 30, step: 1, unit: 'ngày', def: 10 },
  { key: 'bossReturnLeft', group: 'bosses', label: 'Boss bỏ đi thì quay lại sau', type: 'num', min: 1, max: 10, step: 0.5, unit: 'ngày', def: 3,
    desc: 'Boss tự bỏ đi khi không còn ai ở gần nó một lúc.' },
  { key: 'bossHpGrowth', group: 'bosses', label: 'Mỗi lần bị hạ, lần sau thêm máu', type: 'num', min: 0, max: 100, step: 5, unit: '%', zero: 'Không tăng', def: 25,
    desc: 'Tính riêng cho từng boss: bị hạ bao nhiêu lần thì lần sau mạnh lên bấy nhiêu nấc.' },
  { key: 'bossDmgGrowth', group: 'bosses', label: 'Mỗi lần bị hạ, lần sau thêm sát thương', type: 'num', min: 0, max: 50, step: 5, unit: '%', zero: 'Không tăng', def: 10 },
  { key: 'bossMaxLevel', group: 'bosses', label: 'Mạnh lên tối đa', type: 'num', min: 1, max: 20, step: 1, unit: 'lần', def: 5,
    desc: 'Sau chừng này lần bị hạ thì boss không mạnh thêm nữa.' },
  { key: 'together', group: 'bosses', label: 'Boss và chó săn được ra cùng lúc', type: 'bool', def: false,
    desc: 'Tắt: mỗi lúc chỉ một boss, chó săn không tới khi có boss. Bật: các đợt không chờ nhau nên có thể ập tới cùng lúc.' },
];

export const DEFAULT_SETTINGS = Object.fromEntries(SETTINGS.map((s) => [s.key, s.def]));

// Gói có sẵn: chỉ ghi những ô khác mặc định.
export const PRESETS = {
  easy: {
    name: 'Dễ', icon: '🌱',
    values: {
      phases: 'longday', hunger: 0.75, spoil: 0.5, regrow: 1.5, abandonDays: 10, spiders: 0.5, animals: 1.5, nightSpiders: false,
      houndDay: 8, houndCount: 0.5, deerclopsDay: 15, deerclopsHp: 0.75, beargerDay: 25, beargerHp: 0.75,
      bossReturnKilled: 12, bossReturnLeft: 4, bossHpGrowth: 10, bossDmgGrowth: 5, bossMaxLevel: 3,
      queenHp: 0.75, queenRespawn: 4, poison: 0.5,
    },
  },
  normal: { name: 'Mặc định', icon: '⚖️', values: {} },
  hard: {
    name: 'Khó', icon: '💀',
    values: {
      phases: 'longnight', hunger: 1.25, spoil: 1.5, regrow: 0.75, abandonDays: 3, spiders: 1.5, animals: 0.5,
      houndDay: 4, houndCount: 1.5, deerclopsDay: 8, deerclopsHp: 1.5, beargerDay: 15, beargerHp: 1.5, together: true,
      bossReturnKilled: 7, bossReturnLeft: 2, bossHpGrowth: 40, bossDmgGrowth: 20, bossMaxLevel: 8,
      queenHp: 1.5, queenRespawn: 8, poison: 1.5,
    },
  },
};
export const presetSettings = (id) => ({ ...DEFAULT_SETTINGS, ...PRESETS[id]?.values });

// Kẹp mọi giá trị vào khoảng hợp lệ; thiếu hoặc sai thì lấy mặc định. Luôn trả về đủ mọi thông số.
export function sanitizeSettings(input) {
  const src = input && typeof input === 'object' ? input : {};
  const out = {};
  for (const s of SETTINGS) {
    const v = src[s.key];
    if (s.type === 'bool') out[s.key] = typeof v === 'boolean' ? v : s.def;
    else if (s.type === 'select') out[s.key] = Object.hasOwn(s.options, v) ? v : s.def;
    else {
      const n = Number(v);
      out[s.key] = v === null || v === '' || !Number.isFinite(n) ? s.def
        : Math.min(s.max, Math.max(s.min, Math.round(n / s.step) * s.step));
    }
  }
  return out;
}

// Gói nào trùng khớp hoàn toàn với bộ thông số (null nếu đã chỉnh khác mọi gói).
export function presetOf(settings) {
  const s = sanitizeSettings(settings);
  for (const [id] of Object.entries(PRESETS)) {
    const p = presetSettings(id);
    if (SETTINGS.every(({ key }) => p[key] === s[key])) return id;
  }
  return null;
}

// Đồng hồ ngày đêm (giây): len = cả ngày, hết ban ngày ở dayEnd, hết chạng vạng ở duskEnd.
export function clockOf(settings) {
  const s = sanitizeSettings(settings);
  const len = s.dayMinutes * 60;
  const split = PHASE_SPLITS[s.phases];
  return { len, dayEnd: Math.round(len * split.day), duskEnd: Math.round(len * (split.day + split.dusk)) };
}

// Chữ hiển thị giá trị của một thông số.
export function settingText(s, v) {
  if (s.type === 'bool') return v ? 'Có' : 'Không';
  if (s.type === 'select') return s.options[v];
  if (v === 0 && s.zero) return s.zero;
  const n = String(v).replace('.', ',');
  return s.unit === '×' ? `×${n}` : s.unit === '%' ? `+${n}%` : s.unit ? `${n} ${s.unit}` : n;
}

// Bảng tóm tắt (HTML) toàn bộ thông số theo nhóm, dùng ở trang admin và hướng dẫn trong game.
// Ô khác mặc định được đánh dấu class "diff".
export function settingsHtml(settings) {
  const s = sanitizeSettings(settings);
  return `<div class="ws-summary">${SETTING_GROUPS.map((g) => {
    const rows = SETTINGS.filter((d) => d.group === g.id && (!d.needs || s[d.needs])).map((d) =>
      `<li${s[d.key] !== d.def ? ' class="diff"' : ''}><span>${d.label}</span><b>${settingText(d, s[d.key])}</b></li>`);
    return `<div><h4>${g.icon} ${g.name}</h4><ul>${rows.join('')}</ul></div>`;
  }).join('')}</div>`;
}

// Thời lượng (giây) thành chữ: "2 phút", "1,5 phút", "45 giây".
export function durationText(sec) {
  if (sec < 60) return `${Math.round(sec)} giây`;
  return `${String(Math.round((sec / 60) * 10) / 10).replace('.', ',')} phút`;
}

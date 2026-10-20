// Dữ liệu và hằng số dùng chung cho cả server và client.

// Thế giới vô hạn, chia thành các chunk vuông. Server tạo chunk khi có người chơi tới gần.
export const CHUNK = 1000;
export const BIOME_CELL = 900;
export const SPAWN = { x: BIOME_CELL / 2, y: BIOME_CELL / 2 };
export const chunkOf = (x, y) => [Math.floor(x / CHUNK), Math.floor(y / CHUNK)];
export const chunkKey = (cx, cy) => `${cx},${cy}`;

// Một ngày dài 240 giây: ban ngày 120s, chạng vạng 60s, ban đêm 60s.
export const DAY_LEN = 240;
export const DROP_LIFE = 300; // đồ vứt ngoài đất tự biến mất sau ngần này giây
export const DAY_END = 120;
export const DUSK_END = 180;

// Nhân vật chọn được lúc vào game. Chỉ khác hình dáng, kỹ năng và hành động giống hệt nhau.
// img: ảnh đại diện trên màn hình chọn (đường dẫn trong client/public).
export const CHARACTERS = {
  default: { name: 'Mặc định', img: 'sprites/player_idle_down.png' },
  hero: { name: 'Gã tóc cam', img: 'hero/head_front.png' },
};

export const PLAYER_SPEED = 200;
export const MAX_HP = 150;
export const MAX_HUNGER = 150;
export const MAX_SANITY = 200;
export const INV_SIZE = 15;
export const PACK_SIZE = 8; // số ô thêm khi đeo ba lô
export const CHEST_SIZE = 9;
export const ACT_RANGE = 80;

// Lều ngủ được vài lần rồi hỏng. Chỉ ngủ được lúc chạng vạng và ban đêm.
export const TENT_USES = 6;

export const TORCH_RADIUS = 220;

// Boomerang: ném vào quái ở xa, bay tới rồi tự quay về tay. Trúng quái thường thì làm choáng một chút.
export const BOOMERANG = { range: 380, speed: 650, hitR: 36, catchR: 40, stunMs: 700 };
export const fireRadius = (fuel) => (fuel <= 0 ? 0 : 110 + Math.min(fuel, 180));

// Các loại lửa đặt được. Hố lửa đá không biến mất khi hết củi.
export const FIRES = {
  campfire: { start: 60, max: 180, permanent: false },
  firepit: { start: 90, max: 270, permanent: true },
};

// Công trình cho phép chế tạo đồ cao cấp khi đứng gần.
export const STATIONS = {
  science: { name: 'Máy Khoa Học', range: 170 },
  crockpot: { name: 'Nồi nấu', range: 130 },
};

export const GEAR_SLOTS = ['hand', 'head', 'body'];
export const GEAR_NAMES = { hand: 'Tay', head: 'Mũ', body: 'Giáp' };

export const ITEMS = {
  // Nguyên liệu thô
  log: { name: 'Gỗ', icon: '🪵', stack: 40, fuel: 45, cook: 'charcoal', from: 'Chặt cây thông bằng rìu (có nhiều trong rừng)' },
  cutgrass: { name: 'Cỏ khô', icon: '🌾', stack: 40, fuel: 15, from: 'Cắt bụi cỏ bằng tay (mọc lại sau 1 phút)' },
  twigs: { name: 'Cành cây', icon: '🥢', stack: 40, fuel: 15, from: 'Bẻ cây non bằng tay (mọc lại sau 1 phút)' },
  rocks: { name: 'Đá', icon: '🪨', stack: 40, from: 'Đập tảng đá xám bằng cuốc chim' },
  flint: { name: 'Đá lửa', icon: '🔷', stack: 40, from: 'Nhặt trên mặt đất (nhiều ở vùng đất đá), hoặc đập tảng đá' },
  gold: { name: 'Vàng', icon: '🪙', stack: 40, from: 'Đập tảng đá bằng cuốc chim (35% mỗi tảng)' },
  silk: { name: 'Tơ nhện', icon: '🕸️', stack: 40, from: 'Rơi ra khi giết nhện (50%), nhện con, và rất nhiều khi hạ Nhện chúa' },
  spider_venom: { name: 'Độc nhện', icon: '🧪', stack: 20, from: 'Rơi ra khi hạ Nhện chúa (2–3 cái)' },
  spider_fang: { name: 'Nanh nhện', icon: '🦷', stack: 20, from: 'Rơi ra khi hạ Nhện chúa (1–2 cái)' },
  deerclops_eyeball: { name: 'Mắt Deerclops', icon: '👁️', stack: 10, from: 'Rơi ra khi hạ boss Deerclops (2 cái)' },
  bearger_fur: { name: 'Lông Gấu', icon: '🐻', stack: 10, from: 'Rơi ra khi hạ boss Bearger' },
  charcoal: { name: 'Than', icon: '⚫', stack: 40, fuel: 50, from: 'Chuột phải vào Gỗ khi đứng gần lửa đang cháy' },

  // Cây đào lên bằng xẻng, đem trồng lại chỗ khác. "plant": loại cây sẽ mọc ra.
  dug_grass: { name: 'Bụi cỏ (đã đào)', icon: '🌱', stack: 10, plant: 'grass', from: 'Đào bụi cỏ bằng xẻng' },
  dug_sapling: { name: 'Cây non (đã đào)', icon: '🌿', stack: 10, plant: 'sapling', from: 'Đào cây non bằng xẻng' },
  dug_bush: { name: 'Bụi quả mọng (đã đào)', icon: '🪴', stack: 10, plant: 'bush', from: 'Đào bụi quả mọng bằng xẻng' },

  // Nguyên liệu tinh chế
  rope: { name: 'Dây thừng', icon: '🪢', stack: 40 },
  boards: { name: 'Ván gỗ', icon: '🟫', stack: 40, fuel: 60 },
  cutstone: { name: 'Gạch đá', icon: '🧱', stack: 40 },

  // Thức ăn
  petals: { name: 'Cánh hoa', icon: '🌸', stack: 40, from: 'Hái hoa ở đồng cỏ (+5 tinh thần)', food: { hunger: 0, health: 1, sanity: 0 } },
  berries: { name: 'Quả mọng', icon: '🫐', stack: 40, from: 'Hái bụi quả mọng (mọc lại sau 1,5 phút)', perish: 720, food: { hunger: 9, health: 0, sanity: 0 }, cook: 'roastedberries' },
  roastedberries: { name: 'Quả mọng nướng', icon: '🍇', stack: 40, perish: 960, food: { hunger: 12, health: 1, sanity: 0 } },
  carrot: { name: 'Cà rốt', icon: '🥕', stack: 40, from: 'Nhổ ở đồng cỏ', perish: 720, food: { hunger: 12, health: 1, sanity: 0 }, cook: 'roastedcarrot' },
  roastedcarrot: { name: 'Cà rốt nướng', icon: '🍠', stack: 40, perish: 960, food: { hunger: 12, health: 3, sanity: 0 } },
  morsel: { name: 'Thịt nhỏ', icon: '🥓', stack: 20, from: 'Giết thỏ, hoặc bắt thỏ bằng bẫy', perish: 480, food: { hunger: 9, health: 0, sanity: -10 }, cook: 'cookedmorsel', dry: 'smalljerky' },
  cookedmorsel: { name: 'Thịt nhỏ nướng', icon: '🍢', stack: 20, perish: 960, food: { hunger: 12, health: 1, sanity: 0 } },
  monstermeat: { name: 'Thịt quái', icon: '🥩', stack: 20, from: 'Rơi ra khi giết nhện, chó săn', perish: 480, food: { hunger: 18, health: -20, sanity: -15 }, cook: 'cookedmonstermeat', dry: 'monsterjerky' },
  cookedmonstermeat: { name: 'Thịt quái nướng', icon: '🍖', stack: 20, perish: 960, food: { hunger: 18, health: -3, sanity: -10 } },
  meat: { name: 'Thịt', icon: '🍗', stack: 20, from: 'Giết lợn (1) hoặc bò lông (3–4)', perish: 480, food: { hunger: 25, health: 1, sanity: -10 }, cook: 'cookedmeat', dry: 'jerky' },
  cookedmeat: { name: 'Thịt nướng', icon: '🍖', stack: 20, perish: 960, food: { hunger: 25, health: 3, sanity: 0 } },
  // Thịt khô: phơi đồ sống ("dry") trên Giàn phơi, mất "dryTime" giây.
  jerky: { name: 'Thịt khô', icon: '🦴', stack: 20, dryTime: 120, food: { hunger: 25, health: 20, sanity: 15 } },
  smalljerky: { name: 'Thịt nhỏ khô', icon: '🥨', stack: 20, dryTime: 60, food: { hunger: 12, health: 8, sanity: 10 } },
  monsterjerky: { name: 'Thịt quái khô', icon: '🍫', stack: 20, dryTime: 120, food: { hunger: 18, health: -3, sanity: -5 } },
  meatballs: { name: 'Thịt viên', icon: '🧆', stack: 10, food: { hunger: 62, health: 3, sanity: 5 } },
  monsterstew: { name: 'Thịt quái hầm', icon: '🍲', stack: 10, food: { hunger: 75, health: 5, sanity: -5 } },
  ratatouille: { name: 'Rau củ hầm', icon: '🥘', stack: 10, food: { hunger: 25, health: 20, sanity: 5 } },
  jam: { name: 'Mứt hoa quả', icon: '🍯', stack: 10, food: { hunger: 25, health: 3, sanity: 15 } },
  // Đồ tươi có hạn dùng "perish" (giây): hết hạn thì thành Đồ ôi thiu, rồi biến mất sau thêm "perish" của nó. Đồ khô và món hầm thì không hỏng.
  rotten: { name: 'Đồ ôi thiu', icon: '🤢', stack: 40, from: 'Thức ăn để quá lâu bị hỏng', perish: 240, food: { hunger: 3, health: -8, sanity: -15 } },
  // "cures": dùng xong thì hết trúng độc.
  salve: { name: 'Thuốc đắp', icon: '🩹', stack: 20, cures: true, food: { hunger: 0, health: 25, sanity: 0 } },
  antidote: { name: 'Thuốc giải', icon: '💊', stack: 20, cures: true, food: { hunger: 0, health: 40, sanity: 0 } },

  // Trang bị. "uses": số lần dùng; với giáp là lượng sát thương chặn được; với đồ "burns" là số giây.
  axe: { name: 'Rìu', icon: '🪓', stack: 1, slot: 'hand', tool: 'chop', damage: 27, uses: 100 },
  pickaxe: { name: 'Cuốc chim', icon: '⛏️', stack: 1, slot: 'hand', tool: 'mine', damage: 27, uses: 33 },
  goldenaxe: { name: 'Rìu vàng', icon: '🪓', stack: 1, slot: 'hand', tool: 'chop', damage: 27, uses: 400 },
  goldenpickaxe: { name: 'Cuốc vàng', icon: '⛏️', stack: 1, slot: 'hand', tool: 'mine', damage: 27, uses: 132 },
  // "hint": cách dùng riêng của công cụ, nhân vật tự nhắc khi cầm lần đầu và hiện trong chú thích món đồ.
  shovel: { name: 'Xẻng', icon: '🪏', stack: 1, slot: 'hand', tool: 'dig', damage: 17, uses: 25, hint: 'Bấm vào bụi cỏ, cây non, bụi quả mọng để đào lên, rồi bấm cây trong túi để trồng.' },
  hammer: { name: 'Búa', icon: '🔨', stack: 1, slot: 'hand', tool: 'hammer', damage: 17, uses: 75, hint: 'Bấm vào công trình để đập bỏ, lấy lại một nửa nguyên liệu và đồ bên trong.' },
  spear: { name: 'Giáo', icon: '🔱', stack: 1, slot: 'hand', damage: 34, uses: 150 },
  boomerang: { name: 'Boomerang', icon: '🪃', stack: 1, slot: 'hand', damage: 25, uses: 30, thrown: true },
  // "poison": mỗi đòn trúng làm quái trúng độc (xem POISON).
  fangspear: { name: 'Giáo Nanh Nhện', icon: '🔱', stack: 1, slot: 'hand', damage: 45, uses: 200, poison: true },
  poisonboomerang: { name: 'Boomerang Độc', icon: '🪃', stack: 1, slot: 'hand', damage: 25, uses: 40, thrown: true, poison: true },
  icespear: { name: 'Giáo Băng', icon: '🔱', stack: 1, slot: 'hand', damage: 59, uses: 250 },
  torch: { name: 'Đuốc', icon: '🔥', stack: 1, slot: 'hand', damage: 17, uses: 75, burns: true },
  logsuit: { name: 'Giáp gỗ', icon: '🛡️', stack: 1, slot: 'body', armor: 0.8, uses: 315 },
  furarmor: { name: 'Giáp Lông Deerclops', icon: '🧥', stack: 1, slot: 'body', armor: 0.9, uses: 750 },
  helmet: { name: 'Mũ giáp', icon: '⛑️', stack: 1, slot: 'head', armor: 0.75, uses: 250 },
  backpack: { name: 'Ba lô', icon: '🎒', stack: 1, slot: 'body', pack: true },
  garland: { name: 'Vòng hoa', icon: '💐', stack: 1, slot: 'head', sanityRegen: 0.07, uses: 360, burns: true },
};

export const CATEGORIES = [
  { id: 'tool', name: 'Công cụ', icon: '🛠️' },
  { id: 'light', name: 'Ánh sáng', icon: '🔥' },
  { id: 'survival', name: 'Sinh tồn', icon: '🎒' },
  { id: 'refine', name: 'Tinh chế', icon: '🧪' },
  { id: 'science', name: 'Khoa học', icon: '⚗️' },
  { id: 'gear', name: 'Trang bị', icon: '⚔️' },
  { id: 'food', name: 'Nấu ăn', icon: '🍲' },
];

// place: true nghĩa là chế tạo xong sẽ đặt ngay công trình "id" xuống đất.
// station: phải đứng gần công trình đó mới chế tạo được.
export const RECIPES = [
  { id: 'axe', cat: 'tool', needs: { twigs: 1, flint: 1 }, desc: 'Dùng để chặt cây.' },
  { id: 'pickaxe', cat: 'tool', needs: { twigs: 2, flint: 2 }, desc: 'Dùng để đập đá, có thể ra vàng.' },
  { id: 'shovel', cat: 'tool', needs: { twigs: 2, flint: 2 }, desc: 'Cầm xẻng rồi bấm vào bụi cỏ, cây non, bụi quả mọng để đào cả cây lên. Bấm vào cây đã đào trong túi để trồng cạnh nhà, sau đó nó tự mọc lại như bình thường.' },
  { id: 'goldenaxe', cat: 'tool', station: 'science', needs: { twigs: 4, gold: 2 }, desc: 'Bền gấp 4 lần rìu thường.' },
  { id: 'goldenpickaxe', cat: 'tool', station: 'science', needs: { twigs: 4, gold: 2 }, desc: 'Bền gấp 4 lần cuốc chim thường.' },
  { id: 'hammer', cat: 'tool', needs: { twigs: 3, rocks: 3, flint: 1 }, desc: 'Cầm búa rồi bấm vào công trình (lửa, lều, rương...) để đập bỏ, lấy lại một nửa nguyên liệu và mọi thứ bên trong.' },

  { id: 'torch', cat: 'light', needs: { cutgrass: 2, twigs: 2 }, desc: 'Nguồn sáng mang theo. Cháy 75 giây.' },
  { id: 'campfire', cat: 'light', name: 'Lửa trại', icon: '🏕️', place: true, needs: { cutgrass: 3, log: 2 }, desc: 'Xua tan bóng tối, dùng để nướng đồ. Biến mất khi hết củi.' },
  { id: 'firepit', cat: 'light', name: 'Hố lửa đá', icon: '♨️', place: true, needs: { log: 2, rocks: 12 }, desc: 'Cháy lâu hơn lửa trại và không biến mất khi tắt, chỉ cần thêm củi để nhóm lại.' },

  { id: 'trap', cat: 'survival', name: 'Bẫy thỏ', icon: '🪤', place: true, needs: { twigs: 2, cutgrass: 6 }, desc: 'Đặt ở đồng cỏ, thỏ đi ngang sẽ bị bắt. Bấm vào bẫy để lấy thịt.' },
  { id: 'salve', cat: 'survival', needs: { petals: 3, silk: 1 }, desc: 'Hồi 25 máu và chữa khỏi trúng độc.' },
  { id: 'antidote', cat: 'survival', needs: { spider_venom: 1, petals: 2 }, desc: 'Chữa khỏi trúng độc và hồi 40 máu. Làm từ Độc nhện của Nhện chúa.' },
  { id: 'backpack', cat: 'survival', needs: { cutgrass: 4, twigs: 4 }, desc: `Đeo ở ô Giáp, thêm ${PACK_SIZE} ô đồ. Cởi ra thì đồ vẫn nằm trong ba lô.` },
  { id: 'tent', cat: 'survival', name: 'Lều', icon: '⛺', place: true, station: 'science', needs: { silk: 4, twigs: 4, rope: 3 }, desc: `Bấm vào lều lúc chạng vạng hoặc ban đêm để ngủ: an toàn trong bóng tối, hồi máu và tinh thần nhưng đói nhanh hơn. Ngủ được ${TENT_USES} lần.` },
  { id: 'dryingrack', cat: 'survival', name: 'Giàn phơi', icon: '🪝', place: true, station: 'science', needs: { rope: 3, twigs: 2, charcoal: 2 }, desc: 'Đứng gần giàn, chuột phải vào thịt sống để phơi thành thịt khô (hồi máu và tinh thần).' },
  { id: 'chest', cat: 'survival', name: 'Rương', icon: '🧰', place: true, station: 'science', needs: { boards: 3 }, desc: `Cất giữ ${CHEST_SIZE} ô đồ. Ai cũng mở được, tiện chia đồ với bạn bè.` },
  { id: 'icebox', cat: 'survival', name: 'Hộp Đá Lạnh', icon: '🧊', place: true, station: 'science', needs: { bearger_fur: 1, gold: 2, cutstone: 2 }, desc: `Cất giữ ${CHEST_SIZE} ô đồ, đồ ăn bên trong hư chậm gấp đôi. Làm từ Lông Gấu của boss Bearger.` },

  { id: 'rope', cat: 'refine', station: 'science', needs: { cutgrass: 3 }, desc: 'Nguyên liệu cho giáp, mũ, lều, boomerang.' },
  { id: 'boards', cat: 'refine', station: 'science', needs: { log: 4 }, desc: 'Nguyên liệu cho rương, nồi nấu. Cũng là củi tốt.' },
  { id: 'cutstone', cat: 'refine', station: 'science', needs: { rocks: 3 }, desc: 'Nguyên liệu cho nồi nấu.' },

  { id: 'science', cat: 'science', name: 'Máy Khoa Học', icon: '⚗️', place: true, needs: { gold: 1, log: 4, rocks: 4 }, desc: 'Đứng gần máy để chế tạo đồ cao cấp (các món có 🔒).' },
  { id: 'crockpot', cat: 'science', name: 'Nồi nấu', icon: '🫕', place: true, station: 'science', needs: { cutstone: 3, boards: 2, twigs: 6 }, desc: 'Đứng gần nồi để nấu các món hầm bổ dưỡng.' },

  { id: 'spear', cat: 'gear', needs: { twigs: 2, cutgrass: 2, flint: 1 }, desc: 'Vũ khí cơ bản.' },
  { id: 'boomerang', cat: 'gear', station: 'science', needs: { twigs: 3, flint: 2, gold: 1, rope: 1 }, desc: 'Vũ khí tầm xa: bấm vào quái để ném, tự bay về tay. Làm choáng quái thường. Boss Deerclops chỉ chịu nửa sát thương cận chiến, nên cần món này.' },
  { id: 'fangspear', cat: 'gear', station: 'science', needs: { spider_fang: 2, spider_venom: 1, rope: 2, log: 2 }, desc: 'Giáo làm từ nanh Nhện chúa: sát thương 45, mỗi đòn làm quái trúng độc (boss chịu nửa độc). Độc không tính là cận chiến nên Deerclops vẫn chịu đủ.' },
  { id: 'poisonboomerang', cat: 'gear', station: 'science', needs: { boomerang: 1, spider_fang: 1, spider_venom: 2 }, desc: 'Boomerang tẩm độc: ném như boomerang thường, trúng thì quái bị trúng độc. Bền hơn boomerang thường.' },
  { id: 'icespear', cat: 'gear', station: 'science', needs: { deerclops_eyeball: 1, gold: 3, rope: 2, flint: 4 }, desc: 'Giáo làm từ mắt Deerclops: sát thương 59, rất bền.' },
  { id: 'furarmor', cat: 'gear', station: 'science', needs: { deerclops_eyeball: 1, rope: 4, log: 8, silk: 4 }, desc: 'Giáp lông Deerclops, chặn 90% sát thương, bền gấp đôi giáp gỗ.' },
  { id: 'logsuit', cat: 'gear', station: 'science', needs: { rope: 2, log: 8 }, desc: 'Giáp mặc người, chặn 80% sát thương.' },
  { id: 'helmet', cat: 'gear', station: 'science', needs: { rope: 1, silk: 2, log: 2 }, desc: 'Mũ đội đầu, chặn 75% sát thương.' },
  { id: 'garland', cat: 'gear', needs: { petals: 12 }, desc: 'Đội lên đầu để hồi tinh thần từ từ. Héo sau 6 phút.' },

  { id: 'meatballs', cat: 'food', station: 'crockpot', needs: { morsel: 1, berries: 3 }, desc: 'Rất no bụng.' },
  { id: 'monsterstew', cat: 'food', station: 'crockpot', needs: { monstermeat: 2, carrot: 2 }, desc: 'Hầm thịt quái cho hết độc.' },
  { id: 'ratatouille', cat: 'food', station: 'crockpot', needs: { carrot: 2, berries: 2 }, desc: 'Hồi nhiều máu.' },
  { id: 'jam', cat: 'food', station: 'crockpot', needs: { berries: 4, petals: 2 }, desc: 'Hồi tinh thần.' },
];

export const BIOMES = {
  meadow: { color: [112, 136, 60] },
  forest: { color: [56, 82, 44] },
  rocky: { color: [146, 128, 96] },
  ocean: { color: [38, 84, 120] }, // ngoài bờ biển (bản đồ có giới hạn): không có gì mọc, không đi qua được
};
export const SHORE_COLORS = { sand: [196, 178, 128], shallow: [62, 128, 150] };
export const SHORE_W = 70; // bề rộng dải cát / nước nông vẽ quanh bờ

// Số ngẫu nhiên cố định (0..1) theo seed và tọa độ: cùng đầu vào luôn ra cùng kết quả.
export function hash(seed, x, y) {
  let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const BIOME_TYPES = ['meadow', 'forest', 'rocky'];

// Bản đồ có giới hạn: một hòn đảo quanh điểm hồi sinh, bờ biển uốn lượn theo seed. radius = Infinity là thế giới vô hạn.
// Bán kính bờ theo góc a dao động quanh radius (khoảng ±15%).
export function coastR(seed, radius, a) {
  const p = (k) => hash(seed + 20 + k, 0, 0) * Math.PI * 2;
  return radius * (1 + 0.07 * Math.sin(3 * a + p(0)) + 0.05 * Math.sin(5 * a + p(1)) + 0.03 * Math.sin(11 * a + p(2)));
}

// Khoảng cách từ (x, y) tới bờ theo hướng từ tâm đảo: dương là trên đảo, âm là ngoài biển.
export function coastDist(seed, radius, x, y) {
  if (!Number.isFinite(radius)) return Infinity;
  const dx = x - SPAWN.x, dy = y - SPAWN.y;
  return coastR(seed, radius, Math.atan2(dy, dx)) - Math.hypot(dx, dy);
}

export const onLand = (seed, radius, x, y) => coastDist(seed, radius, x, y) >= 0;

// Điểm ngoài biển (hoặc cách bờ dưới margin) được kéo về theo hướng tâm đảo; null nếu không cần kéo.
export function clampToLand(seed, radius, x, y, margin = 0) {
  if (!Number.isFinite(radius)) return null;
  const dx = x - SPAWN.x, dy = y - SPAWN.y, d = Math.hypot(dx, dy);
  const r = coastR(seed, radius, Math.atan2(dy, dx)) - margin;
  if (d <= r) return null;
  return { x: SPAWN.x + (dx / d) * r, y: SPAWN.y + (dy / d) * r };
}

// Mỗi ô lưới BIOME_CELL có một tâm ngẫu nhiên; một điểm thuộc vùng của tâm gần nhất.
// Ô chứa điểm hồi sinh luôn là đồng cỏ.
function biomeCenter(seed, gx, gy) {
  if (gx === 0 && gy === 0) return { x: SPAWN.x, y: SPAWN.y, b: 'meadow' };
  return {
    x: (gx + 0.15 + 0.7 * hash(seed, gx, gy)) * BIOME_CELL,
    y: (gy + 0.15 + 0.7 * hash(seed + 1, gx, gy)) * BIOME_CELL,
    b: BIOME_TYPES[Math.floor(hash(seed + 2, gx, gy) * BIOME_TYPES.length)],
  };
}

// Trúng độc (giây ms): máu tụt đều trong suốt thời gian độc, bị trúng tiếp thì làm mới chứ không cộng dồn.
// player: tổng máu người chơi mất mỗi lần trúng (nhân với thông số "poison", bỏ qua giáp).
// mob: tổng máu quái mất khi trúng vũ khí độc; boss chỉ chịu bossMul.
export const POISON = { ms: 8000, player: 30, mob: 40, bossMul: 0.5 };

// Ổ Nhện chúa: mỗi ô lưới DEN_CELL có một điểm ứng viên cố định theo seed; DEN_CHANCE số ô có ứng viên, điểm nằm
// trong rừng và cách điểm hồi sinh ít nhất DEN_SAFE thì có ổ. Server và client tính giống nhau nên bản đồ tự biết ổ ở đâu.
export const DEN_CELL = 3600;
export const DEN_CHANCE = 0.5;
export const DEN_SAFE = 2000;

export function denAt(seed, gx, gy, radius = Infinity) {
  if (hash(seed + 10, gx, gy) >= DEN_CHANCE) return null;
  const x = Math.round((gx + 0.2 + 0.6 * hash(seed + 11, gx, gy)) * DEN_CELL);
  const y = Math.round((gy + 0.2 + 0.6 * hash(seed + 12, gx, gy)) * DEN_CELL);
  if (Math.hypot(x - SPAWN.x, y - SPAWN.y) < DEN_SAFE || biomeAt(seed, x, y, radius) !== 'forest') return null;
  if (coastDist(seed, radius, x, y) < 150) return null; // ổ không nằm sát mép biển
  return { x, y, cell: `${gx},${gy}` };
}

// Đảo nhỏ có thể không có ô ổ nào trúng rừng: khi đó đặt đúng một ổ dự phòng, ưu tiên trong rừng.
const fallbackDens = new Map();
function fallbackDen(seed, radius) {
  const key = `${seed},${radius}`;
  if (fallbackDens.has(key)) return fallbackDens.get(key);
  let found = null;
  const n = Math.ceil((radius * 1.2) / DEN_CELL);
  const any = () => {
    for (let gy = -n; gy <= n; gy++) for (let gx = -n; gx <= n; gx++) if (denAt(seed, gx, gy, radius)) return true;
    return false;
  };
  if (!any()) {
    let land = null;
    for (let i = 0; i < 400 && !found; i++) {
      const a = hash(seed + 13, i, 0) * Math.PI * 2;
      const r = DEN_SAFE + hash(seed + 14, i, 0) * (radius * 0.85 - DEN_SAFE);
      const x = Math.round(SPAWN.x + Math.cos(a) * r), y = Math.round(SPAWN.y + Math.sin(a) * r);
      if (coastDist(seed, radius, x, y) < 150) continue;
      const d = { x, y, cell: 'fallback' };
      if (biomeAt(seed, x, y) === 'forest') found = d;
      else land ??= d;
    }
    found ??= land;
  }
  fallbackDens.set(key, found);
  return found;
}

// Mọi ổ có tọa độ trong hình chữ nhật [x0, x1) × [y0, y1).
export function densIn(seed, x0, y0, x1, y1, radius = Infinity) {
  const out = [];
  for (let gy = Math.floor(y0 / DEN_CELL); gy <= Math.floor(y1 / DEN_CELL); gy++) {
    for (let gx = Math.floor(x0 / DEN_CELL); gx <= Math.floor(x1 / DEN_CELL); gx++) {
      const d = denAt(seed, gx, gy, radius);
      if (d && d.x >= x0 && d.x < x1 && d.y >= y0 && d.y < y1) out.push(d);
    }
  }
  const f = Number.isFinite(radius) && fallbackDen(seed, radius);
  if (f && f.x >= x0 && f.x < x1 && f.y >= y0 && f.y < y1) out.push(f);
  return out;
}

// radius: bán kính đảo (xem coastR), ngoài bờ là 'ocean'.
export function biomeAt(seed, x, y, radius = Infinity) {
  if (!onLand(seed, radius, x, y)) return 'ocean';
  const gx = Math.floor(x / BIOME_CELL), gy = Math.floor(y / BIOME_CELL);
  let best = null;
  let bd = Infinity;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const c = biomeCenter(seed, gx + dx, gy + dy);
      const d = (c.x - x) ** 2 + (c.y - y) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
  }
  return best.b;
}

// Đồng hồ mặc định; mỗi thế giới có thể có đồng hồ riêng theo thông số lúc tạo (clockOf trong settings.js).
export const DEFAULT_CLOCK = { len: DAY_LEN, dayEnd: DAY_END, duskEnd: DUSK_END };

export function phaseAt(t, clock = DEFAULT_CLOCK) {
  const d = t % clock.len;
  return d < clock.dayEnd ? 'day' : d < clock.duskEnd ? 'dusk' : 'night';
}

const DUSK_A = 0.45;
const NIGHT_A = 0.94;
const ramp = (x, a, b, v0, v1) => v0 + (v1 - v0) * Math.min(1, Math.max(0, (x - a) / (b - a)));

// Độ tối của màn hình (0 = sáng, 1 = tối hẳn) tại thời điểm t.
export function darknessAt(t, { len, dayEnd, duskEnd } = DEFAULT_CLOCK) {
  const d = t % len;
  if (d < 8) return ramp(d, 0, 8, NIGHT_A, 0);
  if (d < dayEnd - 8) return 0;
  if (d < dayEnd) return ramp(d, dayEnd - 8, dayEnd, 0, DUSK_A);
  if (d < duskEnd - 8) return DUSK_A;
  if (d < duskEnd) return ramp(d, duskEnd - 8, duskEnd, DUSK_A, NIGHT_A);
  return NIGHT_A;
}

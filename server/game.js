import {
  CHUNK, SPAWN, chunkOf, chunkKey, PLAYER_SPEED, MAX_HP, MAX_HUNGER, MAX_SANITY, INV_SIZE, PACK_SIZE, CHEST_SIZE, ACT_RANGE,
  TENT_USES, TORCH_RADIUS, FIRES, STATIONS, GEAR_SLOTS, ITEMS, RECIPES, DAY_LEN, DROP_LIFE, BOOMERANG, biomeAt, phaseAt, fireRadius,
} from '../shared/data.js';

const SAVE_EVERY_MS = 30000;
// Dừng đồng hồ thế giới khi không còn ai online (đặt PAUSE_WHEN_EMPTY=0 để tắt)
const PAUSE_WHEN_EMPTY = process.env.PAUSE_WHEN_EMPTY !== '0';
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

// Chó săn: đợt đầu vào khoảng ngày 4, sau đó cứ 2.5–4 ngày một đợt, càng về sau càng đông.
const HOUND = { firstDay: 3.5, gapMin: 2.5, gapMax: 4, base: 2, perDays: 4, max: 6, warnAt: [25, 10], spawnDist: 650 };

// Boss Deerclops: tới vào đầu ngày 11 (~phút 40). Bị hạ thì 10 ngày sau quay lại; bỏ đi thì 3 ngày sau quay lại.
// Đòn vồ: gồng windupMs rồi đập xuống vùng tròn slamR quanh chỗ người chơi đứng lúc bắt đầu gồng (chạy ra là né được).
// Sát thương giảm dần từ slamMax ở tâm xuống slamMin ở rìa. Đứng trong bán kính stunR quanh tâm thì bị choáng stunMs.
// Lông dày: đánh cận chiến chỉ gây meleeMul sát thương, nên cần boomerang.
// Công trình nằm trong vùng đập có smashChance bị phá (rơi lại nửa nguyên liệu + đồ bên trong).
const BOSS = {
  firstDay: 11, gapDays: 10, returnDays: 3, warnAt: [30, 10], spawnDist: 700,
  hp: 1500, hpPerPlayer: 750, hpMax: 4000, meleeMul: 0.5, smashChance: 0.5,
  slamMax: 90, slamMin: 30, slamR: 140, stunR: 50, stunMs: 500, reach: 120, windupMs: 900, recoverMs: 1400, leaveAfter: 45,
};

const VIEW_CHUNKS = 1; // gửi các chunk trong bán kính 1 quanh người chơi (lưới 3x3)
const KEEP_CHUNKS = 2; // chỉ bỏ chunk khi đã ra xa hơn bán kính này (tránh gửi đi gửi lại)
const MOB_VIEW = 1600; // chỉ gửi quái trong khoảng cách này
const MOB_DESPAWN = 2600; // quái ở quá xa mọi người chơi sẽ bị xóa

const TICK_MS = 50;
const HUNGER_RATE = MAX_HUNGER / 480; // no -> đói trong khoảng 8 phút
const RESPAWN_MS = 12000;
const RESPAWN_SAFE_MS = 25000; // vừa hồi sinh thì bóng tối chưa tấn công được trong chừng này thời gian
const COLORS = [0xe05d5d, 0x5d9be0, 0x6fd06f, 0xe0c35d, 0xb86fe0, 0xe08f5d, 0x5de0d0, 0xe05db3];

// Ngủ trong lều (mỗi giây): hồi tinh thần, hồi máu, đói thêm.
const SLEEP = { sanity: 1.5, health: 1, hunger: 0.5, minHunger: 25, mobRange: 400 };

const MOBS = {
  spider: {
    name: 'nhện', hp: 100, speed: 150, wander: 50, damage: 20, cooldown: 1500, sight: 420, daySight: 200, hostile: true,
    drops: [['monstermeat', 1, 1], ['silk', 1, 0.5]], perPlayer: 3, home: 'forest', safeFromSpawn: 900,
  },
  hound: {
    name: 'chó săn', hp: 150, speed: 215, wander: 60, damage: 20, cooldown: 1800, sight: 900, daySight: 900, leash: 2000,
    hostile: true, drops: [['monstermeat', 1, 1], ['monstermeat', 1, 0.3]], perPlayer: 0,
  },
  rabbit: {
    name: 'thỏ', hp: 25, speed: 230, wander: 45, flee: 150,
    drops: [['morsel', 1, 1]], perPlayer: 5, home: 'meadow', safeFromSpawn: 0,
  },
  // neutral: đi lang thang, chỉ đánh lại người đánh nó. herd: cả đàn xung quanh cùng đánh lại.
  pig: {
    name: 'lợn', hp: 200, speed: 165, wander: 40, damage: 15, cooldown: 2000, leash: 600, neutral: true,
    drops: [['meat', 1, 1]], perPlayer: 2, home: 'forest', safeFromSpawn: 0,
  },
  beefalo: {
    name: 'bò lông', hp: 500, speed: 130, wander: 30, damage: 30, cooldown: 3000, leash: 500, neutral: true, herd: 350,
    drops: [['meat', 3, 1], ['meat', 1, 0.5]], perPlayer: 3, home: 'rocky', safeFromSpawn: 0,
  },
  deerclops: {
    name: 'Deerclops', hp: BOSS.hp, speed: 115, wander: 40, sight: 1400, daySight: 1400, leash: 2600, hostile: true, boss: true,
    drops: [['deerclops_eyeball', 2, 1], ['meat', 8, 1]], perPlayer: 0,
  },
};

// Cách tương tác với từng loại tài nguyên trong thế giới.
const RESOURCE = {
  tree: { hp: 4, tool: 'chop', drops: [['log', 2]], respawn: 90, fail: 'Mình cần một cái rìu.' },
  boulder: { hp: 6, tool: 'mine', drops: [['rocks', 2], ['flint', 1, 0.7], ['gold', 1, 0.35]], respawn: 120, fail: 'Mình cần một cái cuốc chim.' },
  sapling: { pick: 'twigs', regrow: 60, dig: 'dug_sapling' },
  grass: { pick: 'cutgrass', regrow: 60, dig: 'dug_grass' },
  bush: { pick: 'berries', count: 2, regrow: 90, dig: 'dug_bush' },
  flower: { pick: 'petals', remove: true, respawn: 60, sanity: 5 },
  flint: { pick: 'flint', remove: true, respawn: 60 },
  carrot: { pick: 'carrot', remove: true, respawn: 90 },
};

// Công trình người chơi đặt xuống (đập được bằng búa).
const STRUCTURES = new Set(RECIPES.filter((r) => r.place).map((r) => r.id));

const SPAWN_TABLE = {
  meadow: [['grass', 30], ['sapling', 18], ['flower', 18], ['carrot', 10], ['bush', 10], ['tree', 6], ['boulder', 2]],
  forest: [['tree', 60], ['sapling', 12], ['grass', 6], ['bush', 4], ['boulder', 2]],
  rocky: [['boulder', 40], ['flint', 25], ['grass', 12], ['sapling', 10], ['tree', 3]],
};
const DENSITY = { meadow: 0.55, forest: 1, rocky: 0.6 };
const ENTS_PER_CHUNK = 115;

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pub = ({ regrowAt, life, ...rest }) => rest;
const emptyGear = () => ({ hand: null, head: null, body: null });
// Dữ liệu riêng của món đồ cần giữ khi chuyển chỗ (đồ trong ba lô).
// Phần "đi kèm" của một món khi chuyển chỗ: đồ trong ba lô, và độ cũ của đồ tươi.
const packed = (it) => (it.slots || it.age ? { ...(it.slots && { slots: it.slots }), ...(it.age && { age: it.age }) } : undefined);

// Đồ tươi cũ dần theo giây. Hết hạn thì thành Đồ ôi thiu; đồ ôi thiu hết hạn thì biến mất.
// Trả về 'rot' (vừa đổi thành đồ ôi), 'gone' (biến mất) hoặc null.
function ageItem(it, dt) {
  const def = ITEMS[it.id];
  if (!def.perish) return null;
  it.age = (it.age ?? 0) + dt;
  if (it.age < def.perish) return null;
  if (it.id === 'rotten') return 'gone';
  it.id = 'rotten';
  it.age = 0;
  return 'rot';
}

// Cho cả một dãy ô (túi, rương) cũ thêm dt giây. Trả về true nếu có món đổi hoặc mất.
function ageSlots(slots, dt) {
  let changed = false;
  for (let i = 0; i < slots.length; i++) {
    const it = slots[i];
    if (!it) continue;
    const r = ageItem(it, dt);
    if (r === 'gone') slots[i] = null;
    if (r) changed = true;
  }
  return changed;
}

function pickWeighted(table) {
  let r = Math.random() * table.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of table) if ((r -= w) <= 0) return k;
  return table[0][0];
}

// Thêm đồ vào một dãy ô (túi đồ hoặc rương). Trả về số lượng không chứa được.
function addToSlots(slots, id, count, dur, extra) {
  const def = ITEMS[id];
  let left = count;
  if (def.stack > 1) {
    for (const s of slots) {
      if (left <= 0) break;
      if (s && s.id === id && s.count < def.stack) {
        const n = Math.min(left, def.stack - s.count);
        s.age = ((s.age ?? 0) * s.count + (extra?.age ?? 0) * n) / (s.count + n); // trộn độ cũ theo số lượng
        s.count += n;
        left -= n;
      }
    }
  }
  for (let i = 0; i < slots.length && left > 0; i++) {
    if (slots[i]) continue;
    const n = Math.min(left, def.stack);
    slots[i] = def.uses ? { id, count: n, dur: dur ?? def.uses, ...extra } : { id, count: n, ...extra };
    left -= n;
  }
  return left;
}

// Một thế giới (server game). Có thể chạy nhiều thế giới cùng lúc trong một tiến trình Node;
// mỗi thế giới dùng kênh socket riêng "w:<id>" và tự lưu qua hàm persist do WorldManager cung cấp.
export class Game {
  constructor(io, { id, name, data, persist }) {
    this.io = io;
    this.worldId = id;
    this.name = name;
    this.room = `w:${id}`;
    this.persist = persist;
    this.nextId = 1;
    this.players = new Map();
    this.ents = new Map();
    this.fires = new Set();
    this.traps = new Set();
    this.mobs = new Map();
    this.respawnQueue = [];
    this.t = Number(process.env.START_TIME) || 15; // START_TIME=200 để thử ban đêm
    this.tickCount = 0;
    this.seed = Number(process.env.SEED) || Math.floor(Math.random() * 2 ** 31);
    this.chunks = new Map(); // "cx,cy" -> Set các vật thể trong chunk
    this.saves = new Map(); // mã bí mật của người chơi -> nhân vật đã lưu
    this.nextHound = HOUND.firstDay * DAY_LEN;
    this.houndWarned = 0;
    this.houndQueue = [];
    this.nextBoss = (BOSS.firstDay - 1) * DAY_LEN;
    this.bossWarned = 0;
    this.booms = new Map(); // boomerang đang bay

    if (data) this.restore(data);
    else this.ensureChunk(...chunkOf(SPAWN.x, SPAWN.y));

    this.last = Date.now();
    this.timers = [
      setInterval(() => this.tick(), TICK_MS),
      setInterval(() => this.slowTick(), 1000),
      setInterval(() => this.save(), SAVE_EVERY_MS),
    ];
  }

  get day() { return Math.floor(this.t / DAY_LEN) + 1; }

  // Lưu và dừng vòng lặp (khi gỡ thế giới khỏi bộ nhớ hoặc tắt server).
  stop() {
    this.save();
    for (const t of this.timers) clearInterval(t);
  }

  // Đẩy mọi người chơi ra (khi admin xóa server).
  kickAll(reason) {
    for (const p of [...this.players.values()]) {
      p.socket.emit('kicked', { reason });
      this.leave(p);
      p.socket.disconnect(true);
    }
  }

  // ---------- Lưu / nạp ----------

  snapshotPlayer(p) {
    const { name, color, x, y, hp, hunger, sanity, inv, gear, survived, dead } = p;
    return { name, color, x, y, hp, hunger, sanity, inv, gear, survived, dead };
  }

  save() {
    for (const p of this.players.values()) this.saves.set(p.token, this.snapshotPlayer(p));
    try {
      this.persist({
        version: 1, seed: this.seed, t: this.t, nextId: this.nextId, nextHound: this.nextHound, nextBoss: this.nextBoss,
        respawnQueue: this.respawnQueue, chunks: [...this.chunks.keys()],
        ents: [...this.ents.values()], players: Object.fromEntries(this.saves),
      }, this.day);
    } catch (err) {
      console.error(`Lưu thế giới "${this.name}" thất bại:`, err.message);
    }
  }

  restore(data) {
    this.seed = data.seed;
    this.t = data.t;
    this.nextId = data.nextId;
    this.nextHound = data.nextHound ?? this.nextHound;
    // Thế giới cũ (trước khi có boss) đã qua ngày 11 thì cho boss tới sau 1 phút, có báo trước.
    this.nextBoss = data.nextBoss ?? Math.max(this.nextBoss, this.t + 60);
    this.respawnQueue = data.respawnQueue ?? [];
    for (const key of data.chunks) this.chunks.set(key, new Set());
    for (const e of data.ents) {
      this.ents.set(e.id, e);
      this.ensureChunk(...chunkOf(e.x, e.y)).add(e);
      if (FIRES[e.type]) this.fires.add(e);
      if (e.type === 'trap') this.traps.add(e);
    }
    this.saves = new Map(Object.entries(data.players ?? {}));
    console.log(`Đã nạp thế giới "${this.name}": ngày ${this.day}, ${this.chunks.size} chunk, ${this.ents.size} vật thể, ${this.saves.size} nhân vật.`);
  }

  id() { return this.nextId++; }
  emit(ev, data) { this.io.to(this.room).emit(ev, data); }
  chunkRoom(key) { return `${this.room}:c:${key}`; }
  emitChunk(e, ev, data) { this.io.to(this.chunkRoom(chunkKey(...chunkOf(e.x, e.y)))).emit(ev, data); }

  // ---------- Thế giới ----------

  // Tạo chunk lần đầu có người chơi tới gần. Chunk đã tạo được giữ lại mãi.
  ensureChunk(cx, cy) {
    const key = chunkKey(cx, cy);
    let set = this.chunks.get(key);
    if (set) return set;
    set = new Set();
    this.chunks.set(key, set);
    const x0 = cx * CHUNK, y0 = cy * CHUNK;
    let placed = 0;
    for (let i = 0; i < 450 && placed < ENTS_PER_CHUNK; i++) {
      const x = x0 + rand(0, CHUNK), y = y0 + rand(0, CHUNK);
      if (Math.hypot(x - SPAWN.x, y - SPAWN.y) < 160) continue;
      const b = biomeAt(this.seed, x, y);
      if (Math.random() > DENSITY[b]) continue;
      if (!this.spaceFree(x, y, 42)) continue;
      this.addEnt(pickWeighted(SPAWN_TABLE[b]), x, y);
      placed++;
    }
    // Đảm bảo có đủ nguyên liệu khởi đầu gần điểm hồi sinh.
    if (key === chunkKey(...chunkOf(SPAWN.x, SPAWN.y))) {
      const starter = ['sapling', 'sapling', 'sapling', 'grass', 'grass', 'grass', 'grass', 'flint', 'flint', 'flint', 'tree', 'tree', 'tree', 'bush', 'flower', 'boulder', 'boulder'];
      for (const type of starter) {
        for (let tries = 0; tries < 30; tries++) {
          const a = rand(0, Math.PI * 2), r = rand(180, 420);
          const x = SPAWN.x + Math.cos(a) * r, y = SPAWN.y + Math.sin(a) * r;
          if (this.spaceFree(x, y, 40)) { this.addEnt(type, x, y); break; }
        }
      }
    }
    return set;
  }

  // Các vật thể trong những chunk quanh điểm (x, y).
  *entsNear(x, y, radius) {
    const [ax, ay] = chunkOf(x - radius, y - radius);
    const [bx, by] = chunkOf(x + radius, y + radius);
    for (let cy = ay; cy <= by; cy++) {
      for (let cx = ax; cx <= bx; cx++) {
        const set = this.chunks.get(chunkKey(cx, cy));
        if (set) yield* set;
      }
    }
  }

  spaceFree(x, y, r) {
    for (const e of this.entsNear(x, y, r)) {
      if (e.type === 'drop') continue;
      if (Math.abs(e.x - x) < r && Math.abs(e.y - y) < r && Math.hypot(e.x - x, e.y - y) < r) return false;
    }
    return true;
  }

  addEnt(type, x, y, extra = {}) {
    const e = { id: this.id(), type, x: Math.round(x), y: Math.round(y), ...extra };
    const r = RESOURCE[type];
    if (r?.hp) e.hp = r.hp;
    if (r?.regrow) e.ready ??= true;
    if (type === 'flower') e.v = Math.floor(Math.random() * 5);
    if (FIRES[type]) this.fires.add(e);
    if (type === 'trap') this.traps.add(e);
    this.ents.set(e.id, e);
    this.ensureChunk(...chunkOf(e.x, e.y)).add(e);
    this.emitChunk(e, 'ent:add', pub(e));
    return e;
  }

  updEnt(e) { this.emitChunk(e, 'ent:upd', pub(e)); }

  removeEnt(e) {
    this.ents.delete(e.id);
    this.fires.delete(e);
    this.traps.delete(e);
    this.chunks.get(chunkKey(...chunkOf(e.x, e.y)))?.delete(e);
    this.emitChunk(e, 'ent:del', e.id);
  }

  // Tài nguyên bị lấy đi sẽ mọc lại đúng chỗ cũ.
  queueRespawn(e) {
    const r = RESOURCE[e.type];
    if (r?.respawn) this.respawnQueue.push({ type: e.type, x: e.x, y: e.y, at: this.t + r.respawn });
  }

  // Đồ tạm (đuốc tặng lúc hồi sinh) không bao giờ nằm lại trên đất: chết hay vứt đi là mất luôn.
  spawnDrop(x, y, item) {
    if (item.temp) return;
    this.addEnt('drop', x, y, { item: { ...item }, life: 0 });
  }

  spawnMob(type, x, y, extra = {}) {
    const m = { id: this.id(), type, x, y, hp: MOBS[type].hp, target: null, atk: 0, vx: 0, vy: 0, wt: 0, ...extra };
    this.mobs.set(m.id, m);
    return m;
  }

  nearFire(p, mustBeLit = true) {
    for (const f of this.fires) if ((!mustBeLit || f.fuel > 0) && dist(p, f) < 120) return f;
    return null;
  }

  nearStation(p, type) {
    const range = STATIONS[type].range;
    for (const e of this.entsNear(p.x, p.y, range + 20)) if (e.type === type && dist(p, e) <= range + 20) return e;
    return null;
  }

  isLit(x, y) {
    for (const f of this.fires) if (Math.hypot(f.x - x, f.y - y) < fireRadius(f.fuel) * 0.75) return true;
    for (const p of this.players.values()) {
      if (!p.dead && p.gear.hand?.id === 'torch' && Math.hypot(p.x - x, p.y - y) < TORCH_RADIUS * 0.75) return true;
    }
    return false;
  }

  // Tìm chỗ trống gần người chơi để đặt công trình.
  placeSpot(p) {
    const offsets = [[0, 45], [55, 25], [-55, 25], [0, -50], [65, -35], [-65, -35], [0, 95], [95, 0], [-95, 0]];
    for (const [dx, dy] of offsets) {
      const x = p.x + dx, y = p.y + dy;
      if (this.spaceFree(x, y, 36)) return { x, y };
    }
    return null;
  }

  // Gửi cho người chơi các chunk quanh họ, bỏ các chunk đã ở quá xa.
  updateChunks(p, force = false) {
    if (!p.ready) return;
    const [cx, cy] = chunkOf(p.x, p.y);
    if (!force && p.ccx === cx && p.ccy === cy) return;
    p.ccx = cx;
    p.ccy = cy;
    for (let dy = -VIEW_CHUNKS; dy <= VIEW_CHUNKS; dy++) {
      for (let dx = -VIEW_CHUNKS; dx <= VIEW_CHUNKS; dx++) {
        const key = chunkKey(cx + dx, cy + dy);
        if (p.chunks.has(key)) continue;
        const set = this.ensureChunk(cx + dx, cy + dy);
        p.chunks.add(key);
        p.socket.join(this.chunkRoom(key));
        p.socket.emit('chunk', { cx: cx + dx, cy: cy + dy, ents: [...set].map(pub) });
      }
    }
    for (const key of p.chunks) {
      const [kx, ky] = key.split(',').map(Number);
      if (Math.abs(kx - cx) <= KEEP_CHUNKS && Math.abs(ky - cy) <= KEEP_CHUNKS) continue;
      p.chunks.delete(key);
      p.socket.leave(this.chunkRoom(key));
      p.socket.emit('unchunk', { cx: kx, cy: ky });
    }
  }

  // ---------- Người chơi ----------

  // Người chơi được nhận diện bằng mã bí mật do trình duyệt tạo (không phải tên),
  // để người khác gõ trùng tên cũng không lấy được nhân vật.
  join(socket, name, token) {
    name = String(name || '').trim().slice(0, 16) || 'Người sống sót';
    token = TOKEN_RE.test(String(token)) ? String(token) : `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Cùng nhân vật đang mở ở tab khác: lưu lại rồi đẩy tab cũ ra
    for (const old of this.players.values()) {
      if (old.token !== token) continue;
      old.socket.emit('kicked', { reason: 'Nhân vật của bạn vừa được mở ở một tab hoặc cửa sổ khác.' });
      this.leave(old);
      old.socket.disconnect(true);
    }

    const saved = this.saves.get(token);
    const used = new Set([...this.players.values()].map((p) => p.color));
    const p = {
      id: this.id(), socket, token, name,
      color: saved && !used.has(saved.color) ? saved.color : COLORS.find((c) => !used.has(c)) ?? COLORS[this.players.size % COLORS.length],
      x: SPAWN.x + rand(-80, 80), y: SPAWN.y + rand(-80, 80),
      ready: false, chunks: new Set(), ccx: null, ccy: null,
      hp: MAX_HP, hunger: MAX_HUNGER, sanity: MAX_SANITY, survived: 0,
      inv: Array(INV_SIZE).fill(null), gear: emptyGear(), chest: null,
      dead: false, respawnAt: 0, safeUntil: 0, lastAct: 0, lastPos: Date.now(), allow: 0, dark: 0, warned: false, sleep: null,
    };
    // Nhân vật cũ còn sống thì khôi phục nguyên trạng; đã chết lúc thoát thì bắt đầu lại từ đầu.
    if (saved && !saved.dead) {
      Object.assign(p, {
        x: saved.x, y: saved.y, hp: saved.hp, hunger: saved.hunger, sanity: saved.sanity,
        inv: saved.inv, gear: saved.gear, survived: saved.survived ?? 0,
      });
    }
    this.players.set(p.id, p);
    socket.join(this.room);
    socket.emit('init', {
      you: p.id, x: p.x, y: p.y, t: this.t, seed: this.seed, players: this.roster(), serverName: this.name,
    });
    this.sendInv(p);
    this.sendStats(p);
    this.emit('roster', this.roster());
    this.system(saved && !saved.dead ? `${p.name} đã quay lại thế giới.` : `${p.name} đã tham gia thế giới.`);
    return p;
  }

  // Client đã dựng xong màn chơi, bắt đầu gửi dữ liệu các chunk xung quanh.
  onReady(p) {
    p.ready = true;
    this.updateChunks(p, true);
  }

  leave(p) {
    if (!this.players.has(p.id)) return;
    this.wake(p);
    for (const b of [...this.booms.values()]) if (b.owner === p.id) this.catchBoom(p, b);
    this.saves.set(p.token, this.snapshotPlayer(p));
    this.players.delete(p.id);
    p.socket.leave(this.room);
    for (const key of p.chunks) p.socket.leave(this.chunkRoom(key));
    if (this.players.size === 0) this.save();
    for (const m of this.mobs.values()) if (m.target === p.id) m.target = null;
    this.emit('roster', this.roster());
    this.system(`${p.name} đã rời đi.`);
  }

  roster() {
    return [...this.players.values()].map((p) => ({
      id: p.id, name: p.name, color: p.color, days: Math.floor(p.survived / DAY_LEN),
    }));
  }

  sendInv(p) { p.socket.emit('inv', { inv: p.inv, gear: p.gear }); }
  sendStats(p) { p.socket.emit('me', { hp: p.hp, hunger: p.hunger, sanity: p.sanity, dead: p.dead }); }
  say(p, text) { this.emit('say', { id: p.id, text }); }
  system(text) { this.emit('chat', { sys: true, text }); }
  fail(p, text) { p.socket.emit('fail'); this.say(p, text); }

  give(p, id, count = 1, dur, dropLeft = true, extra) {
    const def = ITEMS[id];
    if (!def) return 0;
    let left = addToSlots(p.inv, id, count, dur, extra);
    if (left > 0 && dropLeft) {
      this.spawnDrop(p.x + rand(-15, 15), p.y + rand(5, 15), def.uses ? { id, count: left, dur: dur ?? def.uses, ...extra } : { id, count: left, ...extra });
      this.say(p, 'Túi đồ đầy rồi.');
      left = 0;
    }
    this.sendInv(p);
    return left;
  }

  countItem(p, id) {
    return p.inv.reduce((s, it) => s + (it && it.id === id ? it.count : 0), 0);
  }

  takeItem(p, id, n) {
    for (let i = 0; i < p.inv.length && n > 0; i++) {
      const it = p.inv[i];
      if (!it || it.id !== id) continue;
      const k = Math.min(n, it.count);
      it.count -= k;
      n -= k;
      if (it.count <= 0) p.inv[i] = null;
    }
  }

  // Đeo ba lô: các ô của ba lô nối vào cuối túi đồ (p.inv dài thêm PACK_SIZE ô).
  packOn(p, it) {
    if (!ITEMS[it.id].pack) return;
    p.inv.length = INV_SIZE;
    p.inv.push(...(it.slots ?? Array(PACK_SIZE).fill(null)));
    delete it.slots;
  }

  // Cởi ba lô: đồ ở các ô thêm được cất lại vào trong ba lô.
  packOff(p, it) {
    if (ITEMS[it.id].pack) it.slots = p.inv.splice(INV_SIZE);
  }

  consumeSlot(p, slot) {
    const it = p.inv[slot];
    if (--it.count <= 0) p.inv[slot] = null;
  }

  // Làm mòn công cụ / vũ khí đang cầm.
  wear(p) {
    const it = p.gear.hand;
    if (!it) return;
    const def = ITEMS[it.id];
    if (def.burns) return;
    it.dur -= 1;
    if (it.dur <= 0) {
      this.say(p, `${def.name} đã hỏng!`);
      p.gear.hand = null;
    }
    this.sendInv(p);
  }

  // Giáp và mũ chặn bớt sát thương, đồng thời bị mòn theo lượng đã chặn.
  absorb(p, n) {
    const slots = ['head', 'body'].filter((s) => ITEMS[p.gear[s]?.id]?.armor);
    if (!slots.length) return n;
    const absorbed = n * Math.max(...slots.map((s) => ITEMS[p.gear[s].id].armor));
    for (const s of slots) {
      const it = p.gear[s];
      it.dur -= absorbed / slots.length;
      if (it.dur <= 0) {
        this.say(p, `${ITEMS[it.id].name} đã hỏng!`);
        p.gear[s] = null;
      }
    }
    this.sendInv(p);
    return n - absorbed;
  }

  hurt(p, n, cause, { quiet = false, armored = false } = {}) {
    if (p.dead) return;
    if (!quiet) this.wake(p, 'Ui da! Có gì đó tấn công!');
    if (armored) n = this.absorb(p, n);
    p.hp -= n;
    if (!quiet) this.emit('fx', { k: 'hurt', id: p.id, n: Math.round(n) });
    if (p.hp <= 0) this.kill(p, cause);
  }

  kill(p, cause) {
    p.dead = true;
    p.hp = 0;
    p.dark = 0;
    p.chest = null;
    p.respawnAt = Date.now() + RESPAWN_MS;
    p.sleep = null;
    for (const b of [...this.booms.values()]) {
      if (b.owner !== p.id) continue;
      this.booms.delete(b.id);
      this.spawnDrop(b.x, b.y + 30, b.item);
    }
    if (p.gear.body) this.packOff(p, p.gear.body); // ba lô rơi xuống kèm đồ bên trong
    for (const it of [...p.inv, ...Object.values(p.gear)]) {
      if (it) this.spawnDrop(p.x + rand(-40, 40), p.y + rand(-30, 30), it);
    }
    p.inv = Array(INV_SIZE).fill(null);
    p.gear = emptyGear();
    for (const m of this.mobs.values()) if (m.target === p.id) m.target = null;
    this.sendInv(p);
    this.sendStats(p);
    const days = Math.floor(p.survived / DAY_LEN);
    p.survived = 0;
    p.socket.emit('died', { cause, respawn: RESPAWN_MS / 1000, days });
    this.system(`☠ ${p.name} đã chết vì ${cause} sau ${days} ngày sống sót.`);
    this.emit('roster', this.roster());
  }

  respawn(p) {
    p.dead = false;
    p.hp = 100;
    p.hunger = 100;
    p.sanity = 120;
    p.x = SPAWN.x + rand(-60, 60);
    p.y = SPAWN.y + rand(-60, 60);
    p.allow = 0;
    p.dark = 0;
    p.warned = false;
    // Không bị bóng tối tấn công một lúc; hồi sinh lúc chạng vạng / ban đêm thì được cầm sẵn một cây đuốc.
    p.safeUntil = Date.now() + RESPAWN_SAFE_MS;
    if (phaseAt(this.t) !== 'day') {
      p.gear.hand = { id: 'torch', count: 1, dur: ITEMS.torch.uses, temp: true }; // đuốc tạm: không rơi ra, không cất được
      this.sendInv(p);
      this.say(p, 'Trời tối rồi... may mà có cây đuốc.');
    }
    this.updateChunks(p);
    p.socket.emit('teleport', { x: p.x, y: p.y });
    p.socket.emit('respawned');
    this.sendStats(p);
    this.system(`${p.name} đã hồi sinh.`);
  }

  // ---------- Xử lý lệnh từ client ----------

  onPos(p, d) {
    const x = Number(d?.x), y = Number(d?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const now = Date.now();
    // Bị choáng: đứng im, kéo về chỗ cũ nếu client vẫn gửi vị trí mới (gói tin gửi trước khi biết mình bị choáng).
    if (now < p.stunUntil) {
      p.lastPos = now;
      if (Math.hypot(x - p.x, y - p.y) > 2) p.socket.emit('teleport', { x: p.x, y: p.y });
      return;
    }
    const el = Math.min(1, (now - p.lastPos) / 1000);
    p.lastPos = now;
    // "Xô token": cho phép gói tin đến dồn cục nhưng chặn tốc độ di chuyển bất thường.
    p.allow = Math.min(PLAYER_SPEED * 2, p.allow + PLAYER_SPEED * 1.25 * el);
    const tx = x, ty = y;
    const dd = Math.hypot(tx - p.x, ty - p.y);
    if (dd <= p.allow + 4) {
      p.x = tx;
      p.y = ty;
      p.allow = Math.max(0, p.allow - dd);
    } else {
      const k = (p.allow + 4) / dd;
      p.x += (tx - p.x) * k;
      p.y += (ty - p.y) * k;
      p.allow = 0;
      p.socket.emit('teleport', { x: p.x, y: p.y });
    }
    // Đi ra khỏi lều là thức dậy (bỏ qua gói tin vị trí cũ gửi trước lúc vào lều).
    if (p.sleep && now - p.sleep.at > 600) {
      const tent = this.ents.get(p.sleep.tent);
      if (!tent || dist(p, tent) > 30) this.wake(p);
    }
    this.updateChunks(p);
  }

  onAct(p, d) {
    const now = Date.now();
    if (p.dead || now < p.stunUntil) return;
    if (now - p.lastAct < 350) return;
    p.lastAct = now;
    this.wake(p);
    const id = Number(d?.id);

    const m = this.mobs.get(id);
    if (m) {
      if (dist(p, m) <= ACT_RANGE) this.attackMob(p, m);
      return;
    }

    const e = this.ents.get(id);
    if (!e || dist(p, e) > ACT_RANGE) return;

    if (e.type === 'drop') {
      const left = this.give(p, e.item.id, e.item.count, e.item.dur, false, packed(e.item));
      if (left === e.item.count) return this.fail(p, 'Túi đồ đầy rồi.');
      if (left === 0) this.removeEnt(e);
      else { e.item.count = left; this.updEnt(e); }
      this.emit('fx', { k: 'pick', by: p.id, what: 'drop' });
      return;
    }

    if (STRUCTURES.has(e.type)) return this.actStructure(p, e);

    const r = RESOURCE[e.type];
    if (!r) return;

    // Cầm xẻng: đào cả cây lên (kèm luôn quả/cành nếu đang có) để đem trồng chỗ khác.
    if (r.dig && ITEMS[p.gear.hand?.id]?.tool === 'dig') {
      this.removeEnt(e);
      this.wear(p);
      this.emit('fx', { k: 'chop', id: e.id, by: p.id });
      if (e.ready) this.give(p, r.pick, r.count || 1);
      this.give(p, r.dig, 1);
      return;
    }

    if (r.tool) {
      if (ITEMS[p.gear.hand?.id]?.tool !== r.tool) return this.fail(p, r.fail);
      e.hp -= 1;
      this.wear(p);
      this.emit('fx', { k: 'chop', id: e.id, by: p.id });
      if (e.hp <= 0) {
        this.removeEnt(e);
        this.queueRespawn(e);
        for (const [item, n, chance = 1] of r.drops) if (Math.random() < chance) this.give(p, item, n);
      }
      return;
    }

    if (r.pick) {
      if (r.regrow && !e.ready) return this.fail(p, 'Nó chưa mọc lại.');
      this.give(p, r.pick, r.count || 1);
      if (r.sanity) p.sanity = Math.min(MAX_SANITY, p.sanity + r.sanity);
      this.emit('fx', { k: 'pick', by: p.id, what: e.type });
      if (r.remove) {
        this.removeEnt(e);
        this.queueRespawn(e);
      } else {
        e.ready = false;
        e.regrowAt = this.t + r.regrow;
        this.updEnt(e);
      }
    }
  }

  actStructure(p, e) {
    if (ITEMS[p.gear.hand?.id]?.tool === 'hammer') return this.hammer(p, e);
    if (e.type === 'chest') {
      p.chest = e.id;
      p.socket.emit('chest:open', { id: e.id });
      return;
    }
    if (e.type === 'trap') {
      if (!e.caught) return this.fail(p, 'Bẫy chưa bắt được gì.');
      e.caught = false;
      this.updEnt(e);
      this.give(p, 'morsel', 1);
      this.emit('fx', { k: 'pick', by: p.id });
    }
    if (e.type === 'tent') return this.sleepIn(p, e);
    if (e.type === 'dryingrack') {
      if (!e.dry) return this.fail(p, 'Đứng gần giàn, chuột phải vào thịt sống trong túi để phơi.');
      const left = Math.ceil(e.dry.at - this.t);
      if (left > 0) return this.fail(p, `${ITEMS[e.dry.out].name} chưa khô, còn ${left} giây nữa.`);
      this.give(p, e.dry.out, 1);
      e.dry = null;
      this.updEnt(e);
      this.emit('fx', { k: 'pick', by: p.id });
    }
  }

  // Giàn phơi còn trống gần người chơi (null nếu không có), và có giàn nào ở gần không.
  nearRack(p) {
    let any = false;
    for (const e of this.entsNear(p.x, p.y, ACT_RANGE + 60)) {
      if (e.type !== 'dryingrack' || dist(p, e) > ACT_RANGE + 60) continue;
      any = true;
      if (!e.dry) return { rack: e, any };
    }
    return { rack: null, any };
  }

  // ---------- Ngủ trong lều ----------

  sleepIn(p, tent) {
    if (phaseAt(this.t) === 'day') return this.fail(p, 'Trời còn sáng, chưa buồn ngủ.');
    if (p.hunger < SLEEP.minHunger) return this.fail(p, 'Đói quá, không ngủ nổi.');
    for (const m of this.mobs.values()) {
      const def = MOBS[m.type];
      if ((def.hostile || m.target === p.id) && dist(m, p) < SLEEP.mobRange) return this.fail(p, 'Có quái ở gần, không ngủ được.');
    }
    for (const q of this.players.values()) {
      if (q !== p && q.sleep?.tent === tent.id) return this.fail(p, 'Lều này đã có người ngủ rồi.');
    }
    tent.uses = (tent.uses ?? TENT_USES) - 1;
    this.updEnt(tent);
    p.sleep = { tent: tent.id, at: Date.now() };
    p.x = tent.x;
    p.y = tent.y + 12;
    p.allow = 0;
    p.socket.emit('teleport', { x: p.x, y: p.y });
    this.say(p, 'Zzz...');
  }

  wake(p, text) {
    if (!p.sleep) return;
    const tent = this.ents.get(p.sleep.tent);
    p.sleep = null;
    if (text) this.say(p, text);
    if (tent && tent.uses <= 0) {
      this.removeEnt(tent);
      this.emit('fx', { k: 'die', x: tent.x, y: tent.y });
      this.say(p, 'Lều rách mất rồi.');
    }
  }

  // Đập bỏ công trình bằng búa.
  hammer(p, e) {
    this.demolish(e);
    this.wear(p);
    this.emit('fx', { k: 'pick', by: p.id });
  }

  // Phá công trình (búa hoặc boss): rơi lại một nửa nguyên liệu và mọi thứ đang chứa bên trong.
  demolish(e) {
    const recipe = RECIPES.find((r) => r.id === e.type);
    for (const [id, n] of Object.entries(recipe?.needs ?? {})) {
      const back = Math.floor(n / 2);
      if (back > 0) this.spawnDrop(e.x + rand(-25, 25), e.y + rand(-10, 15), { id, count: back });
    }
    for (const it of e.slots ?? []) if (it) this.spawnDrop(e.x + rand(-30, 30), e.y + rand(-15, 20), it);
    if (e.caught) this.spawnDrop(e.x, e.y + 10, { id: 'morsel', count: 1 });
    if (e.dry) this.spawnDrop(e.x, e.y + 10, { id: this.t >= e.dry.at ? e.dry.out : e.dry.raw, count: 1 });
    for (const q of this.players.values()) {
      if (q.sleep?.tent !== e.id) continue;
      q.sleep = null;
      this.say(q, 'Ơ, lều đâu mất rồi?');
    }
    this.removeEnt(e);
    this.emit('fx', { k: 'die', x: e.x, y: e.y });
  }

  attackMob(p, m) {
    this.damageMob(p, m, ITEMS[p.gear.hand?.id]?.damage ?? 10, false);
    this.wear(p);
  }

  // Trả về true nếu quái chết.
  damageMob(p, m, dmg, ranged) {
    const def = MOBS[m.type];
    if (def.boss && !ranged) dmg = Math.round(dmg * BOSS.meleeMul);
    m.hp -= dmg;
    m.target = p.id;
    // Đánh một con bò lông là cả đàn quanh đó lao vào.
    if (def.herd) for (const o of this.mobs.values()) if (o.type === m.type && dist(o, m) < def.herd) o.target = p.id;
    this.emit('fx', { k: 'hit', id: m.id, n: dmg, by: ranged ? undefined : p.id });
    if (m.hp > 0) return false;
    this.mobs.delete(m.id);
    this.emit('fx', { k: 'die', x: m.x, y: m.y, big: def.boss });
    for (const [id, n, chance] of def.drops) {
      if (Math.random() < chance) this.spawnDrop(m.x + rand(-40, 40), m.y + rand(-20, 20), { id, count: n });
    }
    if (def.boss) {
      this.nextBoss = this.t + BOSS.gapDays * DAY_LEN;
      this.bossWarned = 0;
      this.emit('warn', { text: `${p.name} đã hạ gục Deerclops! Nhặt Mắt Deerclops để chế đồ mới.`, big: true });
      this.system(`🏆 ${p.name} đã hạ gục Deerclops!`);
    }
    return true;
  }

  // ---------- Boomerang ----------

  onThrow(p, d) {
    if (p.dead) return;
    const it = p.gear.hand;
    if (it?.id !== 'boomerang') return;
    const now = Date.now();
    if (now - p.lastAct < 350 || now < p.stunUntil) return;
    const m = this.mobs.get(Number(d?.id));
    if (!m || dist(p, m) > BOOMERANG.range + 60) return;
    p.lastAct = now;
    this.wake(p);
    p.gear.hand = null;
    const b = { id: this.id(), owner: p.id, item: it, x: p.x, y: p.y - 30, target: m.id, back: false, life: 0 };
    this.booms.set(b.id, b);
    this.sendInv(p);
    this.emit('fx', { k: 'throw', by: p.id });
  }

  // Boomerang về tay: cầm lại nếu tay đang trống, không thì cất vào túi. Hết độ bền thì gãy.
  catchBoom(p, b) {
    this.booms.delete(b.id);
    if (b.item.dur <= 0) {
      this.say(p, `${ITEMS[b.item.id].name} đã hỏng!`);
      return;
    }
    if (!p.gear.hand) {
      p.gear.hand = b.item;
      this.sendInv(p);
    } else {
      this.give(p, b.item.id, 1, b.item.dur);
    }
  }

  updateBooms(dt, now) {
    for (const b of [...this.booms.values()]) {
      const owner = this.players.get(b.owner);
      if (!owner || owner.dead) {
        this.booms.delete(b.id);
        this.spawnDrop(b.x, b.y + 30, b.item);
        continue;
      }
      b.life += dt;
      let gx, gy;
      if (!b.back) {
        const m = this.mobs.get(b.target);
        if (!m || b.life > 2) {
          b.back = true;
        } else {
          gx = m.x;
          gy = m.y - 30;
          if (Math.hypot(gx - b.x, gy - b.y) < BOOMERANG.hitR) {
            b.item.dur -= 1;
            const killed = this.damageMob(owner, m, ITEMS[b.item.id].damage, true);
            if (!killed && !MOBS[m.type].boss) m.stunUntil = now + BOOMERANG.stunMs;
            this.emit('fx', { k: 'boomhit', x: b.x, y: b.y });
            b.back = true;
          }
        }
      }
      if (b.back) {
        gx = owner.x;
        gy = owner.y - 30;
        // Bay mãi không về kịp (bị kẹt / người chơi dịch chuyển) thì coi như đã bắt được.
        if (Math.hypot(gx - b.x, gy - b.y) < BOOMERANG.catchR || b.life > 6) {
          this.catchBoom(owner, b);
          continue;
        }
      }
      const dx = gx - b.x, dy = gy - b.y, d = Math.hypot(dx, dy) || 1;
      const step = Math.min(d, BOOMERANG.speed * dt);
      b.x += (dx / d) * step;
      b.y += (dy / d) * step;
    }
  }

  onUse(p, d) {
    if (p.dead) return;
    const slot = Number(d?.slot);
    const it = p.inv[slot];
    if (!it) return;
    const def = ITEMS[it.id];

    if (def.slot) {
      const old = p.gear[def.slot];
      p.inv[slot] = null;
      if (old) this.packOff(p, old);
      p.gear[def.slot] = it;
      this.packOn(p, it);
      if (old) {
        // Đồ cũ về lại ô vừa trống; nếu ô đó thuộc ba lô vừa cởi thì tìm ô khác, hết chỗ thì vứt xuống đất.
        const i = slot < p.inv.length && !p.inv[slot] ? slot : p.inv.indexOf(null);
        if (i >= 0) p.inv[i] = old;
        else this.spawnDrop(p.x + rand(-10, 10), p.y + 16, old);
      }
      return this.sendInv(p);
    }

    if (def.plant) {
      const spot = this.placeSpot(p);
      if (!spot) return this.fail(p, 'Không đủ chỗ trống để trồng ở đây.');
      this.consumeSlot(p, slot);
      const r = RESOURCE[def.plant];
      this.addEnt(def.plant, spot.x, spot.y, { ready: false, regrowAt: this.t + r.regrow });
      this.emit('fx', { k: 'pick', by: p.id });
      return this.sendInv(p);
    }

    if (def.food) {
      const f = def.food;
      this.consumeSlot(p, slot);
      p.hunger = clamp(p.hunger + f.hunger, 0, MAX_HUNGER);
      p.sanity = clamp(p.sanity + f.sanity, 0, MAX_SANITY);
      if (f.health >= 0) p.hp = Math.min(MAX_HP, p.hp + f.health);
      else this.hurt(p, -f.health, 'ngộ độc thức ăn');
      this.sendInv(p);
      this.sendStats(p);
      return;
    }

    if (def.fuel) {
      const fire = this.nearFire(p, false);
      if (!fire) return this.fail(p, 'Mình cần đứng gần lửa để thêm củi.');
      this.consumeSlot(p, slot);
      fire.fuel = Math.min(FIRES[fire.type].max, fire.fuel + def.fuel);
      this.updEnt(fire);
      return this.sendInv(p);
    }

    this.fail(p, 'Mình không dùng được thứ này.');
  }

  // Chuột phải: phơi nếu gần giàn phơi, nướng nếu gần lửa, nếu không thì vứt xuống đất.
  // Menu trên điện thoại gửi kèm mode ('dry' | 'cook' | 'drop') để chọn đúng một việc.
  onAlt(p, d) {
    if (p.dead) return;
    const slot = Number(d?.slot);
    const it = p.inv[slot];
    if (!it) return;
    const def = ITEMS[it.id];
    const mode = ['dry', 'cook', 'drop'].includes(d?.mode) ? d.mode : null;
    if ((mode === 'dry' && !def.dry) || (mode === 'cook' && !def.cook)) return;
    if (mode === 'dry' && !this.nearRack(p).rack) return this.fail(p, 'Mình cần đứng gần một Giàn phơi còn trống.');
    if (mode === 'cook' && !this.nearFire(p)) return this.fail(p, 'Mình cần đứng gần lửa đang cháy.');
    if (def.dry && (!mode || mode === 'dry')) {
      const { rack, any } = this.nearRack(p);
      if (rack) {
        this.consumeSlot(p, slot);
        rack.dry = { raw: it.id, out: def.dry, at: this.t + ITEMS[def.dry].dryTime };
        this.updEnt(rack);
        this.emit('fx', { k: 'pick', by: p.id });
        return this.sendInv(p);
      }
      if (any && !this.nearFire(p)) return this.fail(p, 'Giàn phơi đang có đồ rồi.');
    }
    if (def.cook && (!mode || mode === 'cook') && this.nearFire(p)) {
      this.consumeSlot(p, slot);
      this.emit('fx', { k: 'pick', by: p.id });
      this.give(p, def.cook, 1);
      return;
    }
    p.inv[slot] = null;
    this.spawnDrop(p.x + rand(-10, 10), p.y + 16, it);
    this.sendInv(p);
  }

  onUnequip(p, d) {
    const slot = GEAR_SLOTS.includes(d?.slot) ? d.slot : 'hand';
    const it = p.gear[slot];
    if (p.dead || !it) return;
    // Cởi ba lô thì các ô của nó biến mất, nên phải cất ba lô vào túi chính.
    const room = ITEMS[it.id].pack ? INV_SIZE : p.inv.length;
    const i = p.inv.findIndex((s, k) => k < room && !s);
    if (i < 0) return this.fail(p, 'Túi đồ đầy rồi.');
    p.gear[slot] = null;
    this.packOff(p, it);
    p.inv[i] = it;
    this.sendInv(p);
  }

  onCraft(p, d) {
    const recipe = RECIPES.find((r) => r.id === d?.id);
    if (!recipe || p.dead) return;
    this.wake(p);
    if (recipe.station && !this.nearStation(p, recipe.station)) {
      return this.fail(p, `Mình cần đứng gần ${STATIONS[recipe.station].name}.`);
    }
    for (const [id, n] of Object.entries(recipe.needs)) {
      if (this.countItem(p, id) < n) return this.fail(p, 'Mình thiếu nguyên liệu.');
    }
    let spot = null;
    if (recipe.place) {
      spot = this.placeSpot(p);
      if (!spot) return this.fail(p, 'Không đủ chỗ trống để đặt ở đây.');
    }
    for (const [id, n] of Object.entries(recipe.needs)) this.takeItem(p, id, n);
    if (recipe.place) {
      const extra = {};
      if (FIRES[recipe.id]) extra.fuel = FIRES[recipe.id].start;
      if (recipe.id === 'chest') extra.slots = Array(CHEST_SIZE).fill(null);
      if (recipe.id === 'trap') extra.caught = false;
      if (recipe.id === 'tent') extra.uses = TENT_USES;
      if (recipe.id === 'dryingrack') extra.dry = null;
      this.addEnt(recipe.id, spot.x, spot.y, extra);
      this.sendInv(p);
    } else {
      this.give(p, recipe.id, 1);
    }
    this.emit('fx', { k: 'pick', by: p.id });
  }

  // ---------- Rương ----------

  openChest(p) {
    const c = this.ents.get(p.chest);
    if (!c || c.type !== 'chest' || p.dead || dist(p, c) > ACT_RANGE + 100) {
      p.chest = null;
      return null;
    }
    return c;
  }

  onStore(p, d) {
    const c = this.openChest(p);
    const slot = Number(d?.slot);
    const it = p.inv[slot];
    if (!c || !it) return;
    if (it.temp) return this.fail(p, 'Đuốc tạm không cất vào rương được.');
    const left = addToSlots(c.slots, it.id, it.count, it.dur, packed(it));
    if (left === it.count) return this.fail(p, 'Rương đầy rồi.');
    if (left > 0) it.count = left;
    else p.inv[slot] = null;
    this.updEnt(c);
    this.sendInv(p);
  }

  onTake(p, d) {
    const c = this.openChest(p);
    const slot = Number(d?.slot);
    const it = c?.slots[slot];
    if (!it) return;
    const left = this.give(p, it.id, it.count, it.dur, false, packed(it));
    if (left === it.count) return this.fail(p, 'Túi đồ đầy rồi.');
    if (left > 0) it.count = left;
    else c.slots[slot] = null;
    this.updEnt(c);
  }

  onChestClose(p) { p.chest = null; }

  onChat(p, d) {
    const text = String(d?.text || '').trim().slice(0, 120);
    // Lệnh thử nghiệm, chỉ bật khi chạy server với DEV=1. Ví dụ: /give log 20
    if (process.env.DEV === '1' && text === '/hounds') {
      this.nextHound = this.t + 12; // gọi đàn chó săn tới sau ~12 giây
      this.houndWarned = 0;
      return;
    }
    if (process.env.DEV === '1' && text === '/boss') {
      this.nextBoss = this.t + 12; // gọi Deerclops tới sau ~12 giây
      this.bossWarned = 0;
      return;
    }
    if (process.env.DEV === '1' && text.startsWith('/give ')) {
      const [, id, n] = text.split(/\s+/);
      if (ITEMS[id]) this.give(p, id, Math.max(1, Math.min(200, Number(n) || 1)));
      return;
    }
    if (text)this.emit('chat', { id: p.id, name: p.name, color: p.color, text });
  }

  // ---------- Vòng lặp game ----------

  tick() {
    const now = Date.now();
    const dt = Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    if (PAUSE_WHEN_EMPTY && this.players.size === 0) return;
    this.t += dt;
    this.tickCount++;
    const phase = phaseAt(this.t);

    for (const p of this.players.values()) this.updatePlayer(p, dt, now, phase);
    for (const f of [...this.fires]) {
      if (f.fuel <= 0) continue;
      f.fuel -= dt;
      if (f.fuel > 0) continue;
      if (FIRES[f.type].permanent) {
        f.fuel = 0;
        this.updEnt(f);
      } else {
        this.removeEnt(f);
      }
    }
    this.updateMobs(dt, now, phase);
    this.updateBooms(dt, now);

    const ps = [];
    for (const p of this.players.values()) {
      ps.push([p.id, Math.round(p.x), Math.round(p.y), p.dead ? 1 : 0, p.gear.hand?.id || 0, p.gear.head?.id || 0, p.gear.body?.id || 0, p.sleep ? 1 : 0, now < p.safeUntil ? 1 : 0, now < p.stunUntil ? 1 : 0]);
    }
    const t = Math.round(this.t * 100) / 100;
    const boss = this.boss();
    for (const p of this.players.values()) {
      const near = (o) => Math.abs(o.x - p.x) < MOB_VIEW && Math.abs(o.y - p.y) < MOB_VIEW;
      const ms = [];
      for (const m of this.mobs.values()) if (near(m)) ms.push([m.id, m.type, Math.round(m.x), Math.round(m.y)]);
      const bs = [];
      for (const b of this.booms.values()) if (near(b)) bs.push([b.id, Math.round(b.x), Math.round(b.y), b.owner]);
      const snap = { t, p: ps, m: ms, b: bs };
      if (boss && near(boss)) snap.bo = [boss.id, Math.max(0, Math.round(boss.hp)), boss.maxHp];
      p.socket.emit('snap', snap);
    }

    if (this.tickCount % 4 === 0) for (const p of this.players.values()) this.sendStats(p);
  }

  updatePlayer(p, dt, now, phase) {
    if (p.dead) {
      if (now >= p.respawnAt) this.respawn(p);
      return;
    }

    p.survived += dt;
    p.hunger = Math.max(0, p.hunger - HUNGER_RATE * dt);
    if (p.hunger <= 0) this.hurt(p, 1.5 * dt, 'đói', { quiet: true });

    // Ngủ trong lều: an toàn trong bóng tối, hồi máu và tinh thần, đói nhanh hơn. Trời sáng thì tự dậy.
    if (p.sleep) {
      if (!this.ents.has(p.sleep.tent)) p.sleep = null;
      else if (phase === 'day') this.wake(p, 'Trời sáng rồi! Ngủ ngon quá.');
      else if (p.hunger <= 0) this.wake(p, 'Đói quá, không ngủ tiếp được.');
      else {
        p.hunger = Math.max(0, p.hunger - SLEEP.hunger * dt);
        p.hp = Math.min(MAX_HP, p.hp + SLEEP.health * dt);
        p.sanity = Math.min(MAX_SANITY, p.sanity + SLEEP.sanity * dt);
        p.dark = 0;
        p.warned = false;
        return;
      }
    }

    const lit = this.isLit(p.x, p.y);
    let ds = 0;
    if (phase === 'dusk') ds -= 0.15;
    else if (phase === 'night') ds -= lit ? 0.15 : 0.5;
    for (const m of this.mobs.values()) {
      if (MOBS[m.type].hostile && Math.hypot(m.x - p.x, m.y - p.y) < 250) { ds -= 0.3; break; }
    }
    if (phase === 'day' && ds === 0) ds = 0.1;
    ds += ITEMS[p.gear.head?.id]?.sanityRegen ?? 0;
    p.sanity = clamp(p.sanity + ds * dt, 0, MAX_SANITY);
    if (p.sanity <= 0) this.hurt(p, 0.5 * dt, 'mất trí', { quiet: true });
    if (p.dead) return;

    // Đuốc cháy dần, vòng hoa héo dần.
    let burned = false;
    for (const s of GEAR_SLOTS) {
      const it = p.gear[s];
      if (!it || !ITEMS[it.id].burns) continue;
      it.dur -= dt;
      burned = true;
      if (it.dur <= 0) {
        p.gear[s] = null;
        this.say(p, s === 'hand' ? `${ITEMS[it.id].name} tắt mất rồi!` : `${ITEMS[it.id].name} héo mất rồi.`);
        this.sendInv(p);
      }
    }
    if (burned && this.tickCount % 20 === 0) this.sendInv(p);

    // Charlie: đứng trong bóng tối quá lâu sẽ bị tấn công.
    if (phase === 'night' && !lit && now >= p.safeUntil) {
      p.dark += dt;
      if (p.dark > 1 && !p.warned) {
        p.warned = true;
        this.say(p, 'Tối quá... có thứ gì đó trong bóng tối!');
      }
      if (p.dark > 4) {
        p.dark = 1.5;
        this.emit('fx', { k: 'charlie', id: p.id });
        this.hurt(p, 40, 'bóng tối', { armored: true });
      }
    } else {
      p.dark = 0;
      p.warned = false;
    }
  }

  updateMobs(dt, now, phase) {
    for (const m of this.mobs.values()) {
      const def = MOBS[m.type];
      // Nhện kéo tới ban đêm sẽ rút lui khi trời sáng.
      if (m.nightOnly && phase === 'day' && Math.random() < dt * 0.15) {
        this.mobs.delete(m.id);
        this.emit('fx', { k: 'die', x: m.x, y: m.y });
        continue;
      }
      if (m.stunUntil > now) continue;
      if (def.boss) this.updateBoss(m, def, dt, now);
      else if (def.hostile) this.updateHostile(m, def, dt, now, phase);
      else if (def.neutral) this.updateNeutral(m, def, dt, now);
      else this.updatePassive(m, def, dt, now);
    }

    // Thỏ đi ngang bẫy sẽ bị bắt.
    for (const trap of this.traps) {
      if (trap.caught) continue;
      for (const m of this.mobs.values()) {
        if (m.type === 'rabbit' && dist(m, trap) < 28) {
          this.mobs.delete(m.id);
          trap.caught = true;
          this.updEnt(trap);
          break;
        }
      }
    }
  }

  // Báo trước rồi thả một đàn chó săn nhắm vào từng người chơi đang sống.
  updateHounds() {
    const left = this.nextHound - this.t;
    for (let i = this.houndWarned; i < HOUND.warnAt.length; i++) {
      if (left > HOUND.warnAt[i]) break;
      this.houndWarned = i + 1;
      this.emit('warn', { text: i === 0 ? 'Có tiếng gầm gừ từ xa... Chó săn sắp tới!' : 'Tiếng gầm gừ ngày càng gần! Chuẩn bị chiến đấu!' });
    }
    if (left <= 0) {
      const day = Math.floor(this.t / DAY_LEN) + 1;
      const count = Math.min(HOUND.max, HOUND.base + Math.floor(day / HOUND.perDays));
      for (const p of this.players.values()) {
        if (p.dead || !p.ready) continue;
        for (let i = 0; i < count; i++) this.houndQueue.push({ at: this.t + i * 0.8, target: p.id });
      }
      if (this.houndQueue.length) this.emit('warn', { text: `Chó săn tấn công! (${count} con mỗi người)`, big: true });
      this.nextHound = this.t + rand(HOUND.gapMin, HOUND.gapMax) * DAY_LEN;
      this.houndWarned = 0;
    }
    this.houndQueue = this.houndQueue.filter((q) => {
      if (this.t < q.at) return true;
      const p = this.players.get(q.target);
      if (!p || p.dead) return false;
      const a = rand(0, Math.PI * 2);
      this.spawnMob('hound', p.x + Math.cos(a) * HOUND.spawnDist, p.y + Math.sin(a) * HOUND.spawnDist, { target: p.id });
      return false;
    });
  }

  boss() {
    for (const m of this.mobs.values()) if (MOBS[m.type].boss) return m;
    return null;
  }

  // Báo trước rồi thả Deerclops nhắm vào một người chơi ngẫu nhiên đang sống.
  updateBossSchedule() {
    if (this.boss()) return;
    const left = this.nextBoss - this.t;
    for (let i = this.bossWarned; i < BOSS.warnAt.length; i++) {
      if (left > BOSS.warnAt[i]) break;
      this.bossWarned = i + 1;
      this.emit('warn', { text: i === 0 ? 'Mặt đất rung chuyển... Có thứ gì đó khổng lồ đang tới!' : 'Deerclops sắp xuất hiện! Chuẩn bị boomerang!' });
    }
    if (left > 0) return;
    const alive = [...this.players.values()].filter((p) => !p.dead && p.ready);
    if (!alive.length) return;
    const p = alive[Math.floor(Math.random() * alive.length)];
    const a = rand(0, Math.PI * 2);
    const hp = Math.min(BOSS.hpMax, BOSS.hp + BOSS.hpPerPlayer * (alive.length - 1));
    this.spawnMob('deerclops', p.x + Math.cos(a) * BOSS.spawnDist, p.y + Math.sin(a) * BOSS.spawnDist, {
      hp, maxHp: hp, target: p.id, idle: 0, slam: null,
    });
    this.emit('warn', { text: `Deerclops đã xuất hiện! (${hp} máu)`, big: true });
    // Mặc định là bỏ đi rồi quay lại; nếu bị hạ thì damageMob sẽ dời lịch xa hơn.
    this.nextBoss = this.t + BOSS.returnDays * DAY_LEN;
    this.bossWarned = 0;
  }

  updateBoss(m, def, dt, now) {
    if (m.slam) {
      if (now < m.slam.at) return;
      for (const p of this.players.values()) {
        const d = Math.hypot(p.x - m.slam.x, p.y - m.slam.y);
        if (p.dead || d >= BOSS.slamR) continue;
        const dmg = BOSS.slamMax - (BOSS.slamMax - BOSS.slamMin) * (d / BOSS.slamR);
        this.hurt(p, Math.round(dmg), def.name, { armored: true });
        if (!p.dead && d < BOSS.stunR) {
          p.stunUntil = now + BOSS.stunMs;
          this.emit('fx', { k: 'stun', id: p.id, ms: BOSS.stunMs });
        }
      }
      this.emit('fx', { k: 'slam', id: m.id, x: m.slam.x, y: m.slam.y, r: BOSS.slamR });
      const smashed = [];
      for (const e of this.entsNear(m.slam.x, m.slam.y, BOSS.slamR)) {
        if (STRUCTURES.has(e.type) && dist(e, m.slam) < BOSS.slamR && Math.random() < BOSS.smashChance) smashed.push(e);
      }
      for (const e of smashed) this.demolish(e);
      if (smashed.length) {
        const names = smashed.map((e) => RECIPES.find((r) => r.id === e.type)?.name ?? e.type);
        this.system(`💥 Deerclops đã phá hủy ${[...new Set(names)].join(', ')}!`);
      }
      m.slam = null;
      m.atk = now + BOSS.recoverMs;
      return;
    }
    let tgt = m.target ? this.players.get(m.target) : null;
    if (!tgt || tgt.dead || dist(tgt, m) > def.leash) {
      tgt = null;
      let bd = def.sight;
      for (const p of this.players.values()) {
        if (p.dead) continue;
        const d = dist(p, m);
        if (d < bd) { bd = d; tgt = p; }
      }
      m.target = tgt?.id ?? null;
    }
    if (!tgt) {
      m.idle += dt;
      if (m.idle > BOSS.leaveAfter) {
        this.mobs.delete(m.id);
        this.emit('fx', { k: 'die', x: m.x, y: m.y, big: true });
        this.emit('warn', { text: 'Deerclops đã bỏ đi... nhưng nó sẽ quay lại.' });
      } else {
        this.wander(m, def, dt, now);
      }
      return;
    }
    m.idle = 0;
    const dx = tgt.x - m.x, dy = tgt.y - m.y, d = Math.hypot(dx, dy) || 1;
    if (d > BOSS.reach * 0.8) {
      m.x += (dx / d) * def.speed * dt;
      m.y += (dy / d) * def.speed * dt;
    }
    if (d <= BOSS.reach && now >= m.atk) {
      m.slam = { x: tgt.x, y: tgt.y, at: now + BOSS.windupMs };
      this.emit('fx', { k: 'windup', id: m.id, x: Math.round(tgt.x), y: Math.round(tgt.y), r: BOSS.slamR, sr: BOSS.stunR, ms: BOSS.windupMs });
    }
  }

  wander(m, def, dt, now, goal) {
    if (now >= m.wt) {
      m.wt = now + rand(1500, 3500);
      let a = rand(0, Math.PI * 2);
      if (goal) a = Math.atan2(goal.y - m.y, goal.x - m.x) + rand(-0.3, 0.3);
      const move = goal || Math.random() < 0.6;
      m.vx = move ? Math.cos(a) * def.wander : 0;
      m.vy = move ? Math.sin(a) * def.wander : 0;
    }
    m.x += m.vx * dt;
    m.y += m.vy * dt;
  }

  updateHostile(m, def, dt, now, phase) {
    let tgt = m.target ? this.players.get(m.target) : null;
    if (!tgt || tgt.dead || dist(tgt, m) > (def.leash ?? 700)) {
      tgt = null;
      let bd = phase === 'day' ? def.daySight : def.sight;
      for (const p of this.players.values()) {
        if (p.dead) continue;
        const d = dist(p, m);
        if (d < bd) { bd = d; tgt = p; }
      }
      m.target = tgt?.id ?? null;
    }
    if (!tgt) return this.wander(m, def, dt, now);
    this.chase(m, def, tgt, dt, now);
  }

  // Lợn, bò lông: hiền, chỉ đuổi đánh người vừa đánh nó cho tới khi người đó chạy xa.
  updateNeutral(m, def, dt, now) {
    const tgt = m.target ? this.players.get(m.target) : null;
    if (!tgt || tgt.dead || dist(tgt, m) > def.leash) {
      m.target = null;
      return this.wander(m, def, dt, now);
    }
    this.chase(m, def, tgt, dt, now);
  }

  chase(m, def, tgt, dt, now) {
    const dx = tgt.x - m.x, dy = tgt.y - m.y, d = Math.hypot(dx, dy);
    if (d > 34) {
      m.x += (dx / d) * def.speed * dt;
      m.y += (dy / d) * def.speed * dt;
    } else if (now >= m.atk) {
      m.atk = now + def.cooldown;
      this.emit('fx', { k: 'bite', id: m.id });
      this.hurt(tgt, def.damage, def.name, { armored: true });
    }
  }

  updatePassive(m, def, dt, now) {
    let threat = null;
    let bd = def.flee;
    for (const p of this.players.values()) {
      if (p.dead) continue;
      const d = dist(p, m);
      if (d < bd) { bd = d; threat = p; }
    }
    if (threat) {
      const dx = m.x - threat.x, dy = m.y - threat.y, d = Math.hypot(dx, dy) || 1;
      m.x += (dx / d) * def.speed * dt;
      m.y += (dy / d) * def.speed * dt;
      m.wt = 0;
      return;
    }
    // Thỏ hay mò tới chỗ đặt bẫy (bị mồi nhử).
    let goal = null;
    if (now >= m.wt && Math.random() < 0.4) {
      for (const t of this.traps) if (!t.caught && dist(t, m) < 350) { goal = t; break; }
    }
    this.wander(m, def, dt, now, goal);
  }

  // Mỗi giây: đồ vứt ngoài đất tự biến mất sau DROP_LIFE; thức ăn tươi (trong túi, rương, ngoài đất) cũ dần.
  updateDecay() {
    const sync = this.slowCount % 5 === 0; // gửi lại túi/rương định kỳ để thanh độ tươi chạy
    for (const e of [...this.ents.values()]) {
      if (e.type === 'drop') {
        e.life = (e.life ?? 0) + 1;
        if (e.life >= DROP_LIFE) { this.removeEnt(e); continue; }
        const r = ageItem(e.item, 1);
        if (r === 'gone') this.removeEnt(e);
        else if (r === 'rot') this.updEnt(e);
      } else if (e.type === 'chest' && e.slots) {
        if (ageSlots(e.slots, 1) || (sync && e.slots.some((it) => it && ITEMS[it.id].perish))) this.updEnt(e);
      }
    }
    for (const p of this.players.values()) {
      if (ageSlots(p.inv, 1) || (sync && p.inv.some((it) => it && ITEMS[it.id].perish))) this.sendInv(p);
    }
  }

  slowTick() {
    if (PAUSE_WHEN_EMPTY && this.players.size === 0) return;
    const phase = phaseAt(this.t);
    this.updateHounds();
    this.updateBossSchedule();
    this.slowCount = (this.slowCount ?? 0) + 1;
    if (this.slowCount % 10 === 0) this.emit('roster', this.roster()); // cập nhật số ngày sống sót mỗi 10 giây

    for (const e of this.ents.values()) {
      if (e.regrowAt && this.t >= e.regrowAt) {
        e.ready = true;
        delete e.regrowAt;
        this.updEnt(e);
      }
    }
    this.updateDecay();

    // Mọc lại tại chỗ cũ; nếu chỗ đó đang bị công trình chiếm thì thử lại sau.
    this.respawnQueue = this.respawnQueue.filter((q) => {
      if (this.t < q.at) return true;
      if (!this.spaceFree(q.x, q.y, 30)) {
        q.at = this.t + 15;
        return true;
      }
      this.addEnt(q.type, q.x, q.y);
      return false;
    });

    for (const f of this.fires) if (f.fuel > 0) this.updEnt(f);

    // Xóa quái ở quá xa mọi người chơi để thế giới vô hạn không bị đầy quái.
    // Boss tự bỏ đi khi không còn ai ở gần (updateBoss).
    for (const m of this.mobs.values()) {
      if (MOBS[m.type].boss) continue;
      let near = false;
      for (const p of this.players.values()) if (dist(p, m) < MOB_DESPAWN) { near = true; break; }
      if (!near) this.mobs.delete(m.id);
    }

    // Quanh mỗi người chơi luôn có vài con nhện trong rừng và thỏ ở đồng cỏ.
    for (const p of this.players.values()) {
      if (p.dead || !p.ready) continue;
      for (const [type, def] of Object.entries(MOBS)) {
        let count = 0;
        for (const m of this.mobs.values()) if (m.type === type && m.resident && dist(m, p) < 1500) count++;
        if (count >= def.perPlayer) continue;
        for (let i = 0; i < 10; i++) {
          const a = rand(0, Math.PI * 2), r = rand(800, 1300);
          const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
          if (biomeAt(this.seed, x, y) !== def.home) continue;
          if (Math.hypot(x - SPAWN.x, y - SPAWN.y) < def.safeFromSpawn) continue;
          if ([...this.players.values()].some((q) => Math.hypot(q.x - x, q.y - y) < 600)) continue;
          this.spawnMob(type, x, y, { resident: true });
          break;
        }
      }
    }

    // Ban đêm nhện kéo tới gần người chơi.
    if (phase === 'night') {
      for (const p of this.players.values()) {
        if (p.dead || Math.random() > 0.12 || this.mobs.size >= 60) continue;
        let near = 0;
        for (const m of this.mobs.values()) if (m.type === 'spider' && dist(m, p) < 900) near++;
        if (near >= 3) continue;
        const a = rand(0, Math.PI * 2);
        this.spawnMob('spider', p.x + Math.cos(a) * 600, p.y + Math.sin(a) * 600, { nightOnly: true });
      }
    }
  }
}

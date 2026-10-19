import Phaser from 'phaser';
import {
  ITEMS, RECIPES, FIRES, STATIONS, CHUNK, chunkOf, chunkKey, hash, PLAYER_SPEED, TORCH_RADIUS, BIOMES, BOOMERANG, biomeAt, fireRadius, darknessAt,
} from '../../shared/data.js';
import { makeTextures } from './textures.js';
import { Minimap } from './minimap.js';
import { art, itemSprite, isGolden, GOLD_TINT, SPRITE_URL } from './art.js';

// Chiều cao hiển thị (pixel thế giới) của từng sprite thật. Hình vẽ bằng code giữ nguyên cỡ.
const ART_HEIGHT = {
  tree: 125, tree2: 125, sapling: 46, grass: 36, bush: 40, bush_berries: 44, boulder: 48, flint: 18,
  carrot: 26, flower0: 24, flower1: 24, flower2: 24, flower3: 24, flower4: 24,
  campfire: 58, firepit: 46, chest: 42, science: 84, crockpot: 58, trap: 26, tent: 92, dryingrack: 78,
  rabbit: 34, spider: 46, hound: 56, pig: 54, beefalo: 88, deerclops: 200, player: 68, item: 26,
};
const BOSS_WALK = [0, 1, 2, 1];
// Vụ nổ khi Deerclops đập xuống: 7 khung, tự to dần rồi tan. Khung to nhất (354px) phủ vừa vùng đập.
const EXPLOSION = [1, 2, 3, 4, 5, 6, 7].map((i) => `explosion_${i}`);
const EXPLOSION_MAX_W = 354;
const EXPLOSION_FRAME_MS = 60;
const SOUND_RANGE = 1400; // xa hơn chừng này (pixel thế giới) thì không nghe thấy tiếng boss
const ROAR_GAP_MS = 5000; // tiếng gầm dài ~4 giây, không cho chồng lên nhau
// Tiếng khi nhặt / hái: loại vật -> âm thanh ("drop" = đồ rơi dưới đất)
const PICK_SOUNDS = {
  sapling: 'twig', grass: 'rustle', flower: 'rustle', bush: 'rustle', carrot: 'rustle', flint: 'pickup', drop: 'pickup',
};
// Texture trong game lấy từ sprite có tên khác
const TEX_FROM_SPRITE = { sapling: 'dead_tree', hound: 'hound_dir_0' };
const RUN_FRAMES = ['player_run1', 'player_run2', 'player_run3', 'player_run2'];

// Hoạt ảnh 8 hướng: hướng nhìn -> [tên khung gốc, lật ngang]. Hướng bên trái = lật hình bên phải.
const DIR_FRAMES = {
  down: ['down', false], down_right: ['down_right', false], right: ['right', false], up_right: ['up_right', false],
  up: ['up', false], up_left: ['up_right', true], left: ['right', true], down_left: ['down_right', true],
};
// Thứ tự hướng theo góc, bắt đầu từ bên phải, quay theo chiều kim đồng hồ (trục y hướng xuống)
const DIR_BY_ANGLE = ['right', 'down_right', 'down', 'down_left', 'left', 'up_left', 'up', 'up_right'];
// Chu kỳ bước chân: đi -> đứng -> chạy -> đứng (hai chân luân phiên)
const STEP_CYCLE = ['walk', 'idle', 'run', 'idle'];
const STEP_MS = 120;
const PLAYER_FRAME_H = 110; // chiều cao gốc của khung 8 hướng, dùng chung để nhân vật không co giãn giữa các khung

function dirFromVector(dx, dy) {
  const a = Math.atan2(dy, dx);
  return DIR_BY_ANGLE[(Math.round(a / (Math.PI / 4)) + 8) % 8];
}

const FONT = 'Segoe UI, Tahoma, sans-serif';
// Màn hình nhỏ (điện thoại) thì thu nhỏ thế giới để vẫn thấy đủ xa xung quanh.
const ZOOM_REF = 720; // cạnh ngắn của màn hình từ cỡ này trở lên thì giữ nguyên tỉ lệ 1:1
const ZOOM_MIN = 0.55;
const OVERLAY_PAD = 96; // lớp bóng tối / nhiễu nền phủ rộng hơn khung nhìn chừng này (pixel thế giới) để không hở mép khi camera trượt
const TAP_SLOP = 44; // chạm trượt khỏi vật trong khoảng này (pixel màn hình) vẫn tính là chạm trúng
// Vật thể có độ sâu = tọa độ y (vật ở dưới che vật ở trên). Thế giới vô hạn nên y có thể âm
// hoặc rất lớn, vì vậy mặt đất, bóng tối và chữ phải nằm ngoài mọi giá trị y có thể có.
const GROUND_DEPTH = -1e9;
const DARK_DEPTH = 1e9;
const UI_DEPTH = 2e9;
const REPEAT_TYPES = new Set(['tree', 'boulder']);
const STRUCTURES = new Set(RECIPES.filter((r) => r.place).map((r) => r.id));
const MOB_NAMES = { spider: 'Nhện', rabbit: 'Thỏ', hound: 'Chó săn', pig: 'Lợn', beefalo: 'Bò lông', deerclops: 'Deerclops' };
const MOB_SHADOW = { rabbit: 0.7, pig: 1.4, beefalo: 2, deerclops: 4 };
const DIGGABLE = new Set(['sapling', 'grass', 'bush']);
const NAMES = {
  tree: 'Cây thông', boulder: 'Tảng đá', sapling: 'Cây non', grass: 'Bụi cỏ', bush: 'Bụi quả mọng',
  flower: 'Hoa', flint: 'Đá lửa', carrot: 'Cà rốt',
  ...Object.fromEntries(RECIPES.filter((r) => r.place).map((r) => [r.id, r.name])),
};
const PICK_LABELS = {
  sapling: 'Bẻ cành cây', grass: 'Cắt cỏ', bush: 'Hái quả mọng', flower: 'Hái hoa', flint: 'Nhặt đá lửa', carrot: 'Nhổ cà rốt',
};

export class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
  }

  preload() {
    for (const name of art.keys()) this.load.image(name, `${SPRITE_URL}${name}.png`);
    for (const [tex, name] of Object.entries(TEX_FROM_SPRITE)) {
      if (art.has(name)) this.load.image(tex, `${SPRITE_URL}${name}.png`);
    }
  }

  isArt(key) {
    return art.has(key) || (TEX_FROM_SPRITE[key] && art.has(TEX_FROM_SPRITE[key]));
  }

  // Đổi texture và chỉnh cỡ cho đúng chiều cao mong muốn nếu là sprite thật.
  applyArt(img, key, mul = 1) {
    img.setTexture(key);
    const h = ART_HEIGHT[key];
    img.setScale(this.isArt(key) && h ? (h / img.height) * mul : mul);
  }

  create({ socket, hud, init }) {
    this.socket = socket;
    this.hud = hud;
    makeTextures(this);
    for (const key of EXPLOSION) if (this.textures.exists(key)) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);

    this.myId = init.you;
    this.stunUntil = 0;
    this.nextRoar = 0;
    this.worldT = init.t;
    this.ents = new Map();
    this.fires = new Set();
    this.players = new Map();
    this.mobs = new Map();
    this.booms = new Map();
    this.myBoomFlying = false;
    this.roster = new Map(init.players.map((r) => [r.id, r]));
    this.gear = { hand: null, head: null, body: null };
    this.stationTimer = 0;
    this.target = null;
    this.nextAct = 0;
    this.nextAuto = 0;
    this.posTimer = 0;
    this.clockTimer = 0;
    this.lastSent = '';
    this.hover = null;
    this.zoom = 1;

    this.seed = init.seed;
    this.grounds = new Map(); // "cx,cy" -> ảnh mặt đất của chunk
    this.noise = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'gnoise')
      .setOrigin(0).setDepth(GROUND_DEPTH + 1);

    this.me = this.makePlayer(this.myId);
    this.me.x = this.me.tx = init.x;
    this.me.y = this.me.ty = init.y;

    const cam = this.cameras.main;
    this.drawPlayer(this.me, 0);
    cam.startFollow(this.me.c, true, 0.15, 0.15);
    cam.centerOn(init.x, init.y);
    cam.setRoundPixels(true);

    this.lightImg = this.make.image({ key: 'light', add: false });
    this.applyZoom();
    this.scale.on('resize', () => this.applyZoom());
    this.labelTimer = 0;

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,F', false);
    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', (p) => this.onPointerDown(p));
    this.pointerIn = false;
    this.input.on('pointermove', () => { this.pointerIn = true; });
    this.input.on('gameout', () => {
      this.pointerIn = false;
      this.setHover(null);
    });
    this.hud.setClock(this.worldT);
    this.hud.setStations(this.nearStations());
    this.tip =document.getElementById('tip');
    this.minimap = new Minimap(this);
    this.hud.minimap = this.minimap;

    this.bindSocket();
    this.socket.emit('ready');
  }

  // Đặt độ zoom theo cỡ màn hình. Bóng tối và nhiễu nền nằm trong thế giới (đi theo khung nhìn
  // ở placeOverlays), nên được zoom và cuộn cùng mọi thứ khác, ánh sáng luôn đúng chỗ ngọn lửa.
  applyZoom() {
    const { width: w, height: h } = this.scale;
    const z = Phaser.Math.Clamp(Math.min(w, h) / ZOOM_REF, ZOOM_MIN, 1);
    this.zoom = z;
    this.cameras.main.setZoom(z);
    const W = Math.ceil(w / z) + OVERLAY_PAD * 2, H = Math.ceil(h / z) + OVERLAY_PAD * 2;
    // Tạo lại lớp bóng tối thay vì resize(): ở Phaser 3.90, RenderTexture sau khi resize
    // vẫn vẽ theo cỡ cũ nên vùng sáng bị kéo lệch khỏi ngọn lửa.
    this.dark?.destroy();
    this.dark = this.add.renderTexture(0, 0, W, H).setOrigin(0).setDepth(DARK_DEPTH);
    this.noise.setSize(W, H);
  }

  // Góc trên trái của lớp phủ (pixel thế giới): khung nhìn hiện tại lùi ra một khoảng đệm.
  placeOverlays() {
    const view = this.cameras.main.worldView;
    const x = Math.floor(view.x - OVERLAY_PAD), y = Math.floor(view.y - OVERLAY_PAD);
    this.dark.setPosition(x, y);
    this.noise.setPosition(x, y).setTilePosition(x, y);
    return { x, y };
  }

  // ---------- Mạng ----------

  bindSocket() {
    const s = this.socket;
    s.on('snap', (snap) => this.onSnap(snap));
    s.on('chunk', (c) => this.addChunk(c));
    s.on('unchunk', (c) => this.removeChunk(c));
    s.on('ent:add', (e) => this.addEnt(e));
    s.on('ent:upd', (e) => this.updEnt(e));
    s.on('ent:del', (id) => this.delEnt(id));
    s.on('roster', (list) => {
      this.roster = new Map(list.map((r) => [r.id, r]));
      for (const pl of this.players.values()) this.applyRoster(pl);
    });
    s.on('inv', (d) => { this.gear = d.gear; });
    s.on('chest:open', ({ id }) => {
      const o = this.ents.get(id);
      if (o) this.hud.openChest(id, o.e.slots);
    });
    s.on('fx', (fx) => this.onFx(fx));
    s.on('say', ({ id, text }) => this.bubble(id, text));
    s.on('chat', (m) => { if (m.id) this.bubble(m.id, m.text); });
    s.on('fail', () => { this.target = null; });
    s.on('teleport', ({ x, y }) => {
      this.me.x = x;
      this.me.y = y;
      this.target = null;
    });
  }

  onSnap(snap) {
    this.worldT = snap.t;
    const seen = new Set();
    for (const [id, x, y, dead, eq, head, body, asleep, safe, stunned] of snap.p) {
      seen.add(id);
      let pl = this.players.get(id);
      if (!pl) {
        pl = this.makePlayer(id);
        pl.x = x;
        pl.y = y;
      }
      pl.tx = x;
      pl.ty = y;
      pl.dead = !!dead;
      pl.eq = eq || null;
      pl.headGear = head || null;
      pl.bodyGear = body || null;
      pl.asleep = !!asleep;
      pl.safe = !!safe;
      pl.stunned = !!stunned;
    }
    for (const [id, pl] of this.players) {
      if (!seen.has(id) && id !== this.myId) this.destroyPlayer(pl);
    }

    const seenMobs = new Set();
    for (const [id, type, x, y] of snap.m) {
      seenMobs.add(id);
      let m = this.mobs.get(id);
      if (!m) m = this.makeMob(id, type, x, y);
      m.tx = x;
      m.ty = y;
    }
    for (const [id, m] of this.mobs) {
      if (!seenMobs.has(id)) {
        m.c.destroy();
        this.mobs.delete(id);
        if (this.hover?.o === m) this.setHover(null);
      }
    }

    const seenBooms = new Set();
    let mine = false;
    for (const [id, x, y, owner] of snap.b ?? []) {
      seenBooms.add(id);
      if (owner === this.myId) mine = true;
      let b = this.booms.get(id);
      if (!b) {
        const img = this.add.image(x, y, 'boomerang');
        img.setScale(30 / img.height);
        b = { img, x, y, tx: x, ty: y };
        this.booms.set(id, b);
      }
      b.tx = x;
      b.ty = y;
    }
    for (const [id, b] of this.booms) {
      if (seenBooms.has(id)) continue;
      b.img.destroy();
      this.booms.delete(id);
    }
    this.myBoomFlying = mine;
    this.hud.setBoss(snap.bo);
  }

  flushPos() {
    const s = `${Math.round(this.me.x)},${Math.round(this.me.y)}`;
    if (s === this.lastSent) return;
    this.lastSent = s;
    this.socket.emit('pos', { x: Math.round(this.me.x), y: Math.round(this.me.y) });
  }

  // ---------- Thế giới ----------

  // Mặt đất của một chunk: mỗi pixel ảnh phủ 20x20 pixel thế giới, được phóng to mượt.
  buildGround(cx, cy) {
    const S = 20;
    const n = CHUNK / S;
    const key = `ground_${cx}_${cy}`;
    if (this.textures.exists(key)) this.textures.remove(key);
    const tex = this.textures.createCanvas(key, n, n);
    const ctx = tex.getContext();
    const img = ctx.createImageData(n, n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const gx = cx * n + x, gy = cy * n + y;
        const [r, g, b] = BIOMES[biomeAt(this.seed, gx * S + S / 2, gy * S + S / 2)].color;
        const v = (hash(this.seed + 99, gx, gy) - 0.5) * 16;
        const i = (y * n + x) * 4;
        img.data[i] = r + v;
        img.data[i + 1] = g + v;
        img.data[i + 2] = b + v;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    tex.refresh();
    return this.add.image(cx * CHUNK, cy * CHUNK, key).setOrigin(0).setScale(S).setDepth(GROUND_DEPTH);
  }

  addChunk({ cx, cy, ents }) {
    const key = chunkKey(cx, cy);
    if (!this.grounds.has(key)) this.grounds.set(key, this.buildGround(cx, cy));
    for (const e of ents) this.addEnt(e);
  }

  removeChunk({ cx, cy }) {
    const key = chunkKey(cx, cy);
    const img = this.grounds.get(key);
    if (img) {
      img.destroy();
      this.textures.remove(`ground_${cx}_${cy}`);
      this.grounds.delete(key);
    }
    for (const [id, o] of this.ents) {
      if (chunkKey(...chunkOf(o.e.x, o.e.y)) === key) this.delEnt(id);
    }
  }

  entTexture(e) {
    switch (e.type) {
      case 'sapling': return e.ready ? 'sapling' : 'sapling_picked';
      case 'grass': return e.ready ? 'grass' : 'grass_picked';
      case 'bush': return e.ready ? 'bush_berries' : 'bush';
      case 'flower': return `flower${e.v || 0}`;
      case 'trap': return e.caught ? 'trap_caught' : 'trap';
      case 'tree': return e.id % 2 && this.isArt('tree2') ? 'tree2' : 'tree';
      default: return e.type;
    }
  }

  addEnt(e) {
    if (this.ents.has(e.id)) return this.updEnt(e);
    let spr;
    if (FIRES[e.type]) {
      spr = this.add.container(e.x, e.y);
      const glow = this.add.image(0, -10, 'light').setTint(0xff9a3c).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3);
      let base, flame;
      if (this.isArt(e.type)) {
        // Sprite thật đã có sẵn ngọn lửa
        base = this.add.image(0, 6, e.type).setOrigin(0.5, 1);
        this.applyArt(base, e.type);
        flame = base;
        spr.add([glow, base]);
      } else {
        base = this.add.image(0, 0, e.type === 'firepit' ? 'firepit_base' : 'fire_base').setOrigin(0.5, 0.75);
        flame = this.add.image(0, -4, 'flame').setOrigin(0.5, 1);
        spr.add([glow, base, flame]);
      }
      spr.setSize(64, 50);
      spr.base = base;
      spr.flame = flame;
      spr.glow = glow;
      spr.artFire = base === flame;
    } else if (e.type === 'drop') {
      spr = this.add.container(e.x, e.y);
      const key = itemSprite(e.item.id);
      const pic = key
        ? this.add.image(0, 0, key).setOrigin(0.5, 1)
        : this.add.text(0, 0, '', { fontSize: '22px', fontFamily: FONT }).setOrigin(0.5, 1);
      if (key) this.applyArt(pic, key);
      pic.setScale(key ? ART_HEIGHT.item / pic.height : 1);
      if (key && isGolden(e.item.id)) pic.setTint(GOLD_TINT);
      const count = this.add.text(10, 2, '', {
        fontSize: '12px', fontFamily: FONT, color: '#ffffff', stroke: '#000000', strokeThickness: 3, fontStyle: 'bold',
      }).setOrigin(0, 1);
      spr.add([pic, count]);
      spr.setSize(30, 30);
      spr.pic = pic;
      spr.count = count;
    } else {
      spr = this.add.image(e.x, e.y, this.entTexture(e)).setOrigin(0.5, 0.95);
    }
    spr.setDepth(e.y);
    const o = { e, spr, pending: 0 };
    this.ents.set(e.id, o);
    if (FIRES[e.type]) this.fires.add(o);
    this.refreshEnt(o);
  }

  refreshEnt(o) {
    const { e, spr } = o;
    if (e.type === 'drop') {
      if (spr.pic.setText) spr.pic.setText(ITEMS[e.item.id].icon);
      spr.count.setText(e.item.count > 1 ? `${e.item.count}` : '');
    } else if (FIRES[e.type]) {
      if (spr.artFire) {
        // Lửa tắt: làm tối hình thay vì ẩn ngọn lửa
        if (e.fuel > 0) spr.base.clearTint();
        else spr.base.setTint(0x555555);
      } else {
        spr.flame.setVisible(e.fuel > 0);
      }
      spr.glow.setVisible(e.fuel > 0);
    } else {
      const key = this.entTexture(e);
      const mul = e.type === 'tree' ? 0.85 + ((e.id * 37) % 30) / 100 : 1;
      this.applyArt(spr, key, mul);
    }
  }

  updEnt(e) {
    const o = this.ents.get(e.id);
    if (!o) return this.addEnt(e);
    o.e = e;
    this.refreshEnt(o);
    if (e.type === 'chest' && this.hud.chestId === e.id) this.hud.renderChest(e.slots);
  }

  delEnt(id) {
    const o = this.ents.get(id);
    if (!o) return;
    if (this.hover?.o === o) this.setHover(null);
    if (this.hud.chestId === id) this.hud.closeChest();
    o.spr.destroy();
    this.ents.delete(id);
    this.fires.delete(o);
  }

  // ---------- Nhân vật & quái ----------

  makePlayer(id) {
    const c = this.add.container(0, 0);
    const shadow = this.add.image(0, 0, 'shadow');
    const legs = this.add.image(0, 0, 'p_legs').setOrigin(0.5, 1);
    const body = this.add.image(0, -10, 'p_body').setOrigin(0.5, 1);
    const head = this.add.image(0, -28, 'p_head').setOrigin(0.5, 1);
    const hair = this.add.image(0, -46, 'p_hair').setOrigin(0.5, 1);
    const item = this.add.text(15, -22, '', { fontSize: '20px', fontFamily: FONT }).setOrigin(0.5, 0.9);
    const armor = this.add.text(0, -18, '', { fontSize: '15px', fontFamily: FONT }).setOrigin(0.5);
    const hat = this.add.text(0, -54, '', { fontSize: '20px', fontFamily: FONT }).setOrigin(0.5);
    const ghost = this.add.image(0, -6, 'ghost').setOrigin(0.5, 1).setAlpha(0.6).setVisible(false);
    const stars = this.add.text(0, 0, '💫', { fontSize: '20px', fontFamily: FONT }).setOrigin(0.5).setVisible(false);
    // Vòng màu dưới chân để phân biệt người chơi
    const ring = this.add.ellipse(0, 0, 36, 12, 0xffffff, 0.5);
    const itemImg = this.add.image(16, -24, 'shadow').setOrigin(0.5, 0.85).setVisible(false);
    let sprite = null;
    if (art.has('player_idle')) {
      sprite = this.add.image(0, 2, 'player_idle').setOrigin(0.5, 1);
      for (const part of [legs, body, head, hair]) part.destroy();
    }
    c.add(sprite
      ? [ring, shadow, sprite, armor, hat, item, itemImg, ghost, stars]
      : [ring, shadow, legs, body, armor, head, hair, hat, item, itemImg, ghost, stars]);

    const label = this.add.text(0, 0, '', {
      fontSize: '13px', fontFamily: FONT, color: '#ffffff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(UI_DEPTH);
    const bubble = this.add.text(0, 0, '', {
      fontSize: '14px', fontFamily: FONT, color: '#2b2118', backgroundColor: '#f3ead2',
      padding: { x: 7, y: 4 }, wordWrap: { width: 220 }, align: 'center',
    }).setOrigin(0.5, 1).setDepth(UI_DEPTH).setVisible(false);

    const pl = {
      id, c, legs, body, head, hair, item, itemImg, armor, hat, ghost, stars, label, bubble, ring, sprite,
      x: 0, y: 0, tx: 0, ty: 0, dead: false, eq: null, face: 1, moving: false, bubbleTimer: null, hurtUntil: 0,
    };
    this.applyRoster(pl);
    this.players.set(id, pl);
    return pl;
  }

  applyRoster(pl) {
    const info = this.roster.get(pl.id) || { name: '...', color: 0xffffff };
    if (pl.sprite) pl.sprite.clearTint();
    else pl.body.setTint(info.color);
    pl.ring.setFillStyle(info.color, 0.55);
    pl.label.setText(info.name);
  }

  destroyPlayer(pl) {
    pl.c.destroy();
    pl.label.destroy();
    pl.bubble.destroy();
    this.players.delete(pl.id);
    if (this.hover?.o === pl) this.setHover(null);
  }

  makeMob(id, type, x, y) {
    const c = this.add.container(x, y);
    const shadow = this.add.image(0, 2, 'shadow').setScale(MOB_SHADOW[type] ?? 1.3);
    const body = this.add.image(0, 0, type).setOrigin(0.5, 0.9);
    this.applyArt(body, type);
    c.add([shadow, body]);
    c.setSize(56, 40);
    const m = { id, type, c, body, x, y, tx: x, ty: y, face: 1, windupUntil: 0, slamUntil: 0 };
    this.mobs.set(id, m);
    if (type === 'deerclops') this.roar(x, y);
    return m;
  }

  // Phát tiếng tại điểm (x, y) trong thế giới: càng xa nhân vật mình càng nhỏ.
  playAt(name, x, y, rate = 1) {
    const d = Math.hypot(this.me.x - x, this.me.y - y);
    if (d < SOUND_RANGE) this.hud.sound.sfx(name, Math.max(0.15, 1 - d / SOUND_RANGE), rate);
  }

  roar(x, y) {
    if (this.time.now < this.nextRoar) return;
    this.nextRoar = this.time.now + ROAR_GAP_MS;
    this.playAt('deerclops_voice', x, y);
  }

  bubble(id, text) {
    const pl = this.players.get(id);
    if (!pl) return;
    pl.bubble.setText(text).setVisible(true);
    pl.bubbleTimer?.remove();
    pl.bubbleTimer = this.time.delayedCall(3500, () => pl.bubble.setVisible(false));
  }

  // ---------- Hiệu ứng ----------

  floatText(x, y, text, color) {
    const t = this.add.text(x, y, text, {
      fontSize: '16px', fontFamily: FONT, color, stroke: '#000000', strokeThickness: 3, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(UI_DEPTH).setScale(1 / this.zoom);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  swing(id) {
    const pl = this.players.get(id);
    if (!pl) return;
    this.tweens.add({ targets: [pl.item, pl.itemImg], angle: -70 * pl.face, duration: 90, yoyo: true });
  }

  onFx(fx) {
    if (fx.by) this.swing(fx.by);
    switch (fx.k) {
      case 'pick': {
        const pl = this.players.get(fx.by);
        if (pl && PICK_SOUNDS[fx.what]) this.playAt(PICK_SOUNDS[fx.what], pl.x, pl.y, 0.93 + Math.random() * 0.14);
        break;
      }
      case 'chop': {
        const o = this.ents.get(fx.id);
        if (!o) break;
        // Lệch cao độ một chút để các nhát liên tiếp nghe không giống hệt nhau.
        if (o.e.type === 'tree') this.playAt('chop', o.e.x, o.e.y, 0.92 + Math.random() * 0.16);
        else if (o.e.type === 'boulder') this.playAt('mine', o.e.x, o.e.y, 0.92 + Math.random() * 0.16);
        this.tweens.add({ targets: o.spr, x: o.e.x + 4, duration: 50, yoyo: true, repeat: 1, onComplete: () => { o.spr.x = o.e.x; } });
        break;
      }
      case 'hit': {
        const m = this.mobs.get(fx.id);
        if (!m) break;
        m.body.setTintFill(0xffffff);
        this.time.delayedCall(90, () => m.body.active && m.body.clearTint());
        this.floatText(m.x, m.y - 40, `-${fx.n}`, '#ffe08a');
        break;
      }
      case 'bite': {
        const m = this.mobs.get(fx.id);
        if (m) this.tweens.add({ targets: m.c, scaleX: 1.2, scaleY: 1.2, duration: 80, yoyo: true });
        break;
      }
      // Boss gồng đòn: vẽ vùng sẽ bị đập (nằm trên lớp bóng tối để ban đêm vẫn thấy mà né).
      case 'windup': {
        const m = this.mobs.get(fx.id);
        if (m) {
          m.windupUntil = this.time.now + fx.ms;
          m.face = fx.x < m.x ? -1 : 1;
          this.roar(m.x, m.y);
        }
        const ring = this.add.circle(fx.x, fx.y, fx.r, 0xff3020, 0.12).setStrokeStyle(3, 0xff5040, 0.9).setDepth(DARK_DEPTH + 1);
        const core = this.add.circle(fx.x, fx.y, fx.r, 0xff3020, 0.3).setDepth(DARK_DEPTH + 1).setScale(0);
        const eye = this.add.circle(fx.x, fx.y, fx.sr ?? fx.r * 0.35, 0xff2010, 0.35).setDepth(DARK_DEPTH + 1); // tâm: đau nhất + choáng
        this.tweens.add({ targets: core, scale: 1, duration: fx.ms, onComplete: () => { core.destroy(); ring.destroy(); eye.destroy(); } });
        break;
      }
      case 'slam': {
        const m = this.mobs.get(fx.id);
        if (m) m.slamUntil = this.time.now + 400;
        this.playAt('deerclops_boom', fx.x, fx.y);
        if (this.textures.exists(EXPLOSION[0])) this.explode(fx.x, fx.y, fx.r);
        else {
          const wave = this.add.circle(fx.x, fx.y, fx.r * 0.4, 0xdfeeff, 0.45).setStrokeStyle(4, 0xffffff, 0.9).setDepth(DARK_DEPTH + 1);
          this.tweens.add({ targets: wave, scale: 2.5, alpha: 0, duration: 450, onComplete: () => wave.destroy() });
        }
        const d = Math.hypot(this.me.x - fx.x, this.me.y - fx.y);
        if (d < 900) this.cameras.main.shake(300, d < fx.r * 1.5 ? 0.02 : 0.007);
        break;
      }
      case 'stun':
        if (fx.id === this.myId) {
          this.stunUntil = this.time.now + fx.ms;
          this.target = null;
        }
        break;
      case 'boomhit': {
        const spark = this.add.circle(fx.x, fx.y, 8, 0xffc040, 0.9).setDepth(fx.y + 40);
        this.tweens.add({ targets: spark, scale: 2.5, alpha: 0, duration: 250, onComplete: () => spark.destroy() });
        break;
      }
      case 'hurt': {
        const pl = this.players.get(fx.id);
        if (!pl) break;
        (pl.sprite ?? pl.body).setTintFill(0xff4040);
        pl.hurtUntil = this.time.now + 250;
        this.time.delayedCall(120, () => this.applyRoster(pl));
        this.floatText(pl.x, pl.y - 60, `-${fx.n}`, '#ff6a5a');
        if (fx.id === this.myId) {
          this.cameras.main.shake(150, 0.006);
          this.hud.flash();
        }
        break;
      }
      case 'charlie':
        if (fx.id === this.myId) {
          this.hud.flash('dark');
          this.cameras.main.shake(300, 0.015);
        }
        break;
      case 'die': {
        const puff = this.add.circle(fx.x, fx.y - (fx.big ? 60 : 10), fx.big ? 50 : 14, 0xdddddd, 0.7).setDepth(fx.y + 1);
        this.tweens.add({ targets: puff, scale: 2.5, alpha: 0, duration: fx.big ? 800 : 400, onComplete: () => puff.destroy() });
        break;
      }
    }
  }

  // Phát vụ nổ tại (x, y). Giữ nguyên tỉ lệ giữa các khung (vụ nổ tự to dần rồi tan), nằm trên lớp bóng tối.
  explode(x, y, r) {
    const img = this.add.image(x, y, EXPLOSION[0]).setDepth(DARK_DEPTH + 1).setScale((r * 2) / EXPLOSION_MAX_W);
    let i = 0;
    this.time.addEvent({
      delay: EXPLOSION_FRAME_MS,
      repeat: EXPLOSION.length - 1,
      callback: () => {
        if (++i < EXPLOSION.length) img.setTexture(EXPLOSION[i]);
        else img.destroy();
      },
    });
  }

  // ---------- Điều khiển ----------

  hasTool(tool) {
    return ITEMS[this.gear.hand?.id]?.tool === tool;
  }

  // Các trạm chế tạo (Máy Khoa Học, Nồi nấu) đang ở đủ gần.
  nearStations() {
    const near = new Set();
    for (const o of this.ents.values()) {
      const st = STATIONS[o.e.type];
      if (st && Math.hypot(o.e.x - this.me.x, o.e.y - this.me.y) <= st.range) near.add(o.e.type);
    }
    return near;
  }

  // Có thể tương tác ngay (dùng cho phím Space)?
  canInteract(o, time) {
    if (o.pending > time) return false;
    const e = o.e;
    // Cầm xẻng thì Space không tự đào (chỉ đào khi bấm chuột vào từng cây).
    if (DIGGABLE.has(e.type) && this.hasTool('dig')) return false;
    switch (e.type) {
      case 'tree': return this.hasTool('chop');
      case 'boulder': return this.hasTool('mine');
      case 'sapling': case 'grass': case 'bush': return !!e.ready;
      case 'flower': case 'flint': case 'carrot': case 'drop': return true;
      case 'trap': return !!e.caught;
      case 'dryingrack': return !!e.dry && this.worldT >= e.dry.at;
      default: return false;
    }
  }

  hoverLabel(h) {
    if (h.kind === 'mob') return `${this.gear.hand?.id === 'boomerang' ? 'Ném boomerang vào' : 'Tấn công'} ${MOB_NAMES[h.o.type] ?? ''}`;
    if (h.kind === 'player') return this.roster.get(h.o.id)?.name ?? '';
    const e = h.o.e;
    if (STRUCTURES.has(e.type) && this.hasTool('hammer')) return `Đập bỏ ${NAMES[e.type]}`;
    if (DIGGABLE.has(e.type) && this.hasTool('dig')) return `Đào ${NAMES[e.type]}`;
    switch (e.type) {
      case 'tree': return this.hasTool('chop') ? 'Chặt cây' : 'Cây thông (cần rìu)';
      case 'boulder': return this.hasTool('mine') ? 'Đập đá' : 'Tảng đá (cần cuốc chim)';
      case 'campfire': case 'firepit':
        return e.fuel > 0 ? `${NAMES[e.type]} — còn ${Math.ceil(e.fuel)} giây` : `${NAMES[e.type]} đã tắt — thêm củi để nhóm lại`;
      case 'science': return 'Máy Khoa Học — đứng gần để chế tạo đồ 🔒';
      case 'crockpot': return 'Nồi nấu — đứng gần để nấu món hầm';
      case 'chest': return 'Mở rương';
      case 'trap': return e.caught ? 'Lấy thỏ trong bẫy' : 'Bẫy thỏ (đang chờ)';
      case 'tent': return `Ngủ trong lều (còn ${e.uses ?? 0} lần) — chạng vạng / ban đêm`;
      case 'dryingrack': {
        if (!e.dry) return 'Giàn phơi (trống) — chuột phải vào thịt sống để phơi';
        const left = Math.ceil(e.dry.at - this.worldT);
        return left > 0 ? `Đang phơi ${ITEMS[e.dry.out].name} — còn ${left} giây` : `Lấy ${ITEMS[e.dry.out].name}`;
      }
      case 'drop': return `Nhặt ${ITEMS[e.item.id].name}${e.item.count > 1 ? ` ×${e.item.count}` : ''}`;
      default:
        if ('ready' in e && !e.ready) return `${NAMES[e.type]} (đang mọc lại)`;
        return PICK_LABELS[e.type] ?? NAMES[e.type];
    }
  }

  // Tìm vật thể nằm dưới con trỏ chuột (ưu tiên vật ở phía trước).
  pickAt(wx, wy) {
    let best = null;
    let bestY = -Infinity;
    for (const m of this.mobs.values()) {
      const hw = Math.max(30, m.body.displayWidth / 2), hh = Math.max(42, m.body.displayHeight * 0.85);
      if (Math.abs(m.x - wx) < hw && wy > m.y - hh && wy < m.y + 8 && m.y > bestY) {
        best = { kind: 'mob', o: m };
        bestY = m.y;
      }
    }
    if (best) return best;
    for (const o of this.ents.values()) {
      const e = o.e;
      if (Math.abs(e.x - wx) > 60 || wy > e.y + 14 || wy < e.y - 130) continue;
      if (e.y > bestY && o.spr.getBounds().contains(wx, wy)) {
        best = { kind: 'ent', o };
        bestY = e.y;
      }
    }
    if (best) return best;
    for (const pl of this.players.values()) {
      if (pl.id !== this.myId && Math.abs(pl.x - wx) < 18 && wy > pl.y - 64 && wy < pl.y + 4) return { kind: 'player', o: pl };
    }
    return null;
  }

  setHover(h) {
    const prev = this.hover?.kind === 'ent' ? this.hover.o.spr : this.hover?.kind === 'mob' ? this.hover.o.body : null;
    if (prev?.active && prev.clearTint) prev.clearTint();
    this.hover = h;
    if (!h) {
      this.tip.hidden = true;
      return;
    }
    const spr = h.kind === 'ent' ? h.o.spr : h.kind === 'mob' ? h.o.body : null;
    if (spr?.setTint) spr.setTint(0xfff2b0);
    this.tip.textContent = this.hoverLabel(h);
    this.tip.hidden = false;
  }

  // Vật / quái gần điểm chạm nhất (ngón tay to hơn con trỏ chuột nên cho phép lệch một chút).
  pickNear(wx, wy, r) {
    let best = null;
    let bd = r;
    for (const m of this.mobs.values()) {
      const d = Math.hypot(m.x - wx, m.y - 20 - wy);
      if (d < bd) { bd = d; best = { kind: 'mob', o: m }; }
    }
    if (best) return best;
    for (const o of this.ents.values()) {
      const d = Math.hypot(o.e.x - wx, o.e.y - 15 - wy);
      if (d < bd) { bd = d; best = { kind: 'ent', o }; }
    }
    return best;
  }

  onPointerDown(p) {
    if (p.button !== 0 || this.hud.busy) return;
    let h = this.pickAt(p.worldX, p.worldY);
    if (!h && this.hud.controls.touch) h = this.pickNear(p.worldX, p.worldY, TAP_SLOP / this.zoom);
    if (h?.kind === 'mob') this.target = { kind: 'mob', id: h.o.id };
    else if (h?.kind === 'ent') this.target = { kind: 'ent', id: h.o.e.id };
    else this.target = { kind: 'point', x: p.worldX, y: p.worldY };
  }

  nearest(radius, mobs, time) {
    let best = null;
    let bd = radius;
    if (mobs) {
      for (const m of this.mobs.values()) {
        const d = Math.hypot(m.x - this.me.x, m.y - this.me.y);
        if (d < bd) { bd = d; best = { kind: 'mob', id: m.id }; }
      }
    } else {
      for (const o of this.ents.values()) {
        const d = Math.hypot(o.e.x - this.me.x, o.e.y - this.me.y);
        if (d < bd && this.canInteract(o, time)) { bd = d; best = { kind: 'ent', id: o.e.id }; }
      }
    }
    return best;
  }

  followTarget(time) {
    const t = this.target;
    let tx, ty, range;
    // Cầm boomerang (hoặc boomerang đang bay): đứng xa mà ném, chờ nó bay về rồi ném tiếp.
    const ranged = t.kind === 'mob' && (this.gear.hand?.id === 'boomerang' || this.myBoomFlying);
    if (t.kind === 'point') {
      tx = t.x; ty = t.y; range = 6;
    } else if (t.kind === 'mob') {
      const m = this.mobs.get(t.id);
      if (!m) { this.target = null; return [0, 0]; }
      tx = m.x; ty = m.y; range = ranged ? BOOMERANG.range - 40 : 46;
    } else {
      const o = this.ents.get(t.id);
      if (!o) { this.target = null; return [0, 0]; }
      tx = o.e.x; ty = o.e.y; range = 52;
    }
    const dx = tx - this.me.x, dy = ty - this.me.y, d = Math.hypot(dx, dy);
    if (d > range) return [dx / d, dy / d];
    if (t.kind === 'point' || this.me.dead) {
      this.target = null;
      return [0, 0];
    }
    if (ranged) {
      if (!this.myBoomFlying && time >= this.nextAct) {
        this.flushPos();
        this.socket.emit('throw', { id: t.id });
        this.nextAct = time + 420;
      }
      return [0, 0];
    }
    if (time >= this.nextAct) {
      this.flushPos();
      this.socket.emit('act', { id: t.id });
      this.nextAct = time + 420;
      if (t.kind === 'ent') {
        const o = this.ents.get(t.id);
        if (!REPEAT_TYPES.has(o.e.type)) {
          o.pending = time + 900;
          this.target = null;
        }
      }
    }
    return [0, 0];
  }

  // ---------- Vòng lặp ----------

  update(time, delta) {
    const dt = Math.min(0.1, delta / 1000);
    this.worldT += dt;
    const k = this.keys;
    const typing = this.hud.busy;

    const pad = this.hud.controls;
    const stunned = time < this.stunUntil;
    let dx = 0, dy = 0;
    if (!typing && !stunned) {
      if (k.A.isDown || k.LEFT.isDown) dx -= 1;
      if (k.D.isDown || k.RIGHT.isDown) dx += 1;
      if (k.W.isDown || k.UP.isDown) dy -= 1;
      if (k.S.isDown || k.DOWN.isDown) dy += 1;
      dx += pad.joy.x;
      dy += pad.joy.y;
    }
    if (dx || dy) {
      this.target = null;
    } else if (!stunned) {
      if (!typing && !this.target && !this.me.dead && time >= this.nextAuto) {
        if (k.SPACE.isDown || pad.gather) this.target = this.nearest(350, false, time);
        else if (k.F.isDown || pad.attack) this.target = this.nearest(350, true, time);
        this.nextAuto = time + 120;
      }
      if (this.target) [dx, dy] = this.followTarget(time);
    }

    const len = Math.hypot(dx, dy);
    const me = this.me;
    if (len > 0) {
      me.x += (dx / len) * PLAYER_SPEED * dt;
      me.y += (dy / len) * PLAYER_SPEED * dt;
      if (dx) me.face = dx < 0 ? -1 : 1;
      me.dir = dirFromVector(dx, dy);
    }
    me.moving = len > 0;
    // Hồn ma bay không có tiếng bước chân.
    this.hud.sound.loop('run', me.moving && !me.dead && !me.asleep);

    this.posTimer += delta;
    if (this.posTimer >= 50) {
      this.posTimer = 0;
      this.flushPos();
    }

    const lerp = 1 - Math.exp(-dt * 12);
    for (const pl of this.players.values()) {
      if (pl !== me) {
        const ox = pl.x, oy = pl.y;
        pl.x += (pl.tx - pl.x) * lerp;
        pl.y += (pl.ty - pl.y) * lerp;
        pl.moving = Math.hypot(pl.tx - pl.x, pl.ty - pl.y) > 2;
        if (Math.abs(pl.x - ox) > 0.3) pl.face = pl.x < ox ? -1 : 1;
        if (Math.hypot(pl.x - ox, pl.y - oy) > 0.3) pl.dir = dirFromVector(pl.x - ox, pl.y - oy);
      }
      this.drawPlayer(pl, time);
    }

    for (const m of this.mobs.values()) {
      const ox = m.x;
      m.x += (m.tx - m.x) * lerp;
      m.y += (m.ty - m.y) * lerp;
      if (Math.abs(m.x - ox) > 0.2) m.face = m.x < ox ? -1 : 1;
      const moving = Math.hypot(m.tx - m.x, m.ty - m.y) > 1;
      m.c.setPosition(m.x, m.y).setDepth(m.y);
      m.body.setFlipX(m.face < 0);
      if (m.type === 'deerclops') this.animBoss(m, moving, time);
      else m.c.scaleY = moving ? 1 + Math.sin(time * 0.03) * 0.07 : 1;
    }

    for (const b of this.booms.values()) {
      b.x += (b.tx - b.x) * lerp;
      b.y += (b.ty - b.y) * lerp;
      b.img.setPosition(b.x, b.y).setDepth(b.y + 30);
      b.img.angle += dt * 1100;
    }

    // Đóng rương khi đi xa; cập nhật danh sách trạm chế tạo đang ở gần.
    if (this.hud.chestId) {
      const c = this.ents.get(this.hud.chestId);
      if (!c || me.dead || Math.hypot(c.e.x - me.x, c.e.y - me.y) > 170) this.hud.closeChest();
    }
    this.stationTimer += delta;
    if (this.stationTimer > 250) {
      this.stationTimer = 0;
      this.hud.setStations(this.nearStations());
    }

    const fireFrame = Math.floor(time / 110) % 8;
    for (const o of this.fires) {
      if (o.e.type === 'campfire' && o.spr.artFire && art.has('campfire_anim_0')) {
        const key = `campfire_anim_${(fireFrame + o.e.id) % 8}`;
        if (o.spr.base.texture.key !== key) o.spr.base.setTexture(key).setScale(ART_HEIGHT.campfire / 45);
      }
      const f = Math.min(o.e.fuel, FIRES[o.e.type].max) / FIRES[o.e.type].max;
      const flick = 1 + Math.sin(time * 0.02 + o.e.id) * 0.06 + Math.random() * 0.05;
      if (o.spr.artFire) o.spr.base.scaleY = o.spr.base.scaleX * (0.97 + (flick - 1) * 0.6);
      else o.spr.flame.setScale((0.5 + f * 0.9) * flick);
      o.spr.glow.setScale((fireRadius(o.e.fuel) * 2) / 256);
    }

    this.updateHover();
    this.overlayAt = this.placeOverlays();
    this.drawDarkness(time);
    this.minimap.update();

    this.labelTimer += delta;
    if (pad.touch && pad.padVisible && this.labelTimer > 200) {
      this.labelTimer = 0;
      this.updateActionLabels(time);
    }

    this.clockTimer += delta;
    if (this.clockTimer > 250) {
      this.clockTimer = 0;
      this.hud.setClock(this.worldT);
    }
  }

  // Deerclops: gồng (atk_0) -> vồ (atk_1) -> đi / đứng. Mọi khung dùng chung tỉ lệ để hình không co giãn.
  animBoss(m, moving, time) {
    if (!art.has('deerclops')) return;
    let key = 'deerclops';
    if (time < m.windupUntil) key = 'deerclops_atk_0';
    else if (time < m.slamUntil) key = 'deerclops_atk_1';
    else if (moving) key = `deerclops_walk_${BOSS_WALK[Math.floor(time / 170) % BOSS_WALK.length]}`;
    if (!art.has(key)) key = 'deerclops';
    if (m.body.texture.key !== key) m.body.setTexture(key);
    m.body.setScale(ART_HEIGHT.deerclops / art.get('deerclops')[1]);
  }

  // Nút ✋ / ⚔️ trên điện thoại hiện việc sẽ làm với vật / quái gần nhất.
  updateActionLabels(time) {
    const g = this.nearest(350, false, time);
    const m = this.nearest(350, true, time);
    this.hud.setActionLabels(
      g ? this.hoverLabel({ kind: 'ent', o: this.ents.get(g.id) }) : 'Thu thập',
      m ? this.hoverLabel({ kind: 'mob', o: this.mobs.get(m.id) }) : 'Tấn công',
    );
  }

  drawPlayer(pl, time) {
    pl.c.setPosition(pl.x, pl.y).setDepth(pl.y);
    // Mờ khi đang ngủ trong lều; nhấp nháy khi vừa hồi sinh (bóng tối chưa tấn công được)
    pl.c.setAlpha(pl.dead ? 1 : pl.asleep ? 0.35 : pl.safe ? 0.65 + Math.sin(time * 0.012) * 0.3 : 1);
    const alive = !pl.dead;
    const parts = pl.sprite ? [pl.sprite] : [pl.legs, pl.body, pl.head, pl.hair];
    for (const part of [...parts, pl.armor, pl.hat, pl.ring, pl.c.list[1]]) part.setVisible(alive);
    pl.ghost.setVisible(pl.dead);
    if (pl.dead) {
      pl.item.setVisible(false);
      pl.itemImg.setVisible(false);
      pl.ghost.y = -10 + Math.sin(time * 0.004) * 4;
      pl.ghost.setFlipX(pl.face < 0);
    } else {
      const bob = pl.moving ? Math.abs(Math.sin(time * 0.015)) * 3 : 0;
      let top; // đỉnh đầu, để đặt mũ
      let suited = false;
      if (pl.sprite) {
        // Hoạt ảnh: chạy khi di chuyển, đứng yên quay mặt ra trước, khựng lại khi bị đánh
        const [base, flip] = DIR_FRAMES[pl.dir ?? 'down'];
        if (art.has(`player_idle_${base}`)) {
          // Bộ khung 8 hướng: bước chân luân phiên khi di chuyển, giữ hướng cuối khi đứng yên
          const pose = pl.moving ? STEP_CYCLE[Math.floor(time / STEP_MS) % STEP_CYCLE.length] : 'idle';
          let frame = `player_${pose}_${base}`;
          // Mặc giáp gỗ: bộ hình nhân vật mặc giáp, cùng tư thế và nhịp bước; không vẽ emoji lên người nữa
          suited = pl.bodyGear === 'logsuit' && art.has(`player_suit_${pose}_${base}`);
          if (suited) frame = `player_suit_${pose}_${base}`;
          if (!art.has(frame)) frame = `player_idle_${base}`;
          if (pl.sprite.texture.key !== frame) pl.sprite.setTexture(frame);
          pl.sprite.setScale(ART_HEIGHT.player / PLAYER_FRAME_H);
          pl.sprite.setFlipX(flip);
        } else {
          const frame = time < pl.hurtUntil ? 'player_hurt'
            : pl.moving ? RUN_FRAMES[Math.floor(time / 110) % RUN_FRAMES.length] : 'player_idle';
          if (art.has(frame) && pl.sprite.texture.key !== frame) pl.sprite.setTexture(frame);
          pl.sprite.setScale(ART_HEIGHT.player / pl.sprite.height);
          pl.sprite.setFlipX(pl.moving || time < pl.hurtUntil ? pl.face < 0 : false);
        }
        pl.sprite.y = 2 - bob * 0.5;
        top = -ART_HEIGHT.player;
      } else {
        pl.body.y = -10 - bob;
        pl.head.y = -28 - bob;
        pl.hair.y = -46 - bob;
        pl.legs.scaleY = pl.moving ? 1 - Math.abs(Math.sin(time * 0.015)) * 0.25 : 1;
        for (const part of [pl.body, pl.head, pl.hair]) part.setFlipX(pl.face < 0);
        pl.hair.setVisible(!pl.headGear);
        top = -58;
      }
      // Đồ cầm tay: dùng sprite nếu có, không thì emoji. Cầm bên phía đang quay mặt.
      const dir = pl.dir ?? 'down';
      const side = dir.includes('left') ? -1 : dir.includes('right') ? 1 : pl.face;
      const behind = dir.startsWith('up');
      const key = pl.eq ? itemSprite(pl.eq) : null;
      pl.itemImg.setVisible(!!key);
      pl.item.setVisible(!key);
      if (key) {
        if (pl.itemImg.texture.key !== key) pl.itemImg.setTexture(key);
        if (isGolden(pl.eq)) pl.itemImg.setTint(GOLD_TINT);
        else pl.itemImg.clearTint();
        pl.itemImg.setScale(30 / pl.itemImg.height).setFlipX(side < 0);
      }
      pl.item.setText(!key && pl.eq ? ITEMS[pl.eq]?.icon ?? '' : '');
      for (const it of [pl.item, pl.itemImg]) {
        it.x = 17 * side;
        it.y = -24 - bob;
      }
      if (pl.sprite) {
        // Quay lưng: đồ cầm tay nằm sau người; còn lại nằm trước
        const list = pl.c.list;
        const si = list.indexOf(pl.sprite), ii = list.indexOf(pl.itemImg);
        if (behind && ii > si) {
          pl.c.moveBelow(pl.itemImg, pl.sprite);
          pl.c.moveBelow(pl.item, pl.sprite);
        } else if (!behind && ii < si) {
          pl.c.moveAbove(pl.itemImg, pl.sprite);
          pl.c.moveAbove(pl.item, pl.sprite);
        }
      }
      pl.armor.setText(pl.bodyGear && !suited ? ITEMS[pl.bodyGear]?.icon ?? '' : '');
      pl.armor.y = -22 - bob;
      pl.hat.setText(pl.headGear ? ITEMS[pl.headGear]?.icon ?? '' : '');
      pl.hat.y = top + 6 - bob;
      const stunned = pl.stunned || (pl === this.me && time < this.stunUntil);
      pl.stars.setVisible(stunned);
      if (stunned) {
        pl.stars.setPosition(Math.sin(time * 0.012) * 8, top - 10);
        pl.stars.angle = Math.sin(time * 0.02) * 20;
      }
    }
    if (pl.dead) pl.stars.setVisible(false);
    const h = pl.sprite ? ART_HEIGHT.player : 58;
    pl.label.setPosition(pl.x, pl.y - h - 8).setScale(1 / this.zoom);
    pl.bubble.setPosition(pl.x, pl.y - h - 8 - 20 / this.zoom).setScale(1 / this.zoom);
  }

  updateHover() {
    const p = this.input.activePointer;
    if (!p || !this.pointerIn || this.hud.busy || this.hud.controls.touch) {
      if (this.hover) this.setHover(null);
      return;
    }
    p.updateWorldPoint(this.cameras.main);
    const h = this.pickAt(p.worldX, p.worldY);
    if (h?.o !== this.hover?.o) this.setHover(h);
    else if (h) this.tip.textContent = this.hoverLabel(h);
    if (h) {
      this.tip.style.left = `${p.x}px`;
      this.tip.style.top = `${p.y}px`;
    }
  }

  drawDarkness(time) {
    const a = darknessAt(this.worldT);
    if (a < 0.01) {
      this.dark.setVisible(false);
      return;
    }
    this.dark.setVisible(true);
    this.dark.clear();
    this.dark.fill(0x060814, a);
    const view = this.overlayAt; // ánh sáng vẽ theo tọa độ bên trong lớp bóng tối
    const lights = [];
    for (const o of this.fires) lights.push([o.e.x, o.e.y - 10, fireRadius(o.e.fuel), o.e.id]);
    for (const pl of this.players.values()) {
      if (!pl.dead && pl.eq === 'torch') lights.push([pl.x, pl.y - 30, TORCH_RADIUS, pl.id]);
    }
    for (const [x, y, r, seed] of lights) {
      if (r <= 0) continue;
      const flick = 1 + Math.sin(time * 0.012 + seed) * 0.03;
      this.lightImg.setPosition(x - view.x, y - view.y).setScale(((r * 2) / 256) * flick);
      this.dark.erase(this.lightImg);
    }
  }
}

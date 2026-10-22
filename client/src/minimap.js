import { BIOMES, CHUNK, SPAWN, FIRES, STATIONS, DEN_CELL, VILLAGE, biomeAt, densIn, villagesIn } from '../../shared/data.js';

const $ = (id) => document.getElementById(id);

// Bán kính khung nhìn của bản đồ (pixel thế giới, tính từ tâm ra mép), từ gần tới xa.
const RANGES = [1200, 2400, 4800, 9600, 19200, 38400];
const CELLS = 96; // số ô địa hình theo mỗi cạnh bản đồ
const HOSTILE = new Set(['spider', 'spider_warrior', 'spiderling', 'spiderqueen', 'hound', 'deerclops', 'bearger']);
const BOSSES = new Set(['deerclops', 'bearger', 'spiderqueen']);
const BUILDINGS = new Set([...Object.keys(STATIONS), 'chest', 'icebox', 'tent', 'dryingrack', 'trap']);
const FONT = 'Segoe UI, Tahoma, sans-serif';
const DEN_SEARCH = 20000; // tìm ổ Nhện chúa gần nhất trong bán kính này để chỉ hướng

const css = (c) => `#${(c ?? 0xffffff).toString(16).padStart(6, '0')}`;

// Bản đồ thu nhỏ: địa hình tự tính từ seed (giống mặt đất trong game), cộng với vị trí mọi người chơi.
// Máy tính mở / đóng bằng Tab, điện thoại bằng nút 🗺️.
export class Minimap {
  constructor(scene) {
    this.scene = scene;
    this.el = $('map');
    this.canvas = $('map-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.zoom = 1;
    this.terrain = document.createElement('canvas');
    this.terrain.width = this.terrain.height = CELLS + 2;
    this.terrainKey = '';

    $('map-close').addEventListener('click', () => this.toggle(false));
    $('map-in').addEventListener('click', () => this.setZoom(this.zoom - 1));
    $('map-out').addEventListener('click', () => this.setZoom(this.zoom + 1));
    $('map-fit').addEventListener('click', () => this.fitAll());
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.setZoom(this.zoom + Math.sign(e.deltaY));
    }, { passive: false });
    this.setZoom(1);
  }

  get open() { return !this.el.hidden; }

  toggle(open = !this.open) {
    this.el.hidden = !open;
    $('tb-map').classList.toggle('on', open);
    if (open) this.draw();
  }

  setZoom(z) {
    this.zoom = Math.max(0, Math.min(RANGES.length - 1, z));
    $('map-in').disabled = this.zoom === 0;
    $('map-out').disabled = this.zoom === RANGES.length - 1;
    this.draw();
  }

  // Thu phóng vừa đủ để thấy tất cả người chơi (nếu không quá xa).
  fitAll() {
    const { me, players } = this.scene;
    let far = 0;
    for (const pl of players.values()) far = Math.max(far, Math.abs(pl.x - me.x), Math.abs(pl.y - me.y));
    const z = RANGES.findIndex((r) => r * 0.9 >= far);
    this.setZoom(z < 0 ? RANGES.length - 1 : z);
  }

  update() {
    if (this.open) this.draw();
  }

  // Ảnh địa hình CELLS x CELLS, mỗi ô khớp với lưới thế giới để không bị nhấp nháy khi di chuyển.
  // Chỉ vẽ lại khi người chơi bước sang ô khác hoặc đổi mức thu phóng.
  buildTerrain(gx0, gy0, cell) {
    const key = `${gx0},${gy0},${cell}`;
    if (key === this.terrainKey) return;
    this.terrainKey = key;
    const n = CELLS + 2;
    const tctx = this.terrain.getContext('2d');
    const img = tctx.createImageData(n, n);
    const seed = this.scene.seed;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const [r, g, b] = BIOMES[biomeAt(seed, (gx0 + x + 0.5) * cell, (gy0 + y + 0.5) * cell, this.scene.mapR, this.scene.villages)].color;
        const i = (y * n + x) * 4;
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
        img.data[i + 3] = 255;
      }
    }
    tctx.putImageData(img, 0, 0);
  }

  // Ổ Nhện chúa quanh mình (tính từ seed nên thấy cả ổ ở vùng chưa ai tới), trong khung nhìn hoặc tối thiểu
  // DEN_SEARCH để luôn biết ổ gần nhất. Chỉ tính lại khi sang ô lưới ổ khác hoặc đổi mức thu phóng.
  densNear(me, half) {
    if (!this.scene.hud.cfg?.spiderQueen) return [];
    const r = Math.max(half, DEN_SEARCH) + DEN_CELL;
    const key = `${Math.floor(me.x / DEN_CELL)},${Math.floor(me.y / DEN_CELL)},${r}`;
    if (key !== this.densKey) {
      this.densKey = key;
      this.dens = densIn(this.scene.seed, me.x - r, me.y - r, me.x + r, me.y + r, this.scene.mapR);
    }
    return this.dens;
  }

  // Làng lợn trong khung nhìn, tính từ seed như ổ nhện. Chỉ tính lại khi sang ô lưới làng khác hoặc đổi thu phóng.
  villagesNear(me, half) {
    if (!this.scene.villages) return [];
    const r = half + VILLAGE.cell;
    const key = `${Math.floor(me.x / VILLAGE.cell)},${Math.floor(me.y / VILLAGE.cell)},${r}`;
    if (key !== this.villagesKey) {
      this.villagesKey = key;
      this.villages = villagesIn(this.scene.seed, me.x - r, me.y - r, me.x + r, me.y + r, this.scene.mapR);
    }
    return this.villages;
  }

  // Làng lợn: vòng tròn hồng có mặt lợn, nhà lợn đã thấy thì vẽ thêm ô hồng riêng (xem draw).
  drawVillage(px, py, s) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(232, 160, 168, 0.85)';
    ctx.strokeStyle = '#3b2a1a';
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.arc(px, py, 8 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    this.label('🐷', px, py + 5 * s, 11 * s, '#ffffff');
  }

  // Điểm ở mép bản đồ theo hướng (px, py) nhìn từ tâm, và góc của hướng đó (cho mũi tên chỉ thứ nằm ngoài khung).
  edgePoint(px, py, size, pad) {
    const c = size / 2;
    const dx = px - c, dy = py - c;
    const t = (c - pad) / Math.max(Math.abs(dx), Math.abs(dy));
    return [c + dx * t, c + dy * t, Math.atan2(dy, dx)];
  }

  arrow(x, y, angle, fill, s) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = fill;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(9 * s, 0);
    ctx.lineTo(-6 * s, -6 * s);
    ctx.lineTo(-6 * s, 6 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawDen(px, py, s) {
    const ctx = this.ctx;
    ctx.fillStyle = '#7a1424';
    ctx.strokeStyle = '#f2f2ea';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.arc(px, py, 9 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    this.label('🕸', px, py + 7 * s, 12 * s, '#ffffff');
  }

  draw() {
    const { canvas, ctx, scene } = this;
    const dpr = window.devicePixelRatio || 1;
    const size = Math.round(canvas.clientWidth * dpr);
    if (!size) return;
    if (canvas.width !== size) canvas.width = canvas.height = size;

    const me = scene.me;
    const half = RANGES[this.zoom];
    const k = size / (half * 2); // pixel bản đồ / pixel thế giới
    const left = me.x - half, top = me.y - half;
    const toMap = (x, y) => [(x - left) * k, (y - top) * k];

    // Địa hình
    const cell = (half * 2) / CELLS;
    const gx0 = Math.floor(left / cell) - 1, gy0 = Math.floor(top / cell) - 1;
    this.buildTerrain(gx0, gy0, cell);
    ctx.imageSmoothingEnabled = true;
    const tsz = (CELLS + 2) * cell * k;
    ctx.drawImage(this.terrain, (gx0 * cell - left) * k, (gy0 * cell - top) * k, tsz, tsz);

    // Lưới chunk mờ để dễ ước lượng khoảng cách
    if (CHUNK * k > 24) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = Math.ceil(left / CHUNK) * CHUNK; x < left + half * 2; x += CHUNK) {
        const px = Math.round((x - left) * k) + 0.5;
        ctx.moveTo(px, 0);
        ctx.lineTo(px, size);
      }
      for (let y = Math.ceil(top / CHUNK) * CHUNK; y < top + half * 2; y += CHUNK) {
        const py = Math.round((y - top) * k) + 0.5;
        ctx.moveTo(0, py);
        ctx.lineTo(size, py);
      }
      ctx.stroke();
    }

    const inside = (px, py) => px >= 0 && py >= 0 && px <= size && py <= size;
    const s = dpr; // cỡ nét vẽ theo mật độ điểm ảnh

    // Điểm hồi sinh
    const [sx, sy] = toMap(SPAWN.x, SPAWN.y);
    if (inside(sx, sy)) this.label('✦', sx, sy + 7 * s, 14 * s, '#fff3c4');

    // Làng lợn (dưới các nhà lợn đã tải)
    for (const v of this.villagesNear(me, half)) {
      const [px, py] = toMap(v.x, v.y);
      if (inside(px, py)) this.drawVillage(px, py, s);
    }

    // Công trình và lửa trong vùng đã tải quanh mình
    for (const o of scene.ents.values()) {
      const e = o.e;
      const [px, py] = toMap(e.x, e.y);
      if (!inside(px, py)) continue;
      if (FIRES[e.type]) {
        ctx.fillStyle = e.fuel > 0 ? '#ffb347' : '#5a4a3a';
        ctx.beginPath();
        ctx.arc(px, py, 3.5 * s, 0, Math.PI * 2);
        ctx.fill();
      } else if (BUILDINGS.has(e.type)) {
        ctx.fillStyle = '#3b2a1a';
        ctx.fillRect(px - 3 * s, py - 3 * s, 6 * s, 6 * s);
      } else if (e.type === 'pighouse') {
        ctx.fillStyle = '#e8a0a8'; // Nhà lợn: ô hồng
        ctx.strokeStyle = '#3b2a1a';
        ctx.lineWidth = 1.5 * s;
        ctx.fillRect(px - 3.5 * s, py - 3.5 * s, 7 * s, 7 * s);
        ctx.strokeRect(px - 3.5 * s, py - 3.5 * s, 7 * s, 7 * s);
      }
    }

    // Ổ Nhện chúa: vẽ các ổ trong khung; không ổ nào trong khung thì mũi tên ở mép chỉ tới ổ gần nhất kèm khoảng cách.
    let nearest = null, nd = Infinity, shown = false;
    for (const d of this.densNear(me, half)) {
      const [px, py] = toMap(d.x, d.y);
      if (inside(px, py)) {
        this.drawDen(px, py, s);
        shown = true;
      }
      const dd = Math.hypot(d.x - me.x, d.y - me.y);
      if (dd < nd) { nd = dd; nearest = d; }
    }
    if (nearest && !shown) {
      const [ex, ey, angle] = this.edgePoint(...toMap(nearest.x, nearest.y), size, 16 * s);
      this.arrow(ex, ey, angle, '#c0283c', s);
      const c = size / 2;
      const ly = ey > c ? ey - 12 * s : ey + 20 * s;
      this.label(`🕸 Ổ nhện ~${Math.round(nd / 100) * 100}`, Math.max(50 * s, Math.min(size - 50 * s, ex)), ly, 11 * s, '#ffb0a0');
    }

    // Quái nguy hiểm ở gần
    ctx.fillStyle = '#e04a3a';
    for (const m of scene.mobs.values()) {
      if (!HOSTILE.has(m.type)) continue;
      const [px, py] = toMap(m.x, m.y);
      if (!inside(px, py)) continue;
      ctx.beginPath();
      ctx.arc(px, py, (BOSSES.has(m.type) ? 6 : 2.5) * s, 0, Math.PI * 2);
      ctx.fill();
    }

    // Người chơi: người khác trước, mình vẽ sau cùng để nằm trên
    const list = [...scene.players.values()].sort((a, b) => (a === me) - (b === me));
    for (const pl of list) {
      const info = scene.roster.get(pl.id) ?? { name: '...', color: 0xffffff };
      const color = css(info.color);
      const isMe = pl === me;
      let [px, py] = toMap(pl.x, pl.y);

      if (!inside(px, py)) {
        // Ở ngoài khung: mũi tên chỉ hướng ở mép bản đồ
        const c = size / 2;
        let angle;
        [px, py, angle] = this.edgePoint(px, py, size, 14 * s);
        this.arrow(px, py, angle, color, s);
        const ly = py > c ? py - 12 * s : py + 18 * s;
        this.label(info.name, Math.max(30 * s, Math.min(size - 30 * s, px)), ly, 11 * s, '#fff');
        continue;
      }

      if (pl.dead) {
        this.label('👻', px, py + 5 * s, 14 * s, '#fff');
      } else {
        if (isMe) {
          // Vòng sáng nhấp nháy quanh vị trí của mình
          const pulse = (scene.time.now % 1400) / 1400;
          ctx.strokeStyle = `rgba(255, 255, 255, ${1 - pulse})`;
          ctx.lineWidth = 2 * s;
          ctx.beginPath();
          ctx.arc(px, py, (6 + pulse * 10) * s, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = color;
        ctx.strokeStyle = isMe ? '#fff' : '#000';
        ctx.lineWidth = (isMe ? 2.5 : 1.5) * s;
        ctx.beginPath();
        ctx.arc(px, py, (isMe ? 6 : 5) * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      this.label(isMe ? `${info.name} (bạn)` : info.name, px, py - 9 * s, 11 * s, '#fff');
    }
  }

  label(text, x, y, px, color) {
    const ctx = this.ctx;
    ctx.font = `bold ${px}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = px / 4;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
}

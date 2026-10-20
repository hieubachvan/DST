// Trang thử nhân vật tự vẽ ghép mảnh (bản dev: http://localhost:5173/hero.html).
// Nạp các mảnh từ client/public/hero (cắt bằng: node tools/crop-hero.mjs), hiện nhân vật ở hai cỡ.
// WASD / phím mũi tên: đi theo 4 hướng; thả phím thì đứng thở. Space / J: đánh (bổ rìu / đấm, cầm giáo thì đâm).
// Nút đồ: đổi vũ khí, đội nón, mặc giáp.
import Phaser from 'phaser';
import { DirectionalRig, dirOf } from './directional.js';
import { HERO_RIGS, HERO_HEIGHT, equipHero } from './hero.js';
import { HERO_PARTS } from './hero-parts.js';

const PARTS_URL = `${import.meta.env.BASE_URL}hero/`;
const PLAYER_H = 68; // chiều cao nhân vật trong game (ART_HEIGHT.player trong GameScene)
const GAME_SCALE = PLAYER_H / HERO_HEIGHT;
const BIG_SCALE = 0.85;
const WALK_SPEED = 260; // tốc độ đi của nhân vật cỡ lớn trên trang thử (pixel / giây)
const DIR_NAMES = { right: 'Phải', left: 'Trái', down: 'Xuống', up: 'Lên' };
const ANIM_NAMES = { idle: 'Đứng thở', walk: 'Đi', chop: 'Bổ / đấm', stab: 'Đâm' };
const HANDS = [[null, 'Tay không'], ['axe', 'Rìu'], ['spear', 'Giáo']];
const Hero = (scene, x, y, scale) => new DirectionalRig(scene, HERO_RIGS, x, y, scale);

class Preview extends Phaser.Scene {
  constructor() { super('preview'); }

  preload() {
    for (const name of Object.keys(HERO_PARTS)) this.load.image(`hero_${name}`, `${PARTS_URL}${name}.png`);
    this.load.image('player', `${import.meta.env.BASE_URL}sprites/player_idle_right.png`);
  }

  create() {
    const { width, height } = this.scale;
    this.ground = height * 0.85;
    this.add.rectangle(0, this.ground, width * 2, 2, 0x000000, 0.25).setOrigin(0, 0.5);
    this.shadow = this.add.ellipse(0, 0, 150 * BIG_SCALE, 26 * BIG_SCALE, 0x000000, 0.25);
    this.big = Hero(this, width * 0.32, this.ground, BIG_SCALE);
    this.small = Hero(this, width * 0.8, this.ground, GAME_SCALE);
    // Nhân vật hiện tại trong game đứng cạnh để so cỡ
    if (this.textures.exists('player')) {
      const pl = this.add.image(width * 0.8 - 60, this.ground, 'player').setOrigin(0.5, 1);
      pl.setScale(PLAYER_H / pl.height);
      this.add.text(width * 0.8 - 30, this.ground + 12, 'cỡ trong game (bên trái: nhân vật cũ)', { fontSize: '12px', color: '#f2ead8' }).setOrigin(0.5, 0);
    }
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,J');
    this.gear = { hand: null, head: null, body: null };
    this.speed = 1;
    this.clock = 0;
    this.dir = 'down';
    this.anim = 'idle';
    this.setGear({});
  }

  // Đổi đồ cho cả hai nhân vật và tô nút đồ đang mặc.
  setGear(change) {
    Object.assign(this.gear, change);
    for (const h of [this.big, this.small]) equipHero(h, this.gear);
    document.querySelectorAll('#gear button').forEach((el) => {
      const [slot, id] = el.dataset.gear.split(':');
      el.classList.toggle('on', (this.gear[slot] ?? '') === id);
    });
    this.apply();
  }

  get attackAnim() { return this.gear.hand === 'spear' ? 'stab' : 'chop'; }

  // Đặt hướng / hoạt ảnh cho cả hai nhân vật và tô nút đang chọn.
  apply() {
    for (const h of [this.big, this.small]) h.set(this.dir, this.anim, this.clock);
    document.querySelectorAll('#anims button').forEach((el) => el.classList.toggle('on', el.dataset.anim === this.anim));
    document.querySelectorAll('#dirs button').forEach((el) => el.classList.toggle('on', el.dataset.dir === this.dir));
  }

  setAnim(name) { this.anim = name; this.apply(); }
  setDir(dir) { this.dir = dir; this.apply(); }

  update(_time, delta) {
    this.clock += delta * this.speed;
    const k = this.keys;
    const dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const dy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    const attacking = k.SPACE.isDown || k.J.isDown;
    if (attacking && !dx && !dy) {
      if (this.anim !== this.attackAnim) { this.anim = this.attackAnim; this.apply(); }
      this.held = true;
    } else if (dx || dy) {
      this.dir = dirOf(dx, dy, this.dir); // cùng cách chọn hướng với game
      this.anim = 'walk';
      const len = Math.hypot(dx, dy), step = (WALK_SPEED * delta * this.speed) / 1000;
      const { width, height } = this.scale;
      const x = Phaser.Math.Clamp(this.big.x + (dx / len) * step, 100, width * 0.62);
      const y = Phaser.Math.Clamp(this.big.y + (dy / len) * step, HERO_HEIGHT * BIG_SCALE + 50, height - 10);
      this.big.moveTo(x, y);
      this.apply();
      this.moving = true;
    } else if (this.moving || this.held) {
      this.moving = this.held = false;
      this.anim = 'idle';
      this.apply();
    }
    this.shadow.setPosition(this.big.x, this.big.y).setDepth(-1);
    this.big.update(this.clock);
    this.small.update(this.clock);
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO, backgroundColor: '#5f8446',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
});
game.scene.add('preview', Preview, true);
const scene = () => game.scene.getScene('preview');

const addButtons = (boxId, items, attr, onClick) => {
  const box = document.getElementById(boxId);
  for (const [value, label] of items) {
    const b = document.createElement('button');
    b.textContent = label;
    b.dataset[attr] = value;
    b.onclick = () => { onClick(value); b.blur(); }; // bỏ focus để phím WASD điều khiển nhân vật
    box.appendChild(b);
  }
};
addButtons('dirs', Object.entries(DIR_NAMES), 'dir', (d) => scene().setDir(d));
addButtons('anims', Object.entries(ANIM_NAMES), 'anim', (a) => scene().setAnim(a));
addButtons('gear', HANDS.map(([id, label]) => [`hand:${id ?? ''}`, label]), 'gear', (v) => scene().setGear({ hand: v.split(':')[1] || null }));
addButtons('gear', [['head:helmet', 'Nón']], 'gear', () => scene().setGear({ head: scene().gear.head ? null : 'helmet' }));
addButtons('gear', [['body:logsuit', 'Giáp']], 'gear', () => scene().setGear({ body: scene().gear.body ? null : 'logsuit' }));
document.getElementById('joints').onchange = (e) => { scene().big.showJoints(e.target.checked); e.target.blur(); };
document.getElementById('speed').oninput = (e) => {
  scene().speed = Number(e.target.value);
  document.getElementById('speedv').textContent = `${e.target.value}×`;
};
window.heroScene = scene; // chỉnh thử trong Console: heroScene().big.rigs.front.byName.head.y = -5

// Trang thử hoạt ảnh ghép mảnh (chỉ có ở bản dev: http://localhost:5173/rig.html).
// Nạp các mảnh từ client/public/rig/bearger (tạo bằng: node tools/extract-rig.mjs), hiện Bearger ở hai cỡ.
// WASD / phím mũi tên: cho con gấu cỡ lớn đi lại, tự đổi hướng và chuyển đi / đứng.
import Phaser from 'phaser';
import { DirectionalRig, dirOf } from './directional.js';
import { BEARGER_RIGS } from './bearger.js';

const PARTS_URL = `${import.meta.env.BASE_URL}rig/bearger/`;
const GAME_SCALE = 0.42; // cỡ Bearger trong game (BEARGER_RIG_SCALE trong GameScene)
const WALK_SPEED = 150; // tốc độ đi của Bearger trong game (pixel / giây)
const DIR_NAMES = { right: 'Phải', left: 'Trái', down: 'Xuống', up: 'Lên' };
const Bearger = (scene, x, y, scale) => new DirectionalRig(scene, BEARGER_RIGS, x, y, scale);

class Preview extends Phaser.Scene {
  constructor() { super('preview'); }

  init({ parts }) { this.parts = parts; }

  preload() {
    for (const key of Object.keys(this.parts)) this.load.image(`bearger_${key}`, `${PARTS_URL}${key}.png`);
    this.load.image('player', `${import.meta.env.BASE_URL}sprites/player_idle_right.png`);
  }

  create() {
    const { width, height } = this.scale;
    this.ground = height * 0.8;
    this.add.rectangle(0, this.ground, width * 2, 2, 0x000000, 0.25).setOrigin(0, 0.5);
    this.big = Bearger(this, width * 0.32, this.ground, 0.9);
    this.small = Bearger(this, width * 0.78, this.ground, GAME_SCALE);
    if (this.textures.exists('player')) {
      const pl = this.add.image(width * 0.78 - 110, this.ground, 'player').setOrigin(0.5, 1);
      pl.setScale(68 / pl.height);
    }
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
    this.speed = 1;
    this.clock = 0;
    this.dir = 'right';
    this.anim = 'idle';
    this.apply();
  }

  // Đặt hướng / hoạt ảnh cho cả hai con và tô nút đang chọn.
  apply() {
    for (const b of [this.big, this.small]) b.set(this.dir, this.anim, this.clock);
    document.querySelectorAll('#anims button').forEach((el) => el.classList.toggle('on', el.dataset.anim === this.anim));
    document.querySelectorAll('#dirs button').forEach((el) => el.classList.toggle('on', el.dataset.dir === this.dir));
  }

  setAnim(name) { this.anim = name; this.apply(); }
  setDir(dir) { this.dir = dir; this.apply(); }

  update(_time, delta) {
    this.clock += delta * this.speed;
    // Điều khiển bằng bàn phím: hướng theo phím vừa bấm, có bấm thì đi, thả ra thì đứng.
    const k = this.keys;
    const dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const dy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (dx || dy) {
      this.dir = dirOf(dx, dy, this.dir); // cùng cách chọn hướng với game
      this.anim = 'walk';
      const len = Math.hypot(dx, dy), step = (WALK_SPEED * delta * this.speed) / 1000;
      const { width, height } = this.scale;
      const x = Phaser.Math.Clamp(this.big.x + (dx / len) * step, 120, width * 0.6);
      const y = Phaser.Math.Clamp(this.big.y + (dy / len) * step, 330, height - 10);
      this.big.moveTo(x, y);
      this.apply();
      this.moving = true;
    } else if (this.moving) {
      this.moving = false;
      this.anim = 'idle';
      this.apply();
    }
    this.big.update(this.clock);
    this.small.update(this.clock);
  }
}

const res = await fetch(`${PARTS_URL}parts.json`).catch(() => null);
if (!res?.ok) {
  document.body.insertAdjacentHTML('beforeend', '<p style="padding:60px 20px">Chưa có mảnh hình. Chạy <code>node tools/extract-rig.mjs</code> (cần Bearger.png ở thư mục gốc).</p>');
} else {
  const parts = await res.json();
  const game = new Phaser.Game({
    type: Phaser.AUTO, backgroundColor: '#5f8446',
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  });
  game.scene.add('preview', Preview, true, { parts });
  const scene = () => game.scene.getScene('preview');

  const addButtons = (boxId, items, attr, onClick) => {
    const box = document.getElementById(boxId);
    for (const [value, label] of items) {
      const b = document.createElement('button');
      b.textContent = label;
      b.dataset[attr] = value;
      b.onclick = () => { onClick(value); b.blur(); }; // bỏ focus để phím mũi tên điều khiển gấu
      box.appendChild(b);
    }
  };
  addButtons('dirs', Object.entries(DIR_NAMES), 'dir', (d) => scene().setDir(d));
  addButtons('anims', Object.keys(BEARGER_RIGS.side.anims).map((a) => [a, a]), 'anim', (a) => scene().setAnim(a));
  document.getElementById('joints').onchange = (e) => { scene().big.showJoints(e.target.checked); scene().small.showJoints(e.target.checked); e.target.blur(); };
  document.getElementById('speed').oninput = (e) => {
    scene().speed = Number(e.target.value);
    document.getElementById('speedv').textContent = `${e.target.value}×`;
  };
  window.rigScene = scene; // để chỉnh thử trong Console: rigScene().big.rig.byName.head.x = 50
}

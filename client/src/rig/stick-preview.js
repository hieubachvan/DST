// Trang thử nhân vật ghép mảnh 4 hướng (bản dev: http://localhost:5173/stick.html): người que, lợn.
// Các nhân vật dùng chung khung xương / hoạt ảnh (biped.js) với 3 góc nhìn: ngang, thẳng, lưng; nút Nhân vật để đổi qua lại.
// Mảnh hình: client/public/stick (node tools/crop-stick.mjs), client/public/pig (node tools/crop-pig.mjs).
// WASD hoặc mũi tên: đi 4 hướng; giữ Shift: chạy; Space / J: chém (đang chạy thì vừa chạy vừa chém); thả phím: đứng thở.
import Phaser from 'phaser';
import { DirectionalRig, dirOf } from './directional.js';
import { equipWeapon, attackOf } from './biped.js';
import { STICK_RIGS, STICK_HEIGHT, STICK_IMAGES, makeStickTextures } from './stick.js';
import { PIG_RIGS, PIG_HEIGHT, PIG_IMAGES } from './pig.js';

// rigs: { side, front, back }, height: chiều cao (pixel ảnh gốc) để quy ra cỡ hiển thị,
// images: [texture, đường dẫn trong public]
const CHARACTERS = {
  stick: { label: 'Người que', rigs: STICK_RIGS, height: STICK_HEIGHT, images: STICK_IMAGES },
  pig: { label: 'Lợn', rigs: PIG_RIGS, height: PIG_HEIGHT, images: PIG_IMAGES },
};
const DIR_NAMES = { right: 'Phải', left: 'Trái', down: 'Xuống', up: 'Lên' };
const PLAYER_H = 68; // chiều cao nhân vật trong game (ART_HEIGHT.player trong GameScene)
const BIG_H = 375; // chiều cao nhân vật cỡ lớn trên trang thử (pixel màn hình)
const WALK_SPEED = 200, RUN_SPEED = 420; // pixel / giây ở cỡ lớn
const ANIM_NAMES = { idle: 'Đứng thở', walk: 'Đi', run: 'Chạy', attack: 'Chém', run_attack: 'Chạy + chém' };
const WEAPON_NAMES = [[null, 'Tay không'], ['sword', 'Kiếm'], ['axe', 'Rìu'], ['mace', 'Chùy']];

class Preview extends Phaser.Scene {
  constructor() { super('preview'); }

  preload() {
    for (const c of Object.values(CHARACTERS)) for (const [key, file] of c.images) this.load.image(key, `${import.meta.env.BASE_URL}${file}`);
  }

  create() {
    const { width, height } = this.scale;
    makeStickTextures(this);
    this.ground = height * 0.85;
    this.add.rectangle(0, this.ground, width * 2, 2, 0x000000, 0.25).setOrigin(0, 0.5);
    this.shadow = this.add.ellipse(0, this.ground, 130, 18, 0x000000, 0.18).setDepth(-1);
    // mỗi nhân vật một cặp rig (cỡ lớn / cỡ trong game), chỉ hiện nhân vật đang chọn
    this.rigs = Object.fromEntries(Object.entries(CHARACTERS).map(([id, c]) => [id, {
      big: new DirectionalRig(this, c.rigs, width * 0.35, this.ground, BIG_H / c.height).setVisible(false),
      small: new DirectionalRig(this, c.rigs, width * 0.82, this.ground, PLAYER_H / c.height).setVisible(false),
    }]));
    this.add.text(width * 0.82, this.ground + 12, 'cỡ trong game', { fontSize: '12px', color: '#3a3226' }).setOrigin(0.5, 0);
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,SPACE,J');
    this.weapon = 'sword';
    this.anim = 'idle';
    this.dir = 'down';
    this.speed = 1;
    this.clock = 0;
    this.joints = false;
    this.setCharacter('stick');
  }

  get big() { return this.rigs[this.char].big; }
  get small() { return this.rigs[this.char].small; }
  get pair() { return [this.big, this.small]; }

  // Đổi nhân vật: nhân vật mới đứng đúng chỗ nhân vật cũ, giữ vũ khí / hoạt ảnh / hướng.
  setCharacter(id) {
    const at = this.char ? [this.big.x, this.big.y] : null;
    if (this.char) for (const r of this.pair) { r.setVisible(false); r.showJoints(false); }
    this.char = id;
    for (const r of this.pair) r.anim = null; // để set() bắt đầu lại hoạt ảnh (và hiện rig của hướng đang quay)
    if (at) this.big.moveTo(...at);
    this.big.showJoints(this.joints);
    document.querySelectorAll('#chars button').forEach((el) => el.classList.toggle('on', el.dataset.char === id));
    this.setWeapon(this.weapon);
  }

  setWeapon(id) {
    this.weapon = id;
    for (const r of this.pair) equipWeapon(r, id);
    document.querySelectorAll('#weapons button').forEach((el) => el.classList.toggle('on', (el.dataset.weapon || null) === id));
    this.apply();
  }

  // 'attack' / 'run_attack' đổi thành nhát hợp với vũ khí (chém / bổ).
  get rigAnim() {
    if (this.anim === 'attack') return attackOf(this.weapon, false);
    if (this.anim === 'run_attack') return attackOf(this.weapon, true);
    return this.anim;
  }

  apply() {
    for (const r of this.pair) r.set(this.dir, this.rigAnim, this.clock);
    document.querySelectorAll('#anims button').forEach((el) => el.classList.toggle('on', el.dataset.anim === this.anim));
    document.querySelectorAll('#dirs button').forEach((el) => el.classList.toggle('on', el.dataset.dir === this.dir));
  }

  setAnim(name) { this.anim = name; this.apply(); }
  setDir(dir) { this.dir = dir; this.apply(); }
  showJoints(on) { this.joints = on; this.big.showJoints(on); }

  update(_time, delta) {
    this.clock += delta * this.speed;
    const k = this.keys;
    const dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const dy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    const running = k.SHIFT.isDown;
    const attacking = k.SPACE.isDown || k.J.isDown;
    const moving = dx || dy;
    if (moving || attacking) {
      const anim = moving ? (attacking ? 'run_attack' : running ? 'run' : 'walk') : 'attack';
      if (moving) {
        this.dir = dirOf(dx, dy, this.dir); // cùng cách chọn hướng với game
        const len = Math.hypot(dx, dy);
        const step = (((attacking || running) ? RUN_SPEED : WALK_SPEED) * delta * this.speed) / 1000;
        const { width, height } = this.scale;
        this.big.moveTo(
          Phaser.Math.Clamp(this.big.x + (dx / len) * step, 100, width * 0.66),
          Phaser.Math.Clamp(this.big.y + (dy / len) * step, BIG_H + 60, height - 10));
      }
      this.anim = anim;
      this.apply(); // set() bỏ qua nếu hướng / hoạt ảnh không đổi
      this.held = true;
    } else if (this.held) {
      this.held = false;
      this.anim = 'idle';
      this.apply();
    }
    this.shadow.setPosition(this.big.x, this.big.y);
    this.big.update(this.clock);
    this.small.update(this.clock);
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO, backgroundColor: '#d9d2c0',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
});
game.scene.add('preview', Preview, true);
const scene = () => game.scene.getScene('preview');

const addButtons = (boxId, items, attr, onClick) => {
  const box = document.getElementById(boxId);
  for (const [value, label] of items) {
    const b = document.createElement('button');
    b.textContent = label;
    b.dataset[attr] = value ?? '';
    b.onclick = () => { onClick(value); b.blur(); }; // bỏ focus để phím điều khiển nhân vật
    box.appendChild(b);
  }
};
addButtons('chars', Object.entries(CHARACTERS).map(([id, c]) => [id, c.label]), 'char', (c) => scene().setCharacter(c));
addButtons('dirs', Object.entries(DIR_NAMES), 'dir', (d) => scene().setDir(d));
addButtons('anims', Object.entries(ANIM_NAMES), 'anim', (a) => scene().setAnim(a));
addButtons('weapons', WEAPON_NAMES, 'weapon', (w) => scene().setWeapon(w));
document.getElementById('joints').onchange = (e) => { scene().showJoints(e.target.checked); e.target.blur(); };
document.getElementById('speed').oninput = (e) => {
  scene().speed = Number(e.target.value);
  document.getElementById('speedv').textContent = `${e.target.value}×`;
};
window.stickScene = scene; // chỉnh thử trong Console: stickScene().big.byName.upper_f.y = -140

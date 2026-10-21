// Nhân vật ghép mảnh nhiều hướng: một rig cho mỗi góc nhìn (side / front / back), chỉ hiện rig của hướng
// đang quay. Hướng trái dùng rig side lật ngang. Dùng chung cho game (GameScene) và trang thử (rig.html).
import { Rig } from './rig.js';

// Hướng -> [góc nhìn, lật ngang]
export const DIRS = { right: ['side', false], left: ['side', true], down: ['front', false], up: ['back', false] };

// Góc nhìn nào thiếu hoạt ảnh thì dùng hoạt ảnh thay thế, cuối cùng là đứng yên.
const FALLBACK = { charge: 'walk', slam: 'swipe', eat: 'idle', roar: 'idle', hit: 'idle', swipe: 'idle', walk: 'idle' };

// Chọn hướng theo vector (dx, dy): nghiêng về ngang thì trái / phải (nhìn ngang dễ đọc nhất), không thì lên / xuống.
export function dirOf(dx, dy, fallback = 'right') {
  if (!dx && !dy) return fallback;
  if (Math.abs(dx) >= Math.abs(dy) * 0.7) return dx < 0 ? 'left' : 'right';
  return dy > 0 ? 'down' : 'up';
}

// Như dirOf nhưng khó đổi hướng hơn: vector nằm gần ranh giới ngang / dọc thì giữ hướng cũ (prev), để vị trí bị
// làm tròn (server gửi số nguyên) hay đi chéo không làm nhân vật lật qua lật lại liên tục.
export function dirOfSticky(dx, dy, prev) {
  if (!dx && !dy) return prev;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const wasSide = prev === 'left' || prev === 'right';
  if (wasSide ? ax >= ay * 0.45 : ax >= ay * 1.1) {
    const side = dx < 0 ? 'left' : 'right';
    // Đổi trái <-> phải chỉ khi đi ngang rõ ràng; còn nhích ngược chút xíu thì giữ
    return wasSide && side !== prev && ax < ay * 0.8 ? prev : side;
  }
  return dy > 0 ? 'down' : 'up';
}

export class DirectionalRig {
  // rigs: { side, front, back } — định nghĩa rig (xem rig.js)
  constructor(scene, rigs, x, y, scale) {
    this.rigs = Object.fromEntries(Object.entries(rigs).map(([k, def]) => [k, new Rig(scene, def, x, y, scale).setVisible(false)]));
    this.dir = null;
    this.anim = null;
    this.set('right', 'idle', 0);
  }

  get rig() { return this.rigs[DIRS[this.dir][0]]; }
  get roots() { return Object.values(this.rigs).map((r) => r.root); }

  // Đổi hướng / hoạt ảnh. Chỉ đổi hướng (cùng hoạt ảnh) thì giữ nhịp, để bước chân không bị giật về đầu.
  set(dir, anim, time) {
    if (dir === this.dir && anim === this.anim) return;
    const sameAnim = anim === this.anim;
    const start = this.dir ? this.rig.animStart : time; // lần đầu (chưa có hướng) thì bắt đầu từ bây giờ
    for (const r of Object.values(this.rigs)) r.setVisible(false);
    this.dir = dir;
    this.anim = anim;
    const r = this.rig;
    r.flip = DIRS[dir][1];
    let a = anim;
    while (!r.def.anims[a] && a !== 'idle') a = FALLBACK[a] ?? 'idle';
    r.anim = a;
    r.animStart = sameAnim ? start : time;
    r.setVisible(true);
  }

  update(time) { this.rig.update(time); }
  moveTo(x, y) { for (const r of Object.values(this.rigs)) r.root.setPosition(x, y); }
  get x() { return this.rig.root.x; }
  get y() { return this.rig.root.y; }
  showJoints(on) { for (const r of Object.values(this.rigs)) r.showJoints(on); }
  // Ẩn / hiện cả nhân vật (hiện lại thì chỉ hiện rig của hướng đang quay).
  setVisible(on) {
    for (const r of Object.values(this.rigs)) r.setVisible(false);
    if (on) this.rig.setVisible(true);
    return this;
  }
  setTintFill(color) { for (const r of Object.values(this.rigs)) r.setTintFill(color); }
  setTint(color) { for (const r of Object.values(this.rigs)) r.setTint(color); }
  destroy() { for (const r of Object.values(this.rigs)) r.destroy(); }
  clearTint() { for (const r of Object.values(this.rigs)) r.clearTint(); }
}

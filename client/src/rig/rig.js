// Nhân vật ghép mảnh (rig): mỗi xương nằm ở khớp nối so với xương cha và có góc xoay riêng;
// bộ phận (ảnh) gắn vào xương theo điểm neo. Xoay vai thì cả cánh tay lẫn móng xoay theo.
//
// Vị trí mọi xương được tính ra tọa độ chung (động học thuận) rồi vẽ ảnh trên một lớp phẳng,
// sắp theo z của từng xương, nên một xương con vẫn nằm sau xương cha được (vd. tay phía xa nằm sau thân).
//
// Định nghĩa (def):
//   prefix: tiền tố tên texture, vd 'bearger_p' -> ảnh 'bearger_p12'
//   bones: [{ name, parent?, x, y, rot?, part?, pivot?: [ox, oy], z?, sx?, sy?, flip?, tint? }] — cha khai báo trước con.
//          x, y: vị trí khớp trong hệ tọa độ của xương cha (pixel ảnh gốc). rot: độ.
//          part: số thứ tự mảnh; không có thì là xương ẩn (chỉ để nối).
//          flip: lật ngang riêng ảnh của xương này (tay / chân bên kia), không ảnh hưởng xương con.
//          tint: nhuộm màu ảnh (vd. 0xb0b0b0 cho tay / chân phía xa tối hơn).
//   anims: { tên: (t, pose) => void } — t giây kể từ lúc bắt đầu; ghi đè pose[bone] = { r, x, y, sx, sy, part, z }
//          (r cộng thêm vào rot gốc, x / y cộng thêm vào vị trí khớp, sx / sy nhân với tỉ lệ gốc, part thay ảnh,
//          z thay lớp, vd. đưa cánh tay ra trước thân lúc vung).

const RAD = Math.PI / 180;

export class Rig {
  constructor(scene, def, x = 0, y = 0, scale = 1) {
    this.scene = scene;
    this.def = def;
    this.root = scene.add.container(x, y).setScale(scale);
    this.bones = def.bones.map((b) => ({ ...b, rot: b.rot ?? 0, sx: b.sx ?? 1, sy: b.sy ?? 1, z: b.z ?? 0 }));
    this.byName = Object.fromEntries(this.bones.map((b) => [b.name, b]));
    for (const b of this.bones) {
      if (b.parent && !this.byName[b.parent]) throw new Error(`Rig: xương "${b.name}" có cha "${b.parent}" không tồn tại`);
      if (b.part === undefined) continue;
      // lật ảnh thì lật cả điểm neo theo, để khớp vẫn nằm đúng chỗ trên hình (vd. gốc móng)
      const [ox, oy] = b.pivot ?? [0.5, 0.5];
      b.img = scene.add.image(0, 0, `${def.prefix}${b.part}`).setOrigin(b.flip ? 1 - ox : ox, oy).setDepth(b.z).setFlipX(!!b.flip);
      if (b.tint) b.img.setTint(b.tint);
      this.root.add(b.img);
    }
    this.root.sort('depth'); // sắp lớp một lần theo z (cùng z thì theo thứ tự khai báo)
    this.anim = null;
    this.animStart = 0;
    this.flip = false;
    this.debug = null;
  }

  play(name, time) {
    if (this.anim === name) return;
    this.anim = name;
    this.animStart = time;
  }

  // Tính tư thế ở thời điểm `time` (ms) và đặt lại mọi ảnh.
  update(time) {
    const pose = {};
    const fn = this.def.anims[this.anim];
    if (fn) fn((time - this.animStart) / 1000, pose);
    const world = {};
    let resort = false;
    for (const b of this.bones) {
      const p = pose[b.name] ?? {};
      const lx = b.x + (p.x ?? 0), ly = b.y + (p.y ?? 0);
      const lr = (b.rot + (p.r ?? 0)) * RAD;
      const lsx = b.sx * (p.sx ?? 1), lsy = b.sy * (p.sy ?? 1);
      const par = b.parent ? world[b.parent] : { x: 0, y: 0, r: 0, sx: 1, sy: 1 };
      // vị trí khớp theo hệ của cha (đã xoay + co giãn theo cha)
      const cx = lx * par.sx, cy = ly * par.sy;
      const w = {
        x: par.x + cx * Math.cos(par.r) - cy * Math.sin(par.r),
        y: par.y + cx * Math.sin(par.r) + cy * Math.cos(par.r),
        r: par.r + lr, sx: par.sx * lsx, sy: par.sy * lsy,
      };
      world[b.name] = w;
      if (!b.img) continue;
      const key = `${this.def.prefix}${p.part ?? b.part}`;
      if (b.img.texture.key !== key) b.img.setTexture(key);
      b.img.setPosition(w.x, w.y).setRotation(w.r).setScale(w.sx, w.sy);
      const z = p.z ?? b.z;
      if (b.img.depth !== z) { b.img.setDepth(z); resort = true; }
    }
    if (resort) this.root.sort('depth');
    this.world = world;
    this.root.scaleX = Math.abs(this.root.scaleX) * (this.flip ? -1 : 1);
    if (this.debug) this.drawDebug();
  }

  // Hiện khớp (chấm đỏ) và đường nối với xương cha, để chỉnh vị trí.
  showJoints(on) {
    if (on && !this.debug) {
      this.debug = this.scene.add.graphics();
      this.root.add(this.debug);
      this.debug.setDepth(1e6);
    } else if (!on && this.debug) {
      this.debug.destroy();
      this.debug = null;
    }
  }

  drawDebug() {
    const g = this.debug.clear();
    for (const b of this.bones) {
      const w = this.world[b.name];
      if (b.parent) {
        const p = this.world[b.parent];
        g.lineStyle(2, 0xffff00, 0.8).lineBetween(p.x, p.y, w.x, w.y);
      }
      g.fillStyle(0xff2020, 1).fillCircle(w.x, w.y, 5);
    }
  }

  // Thay ảnh gốc của một xương (đổi đồ: tay cầm rìu, đầu đội nón...), z: đổi lớp nếu cần. Ảnh mới phải cùng điểm neo.
  setPart(name, part, z) {
    const b = this.byName[name];
    if (!b?.img) return;
    b.part = part;
    if (z !== undefined) b.z = z;
  }

  setVisible(on) { this.root.setVisible(on); return this; }
  setTintFill(color) { for (const b of this.bones) b.img?.setTintFill(color); }
  setTint(color) { for (const b of this.bones) b.img?.setTint(color); }
  clearTint() { for (const b of this.bones) if (b.img) { b.img.clearTint(); if (b.tint) b.img.setTint(b.tint); } }

  destroy() { this.root.destroy(); }
}

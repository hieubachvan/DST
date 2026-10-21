// Người que (vẽ tay trong testaction.png) trên khung xương hai chân dùng chung (biped.js), 3 góc nhìn.
// Đầu, thân và vũ khí là ảnh cắt từ hình vẽ (node tools/crop-stick.mjs -> client/public/stick/<tên>.png);
// tay / chân tự vẽ bằng nét đen (makeStickTextures). Tay / chân phía xa vẽ màu xám cho có chiều sâu;
// tay / chân phía gần đen liền với thân (OUTLINE > 0 thì thêm viền trắng để tách khỏi thân).
import { STICK_PARTS } from './stick-parts.js';
import { buildViews, WEAPONS } from './biped.js';

export const STICK_HEIGHT = 500; // từ mặt đất tới đỉnh đầu (pixel ảnh gốc)
export const STICK_IMAGES = ['head', 'torso', ...WEAPONS].map((n) => [`stick_${n}`, `stick/${n}.png`]);

const LIMB_W = 22; // độ dày nét tay / chân
const OUTLINE = 0; // viền trắng của tay / chân phía gần (0: không viền, các khớp nối liền mạch)
const UPPER = 78, FORE = 72; // bắp tay, cẳng tay
const THIGH = 92, SHIN = 92; // đùi, cẳng chân
const TORSO = STICK_PARTS.torso, HEAD = STICK_PARTS.head;
const NECK_Y = TORSO.neck[1] - TORSO.hip[1]; // đỉnh thân, tính từ eo
const HEAD_GAP = 16; // khe giữa đầu và thân như hình vẽ
const NEAR = 0x000000, FAR = 0x5a5a5a;

// Ảnh đoạn tay / chân: viên thuốc dài len (khớp đầu ở tâm nửa tròn trên, khớp cuối ở tâm nửa tròn dưới).
const segSize = (len, o) => [LIMB_W + 2 * o, len + LIMB_W + 2 * o];
const segPivot = (len, o) => [0.5, (o + LIMB_W / 2) / segSize(len, o)[1]];
const FOOT = { w: 54, h: 28, ax: 16, ay: 10 }; // bàn chân hình bầu dục, cổ chân ở (ax, ay)
const footPivot = (o) => [(o + FOOT.ax) / (FOOT.w + 2 * o), (o + FOOT.ay) / (FOOT.h + 2 * o)];
const FIST_R = 14;

// Vẽ ảnh tay / chân (gọi một lần trong create() trước khi dựng rig).
export function makeStickTextures(scene) {
  const draw = (key, w, h, fn) => {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ add: false });
    fn(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };
  for (const [suffix, color, o] of [['', NEAR, OUTLINE], ['_far', FAR, 0]]) {
    for (const [name, len] of [['upper', UPPER], ['fore', FORE], ['thigh', THIGH], ['shin', SHIN]]) {
      const [w, h] = segSize(len, o);
      draw(`stick_${name}${suffix}`, w, h, (g) => {
        if (o) g.fillStyle(0xffffff).fillRoundedRect(0, 0, w, h, w / 2);
        g.fillStyle(color).fillRoundedRect(o, o, LIMB_W, len + LIMB_W, LIMB_W / 2);
      });
    }
    const fw = FOOT.w + 2 * o, fh = FOOT.h + 2 * o;
    draw(`stick_foot${suffix}`, fw, fh, (g) => {
      if (o) g.fillStyle(0xffffff).fillEllipse(fw / 2, fh / 2, fw, fh);
      g.fillStyle(color).fillEllipse(fw / 2, fh / 2, FOOT.w, FOOT.h);
    });
    const d = (FIST_R + o) * 2;
    draw(`stick_fist${suffix}`, d, d, (g) => {
      if (o) g.fillStyle(0xffffff).fillCircle(d / 2, d / 2, FIST_R + o);
      g.fillStyle(color).fillCircle(d / 2, d / 2, FIST_R);
    });
  }
}

// Ảnh tay / chân một phía: near = phía gần (đen), không thì phía xa (xám, không viền).
const limbs = (near) => {
  const s = near ? '' : '_far', o = near ? OUTLINE : 0;
  return {
    upper: [`stick_upper${s}`, segPivot(UPPER, o)],
    fore: [`stick_fore${s}`, segPivot(FORE, o)],
    hand: [`stick_fist${s}`, [0.5, 0.5]],
    thigh: [`stick_thigh${s}`, segPivot(THIGH, o)],
    shin: [`stick_shin${s}`, segPivot(SHIN, o)],
    foot: [`stick_foot${s}`, footPivot(o)],
  };
};

const BODY = [
  { name: 'torso', parent: 'chest', x: 0, y: 0, part: 'stick_torso', pivot: [TORSO.hip[0] / TORSO.w, TORSO.hip[1] / TORSO.h], z: 2 },
  { name: 'neck', parent: 'chest', x: 0, y: NECK_Y },
  { name: 'head', parent: 'neck', x: 0, y: -HEAD_GAP, part: 'stick_head', pivot: [HEAD.neck[0] / HEAD.w, HEAD.neck[1] / HEAD.h], z: 3 },
];
// Nhìn thẳng / nhìn lưng: cùng hình đầu / thân (người que không có mặt), tay mọc hai bên vai, hai chân tách ra.
const FACING = { body: BODY, shoulder: [-(TORSO.w / 2 + 8), NECK_Y + 28], legX: 24, limbs: limbs(true), footSx: 0.6 };

// Ba góc nhìn cho DirectionalRig (side / front / back).
export const STICK_RIGS = buildViews({
  upper: UPPER, fore: FORE, thigh: THIGH, shin: SHIN,
  ankleY: -13, // cổ chân cao hơn mặt đất nửa bàn chân
  legTop: -6, // khớp hông, hơi lấn vào đáy thân
  legX: [0, 0],
  shoulder: [0, NECK_Y + 28],
  neckY: NECK_Y,
  limbs: { near: limbs(true), far: limbs(false) },
  body: BODY,
  front: FACING,
  back: FACING,
  weaponScale: 0.85,
});

// Lợn (bảng thiết kế lon.png) trên khung xương hai chân dùng chung với người que (biped.js), 3 góc nhìn.
// Mảnh hình cắt bằng node tools/crop-pig.mjs -> client/public/pig/<tên>.png: thân nghiêng / nhìn thẳng / nhìn lưng
// (đầu liền thân, tay dính đã xóa), tay / chân cắt đôi ở khuỷu / gối, dùng chung cho cả 3 góc nhìn.
// Nhìn ngang thì tay / chân phía xa nhuộm tối. Chân lợn ngắn và nằm sau thân: váy che đầu đùi.
import { PIG_PARTS } from './pig-parts.js';
import { buildViews } from './biped.js';

export const PIG_IMAGES = Object.keys(PIG_PARTS).map((n) => [`pig_${n}`, `pig/${n}.png`]);

const P = PIG_PARTS;
const pivot = (name) => [P[name].joint[0] / P[name].w, P[name].joint[1] / P[name].h];
const limb = (name) => [`pig_${name}`, pivot(name)];
// Ảnh thân -> xương torso neo ở eo; vai tính từ eo.
const torso = (name) => ({ name: 'torso', parent: 'chest', x: 0, y: 0, part: `pig_${name}`, pivot: [P[name].hip[0] / P[name].w, P[name].hip[1] / P[name].h], z: 2 });
const shoulder = (name) => [P[name].shoulder[0] - P[name].hip[0], P[name].shoulder[1] - P[name].hip[1]];

const ANKLE_Y = -8; // cổ chân cao hơn mặt đất nửa móng
export const PIG_HEIGHT = P.body.hip[1] + P.thigh.len + P.shin.len - ANKLE_Y; // đỉnh lông tới mặt đất, để tính tỉ lệ

const LIMBS = { upper: limb('upper'), fore: limb('fore'), thigh: limb('thigh'), shin: limb('shin') };
const facing = (name) => ({ body: [torso(name)], shoulder: shoulder(name), legX: 28, limbs: LIMBS });

export const PIG_RIGS = buildViews({
  upper: P.upper.len, fore: P.fore.len, thigh: P.thigh.len, shin: P.shin.len,
  ankleY: ANKLE_Y,
  legTop: 0,
  legX: [-29, 24], // nhìn ngang: chân xa lùi sau, chân gần lệch trước
  shoulder: shoulder('body'),
  farShoulderX: -14,
  neckY: -P.body.hip[1],
  limbs: { near: LIMBS, far: { ...LIMBS, tint: 0x9c8c8c } },
  body: [torso('body')],
  front: facing('body_front'),
  back: facing('body_back'),
  legZ: 1.5, // sau thân: váy che đầu đùi
  weaponScale: 0.38,
  lean: 0.6, // thân to nặng, nghiêng ít
});

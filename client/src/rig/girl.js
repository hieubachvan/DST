// Cô bé (bảng thiết kế girl.jpeg) trên khung xương hai chân dùng chung với người que / lợn (biped.js), 3 góc nhìn.
// Mảnh hình cắt bằng node tools/crop-girl.mjs -> client/public/girl/<tên>.png: đầu nhìn thẳng (3 nét mặt) / lưng / nghiêng,
// váy dùng chung cho cả 3 góc nhìn (nhìn ngang thì co hẹp lại), tay / chân hai đoạn dùng chung cho cả 3 góc nhìn.
// Nhìn ngang thì tay / chân phía xa nhuộm tối. Chân nằm sau váy: gấu váy che đầu đùi.
import { GIRL_PARTS } from './girl-parts.js';
import { buildViews } from './biped.js';

export const GIRL_IMAGES = Object.keys(GIRL_PARTS).map((n) => [`girl_${n}`, `girl/${n}.png`]);
// Nét mặt khi nhìn thẳng: [tên mảnh, nhãn]
export const GIRL_FACES = [['head', 'Bình thường'], ['head_sad', 'Buồn'], ['head_angry', 'Giận']];

const P = GIRL_PARTS, D = P.dress;
const limb = (name) => [`girl_${name}`, [P[name].joint[0] / P[name].w, P[name].joint[1] / P[name].h]];
const headPivot = (name) => [P[name].neck[0] / P[name].w, P[name].neck[1] / P[name].h];

const ANKLE_Y = -21; // cổ chân cao hơn mặt đất (đế giày)
const NECK_Y = D.neck[1] - D.hip[1]; // đỉnh váy, tính từ eo
const HEAD_DROP = 18; // cằm lấn xuống đỉnh váy
const SIDE_SX = 0.82; // nhìn ngang: váy hẹp lại
export const GIRL_HEIGHT = P.thigh.len + P.shin.len - ANKLE_Y - NECK_Y - HEAD_DROP + P.head.neck[1]; // đỉnh nơ tới mặt đất

// Thân: váy neo ở eo, đầu gắn ở đỉnh váy.
const body = (head, sx = 1) => [
  { name: 'torso', parent: 'chest', x: 0, y: 0, part: 'girl_dress', pivot: [D.hip[0] / D.w, D.hip[1] / D.h], sx, z: 2 },
  { name: 'neck', parent: 'chest', x: 0, y: NECK_Y },
  { name: 'head', parent: 'neck', x: 0, y: HEAD_DROP, part: `girl_${head}`, pivot: headPivot(head), z: 3 },
];

const LIMBS = { upper: limb('upper'), fore: limb('fore'), thigh: limb('thigh'), shin: limb('shin') };
const facing = (head) => ({ body: body(head), shoulder: [D.shoulder[0] - D.hip[0], D.shoulder[1] - D.hip[1]], legX: 45, limbs: LIMBS });

export const GIRL_RIGS = buildViews({
  upper: P.upper.len, fore: P.fore.len, thigh: P.thigh.len, shin: P.shin.len,
  ankleY: ANKLE_Y,
  legTop: 0,
  legX: [-12, 12],
  shoulder: [(D.shoulderSide[0] - D.hip[0]) * SIDE_SX, D.shoulderSide[1] - D.hip[1]],
  farShoulderX: -10,
  neckY: NECK_Y,
  limbs: { near: LIMBS, far: { ...LIMBS, tint: 0x9c9c9c } },
  body: body('head_side', SIDE_SX),
  front: facing('head'),
  back: facing('head_back'),
  legZ: 1.5, // sau váy: gấu váy che đầu đùi
  weaponScale: 0.75,
  lean: 0.8,
});

// Đổi nét mặt (tên trong GIRL_FACES) cho rig nhìn thẳng. rig: DirectionalRig dựng từ GIRL_RIGS.
export function setGirlFace(rig, name) {
  const head = rig.rigs.front.byName.head;
  head.part = `girl_${name}`;
  head.img.setOrigin(...headPivot(name));
}

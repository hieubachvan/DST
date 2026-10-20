// Bearger ghép mảnh, 3 hướng: side (nhìn ngang, quay sang phải; game lật ngang cho bên trái),
// front (đi xuống, nhìn thẳng) và back (đi lên, thấy lưng).
// Số mảnh (part) là thứ tự trong client/public/rig/bearger/parts.json (node tools/extract-rig.mjs).
// Gốc (0, 0) ở mặt đất giữa hai chân; y âm là đi lên. Đơn vị: pixel ảnh gốc.
// Góc xoay theo chiều kim đồng hồ: với chi buông xuống, góc âm là vung sang phải.

export const BEARGER_HEADS = { normal: 31, angry: 15, roar: 12, stunned: 32, squint: 33 };
// Đầu nhìn thẳng (hướng front)
export const BEARGER_FRONT_HEADS = { normal: 28, angry: 27, roar: 11, stunned: 19 };

const sin = (t, hz, phase = 0) => Math.sin((t * hz + phase) * Math.PI * 2);
const ease = (x) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x)); // smoothstep 0..1
// Nội suy theo các mốc [thời điểm (giây), giá trị] cho hoạt ảnh một lần (cào, gầm...).
const keys = (t, ks) => {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    const [t1, v1] = ks[i], [t0, v0] = ks[i - 1];
    if (t <= t1) return v0 + (v1 - v0) * ease((t - t0) / (t1 - t0));
  }
  return ks[ks.length - 1][1];
};

const SIDE = {
  prefix: 'bearger_p',
  bones: [
    { name: 'hip', x: 0, y: -100 },
    { name: 'leg_back', parent: 'hip', x: -45, y: 15, part: 25, pivot: [0.5, 0.08], z: 1 },
    { name: 'arm_back', parent: 'hip', x: 60, y: -55, part: 23, pivot: [0.5, 0.1], z: 0 },
    { name: 'belly', parent: 'hip', x: -5, y: -30, part: 8, z: 2 },
    { name: 'torso', parent: 'hip', x: -25, y: 0, part: 0, pivot: [0.5, 0.75], z: 4 },
    { name: 'leg_front', parent: 'hip', x: 25, y: 18, part: 9, pivot: [0.5, 0.08], z: 6 },
    { name: 'shoulder', parent: 'hip', x: 60, y: -65 },
    // tay trước: dải lông #24 dài gần bằng cả thân nên thu lại; móng là con của tay nên phóng bù
    { name: 'arm_front', parent: 'shoulder', x: 25, y: 0, part: 24, pivot: [0.5, 0.08], sx: 0.7, sy: 0.6, z: 7 },
    // móng #29 vẽ chĩa ngang sang phải: xoay theo chiều kim đồng hồ cho chĩa xuống, neo ở gốc móng (cổ tay)
    { name: 'claw', parent: 'arm_front', x: 5, y: 180, rot: 70, part: 29, pivot: [0.2, 0.4], sx: 1.4, sy: 1.6, z: 8 },
    { name: 'neck', parent: 'shoulder', x: 45, y: -40 },
    { name: 'head', parent: 'neck', x: 0, y: 0, part: BEARGER_HEADS.normal, pivot: [0.35, 0.55], z: 9 },
  ],
  anims: {
    // Đứng thở: lông phồng xẹp, đầu gật nhẹ.
    idle(t, pose) {
      const b = sin(t, 0.6);
      pose.torso = { sy: 1 + b * 0.025 };
      pose.belly = { sy: 1 + b * 0.02 };
      pose.head = { r: b * 3, y: b * 2 };
      pose.arm_front = { r: b * 2 };
    },
    // Đi: hai chân vung ngược nhau, tay vung ngược chân cùng bên, thân nhún mỗi bước.
    walk(t, pose) {
      const s = sin(t, 1.4);
      pose.hip = { y: -Math.abs(sin(t, 1.4, 0.25)) * 6 };
      pose.leg_front = { r: s * 20 };
      pose.leg_back = { r: -s * 20 };
      pose.arm_front = { r: -s * 16 };
      pose.arm_back = { r: s * 16 };
      pose.torso = { r: s * 2 };
      pose.head = { r: sin(t, 2.8) * 3 };
    },
    // Cào (lặp 1.2 giây): giơ tay ra sau, vung mạnh xuống phía trước, thân đổ theo.
    swipe(t, pose) {
      const u = t % 1.2;
      const arm = keys(u, [[0, 0], [0.45, 70], [0.6, -95], [0.8, -60], [1.2, 0]]);
      pose.arm_front = { r: arm };
      pose.hip = { r: keys(u, [[0, 0], [0.45, -4], [0.6, 8], [1.2, 0]]) };
      pose.head = { part: BEARGER_HEADS.angry, r: keys(u, [[0, 0], [0.45, -6], [0.6, 8], [1.2, 0]]) };
    },
    // Gầm (lặp 2 giây): ngửa đầu, há miệng, lông dựng lên.
    roar(t, pose) {
      const u = t % 2;
      const k = keys(u, [[0, 0], [0.3, 1], [1.5, 1], [2, 0]]);
      const shake = u > 0.3 && u < 1.5 ? sin(u, 18) * 2 : 0;
      // đầu gầm (#12) cao hơn đầu thường nên hạ xuống cho khớp cổ
      const roaring = k > 0.2;
      pose.head = { part: roaring ? BEARGER_HEADS.roar : BEARGER_HEADS.normal, r: -14 * k + shake, x: roaring ? -10 : 0, y: roaring ? 28 : 0 };
      pose.neck = { y: -10 * k };
      pose.torso = { sy: 1 + 0.06 * k, sx: 1 + 0.03 * k };
      pose.hip = { r: -5 * k };
      pose.arm_front = { r: 25 * k };
    },
    // Lao: chúi người ra trước, chân đạp nhanh.
    charge(t, pose) {
      const s = sin(t, 3.2);
      pose.hip = { r: 14, y: -Math.abs(sin(t, 3.2, 0.25)) * 10 };
      pose.leg_front = { r: s * 35 };
      pose.leg_back = { r: -s * 35 };
      pose.arm_front = { r: -40 + s * 25 };
      pose.arm_back = { r: -40 - s * 25 };
      pose.head = { part: BEARGER_HEADS.angry, r: 8 };
    },
    // Bị đánh (lặp 0.8 giây): giật ngửa ra sau, mắt trắng.
    hit(t, pose) {
      const u = t % 0.8;
      const k = keys(u, [[0, 0], [0.08, 1], [0.5, 0]]);
      pose.hip = { r: -9 * k, x: -8 * k };
      pose.head = { part: u < 0.5 ? BEARGER_HEADS.stunned : BEARGER_HEADS.normal, r: -10 * k };
      pose.arm_front = { r: 20 * k };
    },
    // Đập đất (một lần, khớp server: gồng 1.1 giây rồi đập): chồm người lên, giơ hai tay qua đầu, nện xuống.
    slam(t, pose) {
      const arm = keys(t, [[0, 0], [0.9, -165], [1.1, -25], [1.5, -10]]);
      pose.arm_front = { r: arm };
      pose.arm_back = { r: arm };
      pose.hip = { r: keys(t, [[0, 0], [0.9, -10], [1.1, 12], [1.5, 2]]), y: keys(t, [[0, 0], [0.9, -15], [1.1, 6], [1.5, 0]]) };
      pose.head = { part: BEARGER_HEADS.angry };
    },
    // Ăn (lặp): cúi đầu nhai, tay cào cào xuống đất.
    eat(t, pose) {
      pose.hip = { r: 8 };
      pose.neck = { y: 12 };
      pose.head = { r: 28 + sin(t, 3) * 8 };
      pose.arm_front = { r: -25 + sin(t, 1.5) * 15 };
    },
  },
};

// Tay và chân cho hướng front / back: đối xứng hai bên, bên trái là bản lật của bên phải.
// Móng #29 vẽ chĩa ngang sang phải nên xoay 80° cho chĩa xuống (bên lật thì -80°).
// Tay mọc từ dưới bờm lông, thò xuống tới ngang đầu gối (như hình mẫu), nên đặt thấp và kéo dài.
const limbs = ({ armZ, legZ }) => [
  { name: 'leg_l', parent: 'hip', x: -30, y: 5, part: 10, pivot: [0.5, 0.05], z: legZ, flip: true },
  { name: 'leg_r', parent: 'hip', x: 30, y: 5, part: 10, pivot: [0.5, 0.05], z: legZ },
  { name: 'arm_l', parent: 'hip', x: -105, y: -75, rot: 8, part: 25, pivot: [0.5, 0.08], sy: 1.3, z: armZ, flip: true },
  { name: 'arm_r', parent: 'hip', x: 105, y: -75, rot: -8, part: 25, pivot: [0.5, 0.08], sy: 1.3, z: armZ },
  // móng là con của tay (đã kéo dài sy 1.3) nên co lại cho đúng cỡ
  { name: 'claw_l', parent: 'arm_l', x: 0, y: 82, rot: -80, part: 29, pivot: [0.2, 0.4], sy: 1 / 1.3, z: armZ + 0.5, flip: true },
  { name: 'claw_r', parent: 'arm_r', x: 0, y: 82, rot: 80, part: 29, pivot: [0.2, 0.4], sy: 1 / 1.3, z: armZ + 0.5 },
];

// Đi theo hướng lên / xuống: hai chân nhấc lên luân phiên, thân lắc sang hai bên, tay đánh nhẹ.
const walkUpDown = (t, pose) => {
  const s = sin(t, 1.4);
  pose.hip = { y: -Math.abs(s) * 5, r: s * 3 };
  pose.leg_l = { y: -Math.max(0, s) * 10, r: s * 5 };
  pose.leg_r = { y: -Math.max(0, -s) * 10, r: s * 5 };
  pose.arm_l = { r: -s * 8 };
  pose.arm_r = { r: -s * 8 };
};
const idleUpDown = (t, pose) => {
  const b = sin(t, 0.6);
  pose.torso = { sy: 1 + b * 0.025 };
  pose.arm_l = { r: b * 2 };
  pose.arm_r = { r: -b * 2 };
};
// Cào (lặp 1.2 giây) bằng tay phải: giơ ngang lên cao rồi quét xuống chéo qua thân.
const swipeUpDown = (t, pose) => {
  const u = t % 1.2;
  pose.arm_r = { r: keys(u, [[0, 0], [0.45, -130], [0.6, 40], [0.8, 20], [1.2, 0]]) };
  pose.hip = { r: keys(u, [[0, 0], [0.45, -5], [0.6, 6], [1.2, 0]]) };
  // lúc giơ và quét, tay đưa ra trước bờm lông (bình thường nằm sau) để còn thấy
  if (u > 0.15 && u < 0.9) { pose.arm_r.z = 7; pose.claw_r = { z: 7.5 }; }
};
// Đập đất (một lần, gồng 1.1 giây rồi đập): giơ hai tay sang hai bên lên cao, nện xuống.
const slamUpDown = (t, pose) => {
  const arm = keys(t, [[0, 0], [0.9, 150], [1.1, 20], [1.5, 8]]);
  pose.arm_l = { r: arm };
  pose.arm_r = { r: -arm };
  pose.hip = { y: keys(t, [[0, 0], [0.9, -12], [1.1, 8], [1.5, 0]]) };
  if (t > 0.2 && t < 1.2) {
    pose.arm_l.z = 7; pose.arm_r.z = 7;
    pose.claw_l = { z: 7.5 }; pose.claw_r = { z: 7.5 };
  }
};
// Ăn (lặp): hai tay khép vào giữa, thân nhún nhịp nhai.
const eatUpDown = (t, pose) => {
  pose.hip = { y: Math.abs(sin(t, 1.5)) * 4 };
  pose.arm_l = { r: -22 + sin(t, 1.5) * 8 };
  pose.arm_r = { r: 22 - sin(t, 1.5) * 8 };
};

// Nhìn thẳng (đi xuống): đầu nằm giữa bờm lông, ngực và bụng nâu sẫm lộ ra dưới bờm.
const FRONT = {
  prefix: 'bearger_p',
  bones: [
    { name: 'hip', x: 0, y: -78 },
    ...limbs({ armZ: 3, legZ: 1 }),
    { name: 'belly', parent: 'hip', x: 0, y: -45, part: 7, z: 2 },
    { name: 'torso', parent: 'hip', x: 0, y: -120, part: 4, sx: 1.35, sy: 1.2, z: 4 },
    { name: 'head', parent: 'hip', x: 0, y: -165, part: BEARGER_FRONT_HEADS.normal, z: 6 },
  ],
  anims: {
    idle(t, pose) {
      idleUpDown(t, pose);
      pose.head = { y: sin(t, 0.6) * 2 };
    },
    walk(t, pose) {
      walkUpDown(t, pose);
      pose.head = { r: sin(t, 1.4) * -2 };
    },
    swipe(t, pose) {
      swipeUpDown(t, pose);
      pose.head = { part: BEARGER_FRONT_HEADS.angry };
    },
    roar(t, pose) {
      const u = t % 2;
      const k = keys(u, [[0, 0], [0.3, 1], [1.5, 1], [2, 0]]);
      const shake = u > 0.3 && u < 1.5 ? sin(u, 18) * 2 : 0;
      const roaring = k > 0.2;
      pose.head = { part: roaring ? BEARGER_FRONT_HEADS.roar : BEARGER_FRONT_HEADS.normal, x: shake, y: roaring ? -10 : 0 };
      pose.torso = { sx: 1 + 0.05 * k, sy: 1 + 0.05 * k };
      pose.arm_l = { r: 25 * k };
      pose.arm_r = { r: -25 * k };
    },
    hit(t, pose) {
      const u = t % 0.8;
      const k = keys(u, [[0, 0], [0.08, 1], [0.5, 0]]);
      pose.hip = { y: 6 * k };
      pose.head = { part: u < 0.5 ? BEARGER_FRONT_HEADS.stunned : BEARGER_FRONT_HEADS.normal, y: -6 * k };
      pose.torso = { sy: 1 - 0.05 * k };
    },
    // Lao về phía người xem: bước gấp gấp đôi, mặt giận.
    charge(t, pose) {
      walkUpDown(t * 2.2, pose);
      pose.head = { part: BEARGER_FRONT_HEADS.angry };
    },
    slam(t, pose) {
      slamUpDown(t, pose);
      pose.head = { part: BEARGER_FRONT_HEADS.angry };
    },
    eat(t, pose) {
      eatUpDown(t, pose);
      pose.head = { y: 12 + sin(t, 3) * 4 };
    },
  },
};

// Từ sau lưng (đi lên): không thấy đầu; bờm lông lưng phía trên, lông thân phía dưới, tay chân nâu sẫm hai bên.
const BACK = {
  prefix: 'bearger_p',
  bones: [
    { name: 'hip', x: 0, y: -78 },
    ...limbs({ armZ: 3, legZ: 1 }),
    { name: 'lower', parent: 'hip', x: 0, y: -40, part: 3, sx: 1.15, sy: 0.9, z: 4 },
    { name: 'torso', parent: 'hip', x: 0, y: -130, part: 1, sx: 1.05, sy: 1.1, z: 5 },
  ],
  anims: {
    idle: idleUpDown,
    walk(t, pose) {
      walkUpDown(t, pose);
      pose.lower = { r: sin(t, 1.4) * 2 };
    },
    swipe: swipeUpDown,
    charge: (t, pose) => walkUpDown(t * 2.2, pose),
    slam: slamUpDown,
    eat: eatUpDown,
    // Gầm từ sau lưng: không thấy mặt, chỉ thấy lông dựng lên, tay dang ra.
    roar(t, pose) {
      const k = keys(t % 2, [[0, 0], [0.3, 1], [1.5, 1], [2, 0]]);
      pose.torso = { sx: 1 + 0.05 * k, sy: 1 + 0.07 * k };
      pose.arm_l = { r: 25 * k };
      pose.arm_r = { r: -25 * k };
    },
  },
};

export const BEARGER_RIGS = { side: SIDE, front: FRONT, back: BACK };

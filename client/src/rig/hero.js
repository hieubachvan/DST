// Nhân vật tự vẽ (Pixilart) ghép mảnh, 3 góc nhìn: side (nhìn ngang, quay sang phải; hướng trái lật ngang),
// front (đi xuống, nhìn thẳng) và back (đi lên, thấy lưng).
// Mảnh hình: client/public/hero/<tên>.png (cắt bằng: node tools/crop-hero.mjs). Các mảnh vẽ cùng tỉ lệ nên giữ cỡ gốc.
// Gốc (0, 0) ở mặt đất giữa hai chân; y âm là đi lên. Đơn vị: pixel ảnh gốc. Góc xoay theo chiều kim đồng hồ
// (với tay buông xuống: góc âm là vung ra trước khi nhìn ngang).
//
// Khung xương: hip (eo) -> chân, quần, chest (xoay quanh eo khi nghiêng người) -> thân, cổ -> đầu, vai -> tay.
// Thân không có xương con, nên phồng xẹp thân lúc thở không kéo giãn đầu / tay theo; đầu và tay được nhấc bù bằng tay.
//
// Đồ: mỗi góc nhìn khai báo xương nào đổi ảnh theo đồ (equip). Ảnh có đồ tên là <ảnh gốc>_<id đồ>
// (vd. arm_a_axe, head_front_helmet, torso_right_logsuit) và cắt chung khung với ảnh gốc nên khớp không đổi.
import { HERO_PARTS } from './hero-parts.js';

export const HERO_HEIGHT = 405; // từ mặt đất tới đỉnh tóc (pixel ảnh gốc), để tính tỉ lệ trong game
export const HERO_GEAR = { hand: ['axe', 'spear'], head: ['helmet'], body: ['logsuit'] }; // đồ đã có hình

const sin = (t, hz, phase = 0) => Math.sin((t * hz + phase) * Math.PI * 2);
const ease = (x) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
// Nội suy theo các mốc [thời điểm (giây), giá trị] cho hoạt ảnh đánh (lặp lại theo chu kỳ của mốc cuối).
const keys = (t, ks) => {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    const [t1, v1] = ks[i], [t0, v0] = ks[i - 1];
    if (t <= t1) return v0 + (v1 - v0) * ease((t - t0) / (t1 - t0));
  }
  return ks[ks.length - 1][1];
};
// Điểm neo [ox, oy] của mảnh từ tọa độ (cx, cy) trên khung vẽ Pixilart 200x200.
const pv = (part, cx, cy) => {
  const p = HERO_PARTS[part];
  return [(cx - p.x) / p.w, (cy - p.y) / p.h];
};

const BREATH_HZ = 0.35; // một nhịp thở ~2,9 giây
const STEP_HZ = 1.7; // một chu kỳ hai bước
const CHOP_T = 0.75; // một nhát rìu / đấm
const STAB_T = 0.7; // một nhát đâm giáo

const HIP_Y = -115; // eo, nơi cạp quần
const NECK_Y = -138; // cổ, tính từ eo (đỉnh thân)
const TORSO_H = 150;
const FAR = 0xb4a89a; // nhuộm tay / chân phía xa cho có chiều sâu

// Thở: thân phồng theo chiều dọc (neo ở eo), đầu và vai nhấc lên đúng bằng phần đỉnh thân nhô thêm.
function breathe(t, pose, arms) {
  const b = sin(t, BREATH_HZ);
  const lift = -TORSO_H * 0.022 * b;
  pose.torso = { sy: 1 + 0.022 * b, sx: 1 + 0.008 * b };
  pose.neck = { y: lift };
  pose.head = { r: sin(t, BREATH_HZ, -0.15) * 1.5 };
  for (const [name, out] of arms) pose[name] = { y: lift * 0.8, r: out * (1.5 + 1.5 * b) };
}

// Bước đi nhìn thẳng / nhìn lưng: hai chân thay nhau nhấc lên, tay đánh nhẹ, người lắc lư theo bước.
function walkFacing(t, pose) {
  const s = sin(t, STEP_HZ);
  const bob = Math.abs(sin(t, STEP_HZ, 0.25));
  pose.hip = { y: -bob * 4 };
  pose.leg_l = { y: -Math.max(0, s) * 9, sy: 1 - Math.max(0, s) * 0.08 };
  pose.leg_r = { y: -Math.max(0, -s) * 9, sy: 1 - Math.max(0, -s) * 0.08 };
  pose.chest = { r: s * 2 };
  pose.shorts = { r: s * 1.5 };
  pose.head = { r: -s * 2, y: bob * 1.5 };
  pose.arm_l = { r: 4 + s * 6, sy: 1 - s * 0.06 };
  pose.arm_r = { r: -4 + s * 6, sy: 1 + s * 0.06 };
}

// Đánh khi nhìn thẳng / nhìn lưng: tay cầm đồ (arm) giơ cao sang ngang rồi bổ xuống; out = 1 nếu dang ra là góc dương.
function chopFacing(arm, out) {
  return (t, pose) => {
    const u = t % CHOP_T;
    const r = keys(u, [[0, 0], [0.3, 125], [0.42, -15], [0.55, -10], [CHOP_T, 0]]);
    pose[arm] = { r: r * out, sy: 1 - keys(u, [[0, 0], [0.3, 0.1], [0.42, 0], [CHOP_T, 0]]) };
    pose.chest = { r: keys(u, [[0, 0], [0.3, -3], [0.42, 4], [CHOP_T, 0]]) * out };
    pose.hip = { y: keys(u, [[0, 0], [0.3, -4], [0.45, 4], [CHOP_T, 0]]) };
    pose.head = { r: keys(u, [[0, 0], [0.3, -3], [0.42, 3], [CHOP_T, 0]]) * out };
  };
}

// Đâm khi nhìn thẳng / nhìn lưng: kéo tay về rồi đẩy thẳng tới (tay ngắn lại vì chĩa về phía người xem / ra xa).
function stabFacing(arm, out) {
  return (t, pose) => {
    const u = t % STAB_T;
    const k = keys(u, [[0, 0], [0.25, -0.4], [0.36, 1], [0.5, 1], [STAB_T, 0]]);
    pose[arm] = { r: -k * 12 * out, sy: 1 - Math.max(0, k) * 0.25, y: -Math.max(0, k) * 25, x: k * 8 * out };
    pose.chest = { r: -k * 2 * out };
    pose.hip = { y: Math.max(0, k) * 3 };
  };
}

// Dựng góc nhìn thẳng / lưng (hai góc chung khung xương, khác ảnh đầu / thân và tay cầm đồ).
// hand: xương tay cầm đồ (tay phải nhân vật: bên trái màn hình khi nhìn thẳng, bên phải khi nhìn lưng),
// handZ: lớp của tay đó khi cầm đồ (nhìn thẳng thì đồ ở trước thân, nhìn lưng thì bị thân che).
function facing(view, head, torso, headPivot, hand, handZ) {
  const out = hand === 'arm_l' ? 1 : -1;
  return {
    prefix: 'hero_',
    bones: [
      { name: 'hip', x: 0, y: HIP_Y },
      { name: 'leg_l', parent: 'hip', x: -20, y: 45, part: 'leg_left', pivot: pv('leg_left', 62, 63), z: 0 },
      { name: 'leg_r', parent: 'hip', x: 20, y: 45, part: 'leg_right', pivot: pv('leg_right', 138, 63), z: 0 },
      { name: 'chest', parent: 'hip', x: 0, y: 15 },
      { name: 'arm_l', parent: 'chest', x: -62, y: NECK_Y + 12, part: 'arm_a', pivot: pv('arm_a', 55, 42), z: 1 },
      { name: 'arm_r', parent: 'chest', x: 62, y: NECK_Y + 12, part: 'arm_b', pivot: pv('arm_b', 145, 42), z: 1 },
      { name: 'torso', parent: 'chest', x: 0, y: 0, part: torso, pivot: pv(torso, 90, 166.5), z: 2 },
      { name: 'shorts', parent: 'hip', x: 0, y: -4, part: 'shorts_front', pivot: pv('shorts_front', 104, 42.5), z: 3 },
      { name: 'neck', parent: 'chest', x: 0, y: NECK_Y },
      { name: 'head', parent: 'neck', x: 0, y: 0, part: head, pivot: pv(head, ...headPivot), z: 5 },
    ],
    equip: { head: ['head', head], body: ['torso', torso], hand: [hand, hand === 'arm_l' ? 'arm_a' : 'arm_b', handZ] },
    anims: {
      idle: (t, pose) => breathe(t, pose, [['arm_l', 1], ['arm_r', -1]]),
      walk: walkFacing,
      chop: chopFacing(hand, out),
      stab: stabFacing(hand, view === 'front' ? out : -out),
    },
  };
}

const SIDE = {
  prefix: 'hero_',
  bones: [
    { name: 'hip', x: 0, y: HIP_Y },
    { name: 'leg_back', parent: 'hip', x: -5, y: 45, part: 'leg_right', pivot: pv('leg_right', 138, 63), z: 0, tint: FAR },
    { name: 'chest', parent: 'hip', x: 0, y: 15 },
    // tay nhìn ngang dùng arm_a: bắp tay hướng về phía trước (hướng mặt)
    { name: 'arm_back', parent: 'chest', x: 6, y: NECK_Y + 16, part: 'arm_a', pivot: pv('arm_a', 55, 42), z: 1, tint: FAR },
    // thân nghiêng: đáy nhọn lệch về sau, ngực nhô ra trước
    { name: 'torso', parent: 'chest', x: 0, y: 0, part: 'torso_right', pivot: pv('torso_right', 88.5, 161), z: 2 },
    { name: 'leg_front', parent: 'hip', x: 5, y: 45, part: 'leg_right', pivot: pv('leg_right', 138, 63), z: 3 },
    { name: 'shorts', parent: 'hip', x: 0, y: -4, part: 'shorts_side', pivot: pv('shorts_side', 97, 119.5), z: 4 },
    { name: 'neck', parent: 'chest', x: 16, y: NECK_Y + 4 },
    { name: 'head', parent: 'neck', x: 0, y: 0, part: 'head_right', pivot: pv('head_right', 93, 145), z: 5 },
    { name: 'arm_front', parent: 'chest', x: 10, y: NECK_Y + 16, part: 'arm_a', pivot: pv('arm_a', 55, 42), z: 6 },
  ],
  equip: { head: ['head', 'head_right'], body: ['torso', 'torso_right'], hand: ['arm_front', 'arm_a'] },
  anims: {
    idle: (t, pose) => breathe(t, pose, [['arm_front', -0.5], ['arm_back', 0.5]]),
    // Đi: hai chân vung ngược nhau, tay vung ngược chân cùng bên, người hơi đổ về trước, nhún mỗi bước.
    walk(t, pose) {
      const s = sin(t, STEP_HZ);
      const bob = Math.abs(sin(t, STEP_HZ, 0.25));
      pose.hip = { y: -bob * 5 };
      pose.leg_front = { r: -s * 28 };
      pose.leg_back = { r: s * 28 };
      pose.arm_front = { r: s * 26 };
      pose.arm_back = { r: -s * 26 };
      pose.chest = { r: 4 };
      pose.shorts = { r: -s * 3 };
      pose.head = { r: sin(t, STEP_HZ * 2) * 2 - 2 };
    },
    // Bổ rìu (tay không thì là đấm): vung tay lên quá đầu ra sau, bổ mạnh xuống phía trước, người đổ theo.
    chop(t, pose) {
      const u = t % CHOP_T;
      pose.arm_front = { r: keys(u, [[0, 0], [0.3, -165], [0.42, -30], [0.55, -25], [CHOP_T, 0]]) };
      pose.arm_back = { r: keys(u, [[0, 0], [0.3, 20], [0.42, -10], [CHOP_T, 0]]) };
      pose.chest = { r: keys(u, [[0, 0], [0.3, -8], [0.42, 14], [0.55, 12], [CHOP_T, 0]]) };
      pose.hip = { y: keys(u, [[0, 0], [0.3, -3], [0.45, 5], [CHOP_T, 0]]) };
      pose.leg_front = { r: keys(u, [[0, 0], [0.3, -10], [0.42, -18], [CHOP_T, 0]]) };
      pose.leg_back = { r: keys(u, [[0, 0], [0.42, 12], [CHOP_T, 0]]) };
      pose.head = { r: keys(u, [[0, 0], [0.3, -6], [0.42, 6], [CHOP_T, 0]]) };
    },
    // Đâm giáo: kéo tay ra sau rồi đẩy giáo tới (giáo nằm ngang ra trước), bước chân trước tới theo.
    stab(t, pose) {
      const u = t % STAB_T;
      const k = keys(u, [[0, 0], [0.25, -1], [0.36, 1], [0.5, 1], [STAB_T, 0]]);
      const f = Math.max(0, k);
      // giáo vẽ chĩa chéo lên trước: tay ngả ra sau ~35° (cộng độ đổ người) thì giáo nằm ngang
      pose.arm_front = { r: 20 + k * 16, x: f * 18 - Math.max(0, -k) * 12, y: f * 4 };
      pose.arm_back = { r: -k * 15 };
      pose.chest = { r: 4 + f * 10 - Math.max(0, -k) * 4 };
      pose.hip = { x: f * 12 };
      pose.leg_front = { r: -f * 22 };
      pose.leg_back = { r: f * 10 };
    },
  },
};

export const HERO_RIGS = {
  side: SIDE,
  front: facing('front', 'head_front', 'torso_front', [98, 171], 'arm_l', 3.5),
  back: facing('back', 'head_back', 'torso_back', [101, 166], 'arm_r', 1),
};

// Mặc đồ cho nhân vật (DirectionalRig dựng từ HERO_RIGS). gear: { hand, head, body } là id đồ hoặc null;
// đồ chưa có hình (không có trong HERO_GEAR) thì hiện như không mặc.
export function equipHero(hero, gear) {
  for (const rig of Object.values(hero.rigs)) {
    for (const [slot, [bone, base, armedZ]] of Object.entries(rig.def.equip)) {
      const id = gear[slot];
      const has = id && HERO_GEAR[slot].includes(id);
      const b = rig.byName[bone];
      b.baseZ ??= b.z;
      rig.setPart(bone, has ? `${base}_${id}` : base, has && armedZ !== undefined ? armedZ : b.baseZ);
    }
  }
}

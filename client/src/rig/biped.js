// Khung xương hai chân dùng chung cho các nhân vật nhìn ngang (người que, lợn...): quay sang phải, hướng trái lật ngang.
// Mỗi tay / chân hai đoạn: tay = bắp tay (vai) -> cẳng tay (khuỷu) -> bàn tay, chân = đùi (hông) -> cẳng chân (gối)
// -> bàn chân. Nhân vật chỉ khai báo cỡ, ảnh từng mảnh và phần thân (buildBiped); hoạt ảnh dùng chung.
//
// Gốc (0, 0) ở mặt đất giữa hai chân; y âm là đi lên. Góc xoay theo chiều kim đồng hồ, đoạn tay / chân góc 0
// là buông thẳng xuống: góc âm là vung ra trước. Khuỷu gập ra trước là góc âm, gối gập ra sau là góc dương.
// Chân không có IK: sau mỗi tư thế, ground() hạ / nhấc eo để bàn chân thấp nhất chạm đất.
//
// Xương: hip (eo) -> thigh/shin/foot_<b|f>, chest (xoay quanh eo khi nghiêng người) -> upper/fore/hand_<b|f>,
// torso (ảnh thân), neck -> head (nếu có). _b là phía xa, _f là phía gần.
// Vũ khí gắn vào bàn tay phía gần; mỗi món một xương riêng (điểm neo ở chỗ nắm), equipWeapon bật / tắt ảnh để đổi món.
// Xoay xương vũ khí (pose.<món>.r) là bẻ cổ tay: 0 là vũ khí chĩa ra trước, vuông góc với cẳng tay.
import { STICK_PARTS } from './stick-parts.js';

export const WEAPONS = ['sword', 'axe', 'mace']; // ảnh cắt từ testaction.png (client/public/stick/<món>.png)

const RAD = Math.PI / 180;
const sin = (t, hz, phase = 0) => Math.sin((t * hz + phase) * Math.PI * 2);
const cos = (t, hz, phase = 0) => Math.cos((t * hz + phase) * Math.PI * 2);
const ease = (x) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
// Nội suy theo các mốc [thời điểm (giây), giá trị] (như hero.js).
const keys = (t, ks) => {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    const [t1, v1] = ks[i], [t0, v0] = ks[i - 1];
    if (t <= t1) return v0 + (v1 - v0) * ease((t - t0) / (t1 - t0));
  }
  return ks[ks.length - 1][1];
};

const BREATH_HZ = 0.35;
const WALK_HZ = 1.6; // một chu kỳ hai bước
const RUN_HZ = 2.5;
const SLASH_T = 0.55; // một nhát kiếm (tay không thì là vung đấm)
const CHOP_T = 0.85; // một nhát rìu / chùy: nặng nên giơ lâu hơn, bổ sâu hơn

// Đặt tư thế một chân: đùi a, gối k; bàn chân xoay ngược lại cho gần nằm phẳng (flat = 1 là phẳng hẳn) cộng thêm toe.
function setLeg(pose, side, a, k, flat = 0.85, toe = 0) {
  pose[`thigh_${side}`] = { r: a };
  pose[`shin_${side}`] = { r: k };
  pose[`foot_${side}`] = { r: -(a + k) * flat + toe };
}
function setArm(pose, side, upper, elbow) {
  pose[`upper_${side}`] = { r: upper };
  pose[`fore_${side}`] = { r: elbow };
}
const wrist = (pose, r) => { for (const w of WEAPONS) pose[w] = { r }; };

// Hoạt ảnh theo cỡ nhân vật: thigh / shin (độ dài đùi / cẳng chân, để chạm đất), neckY (đỉnh thân tính từ eo,
// để nhấc vai khi thở), lean (nhân độ nghiêng người: thân to nặng thì nghiêng ít).
function makeAnims({ thigh, shin, neckY, lean = 1 }) {
  // Hạ / nhấc eo để cổ chân thấp nhất nằm đúng độ cao ankleY (chân chạm đất); lift (âm) để bật lên khi chạy.
  const ground = (pose, lift = 0) => {
    const ankle = (side) => {
      const a = (pose[`thigh_${side}`]?.r ?? 0) * RAD, k = (pose[`shin_${side}`]?.r ?? 0) * RAD;
      return thigh * Math.cos(a) + shin * Math.cos(a + k);
    };
    const drop = thigh + shin - Math.max(ankle('f'), ankle('b'));
    pose.hip = { ...pose.hip, y: (pose.hip?.y ?? 0) + drop + lift * (thigh + shin) / 184 };
  };
  const chestR = (pose, r) => { pose.chest = { r: r * lean }; };

  function idle(t, pose) {
    const b = sin(t, BREATH_HZ);
    const lift = neckY * 0.02 * b; // đỉnh thân nhô lên khi hít vào
    pose.torso = { sy: 1 + 0.02 * b, sx: 1 + 0.006 * b };
    chestR(pose, 2);
    pose.neck = { y: lift };
    pose.head = { r: sin(t, BREATH_HZ, -0.15) * 2 };
    setArm(pose, 'f', -12 + b * 2, -55);
    setArm(pose, 'b', 10 - b * 2, -25);
    pose.upper_f.y = pose.upper_b.y = lift * 0.8;
    wrist(pose, -10);
    setLeg(pose, 'f', -8, 8);
    setLeg(pose, 'b', 9, 4);
    ground(pose);
  }

  // Đi: đùi vung ngược nhau, gối gập lúc chân đang đưa lên trước, tay vung ngược chân cùng phía.
  function walk(t, pose) {
    const s = sin(t, WALK_HZ), c = cos(t, WALK_HZ);
    setLeg(pose, 'f', -24 * s, 6 + 40 * Math.max(0, c));
    setLeg(pose, 'b', 24 * s, 6 + 40 * Math.max(0, -c));
    setArm(pose, 'f', 14 * s - 8, -45 - 8 * s); // tay cầm vũ khí vung ít hơn
    setArm(pose, 'b', -24 * s, -20 + 10 * s);
    wrist(pose, -5 + 5 * s);
    chestR(pose, 4);
    pose.head = { r: -2 + sin(t, WALK_HZ * 2) * 1.5 };
    ground(pose);
  }

  // Chạy: người đổ về trước, đùi vung rộng, gót đá lên mông ngay sau khi rời đất, tay gập ~90° vung mạnh, có pha bật.
  function runLegs(t, pose) {
    const p = t * RUN_HZ;
    const s = Math.sin(p * Math.PI * 2);
    // gối gập nhiều nhất đầu pha đưa chân lên (p ~ 0.9 với chân trước), ít khi chân chống đất
    const knee = (ph) => 18 + 95 * Math.max(0, Math.cos((p + ph - 0.9) * Math.PI * 2));
    setLeg(pose, 'f', -12 - 40 * s, knee(0), 0.7, 8);
    setLeg(pose, 'b', -12 + 40 * s, knee(0.5), 0.7, 8);
    ground(pose, -10 * Math.abs(Math.cos(p * Math.PI * 2)) ** 2);
    chestR(pose, 12);
    pose.head = { r: -8 + Math.sin(p * Math.PI * 4) * 2 };
  }
  function run(t, pose) {
    runLegs(t, pose);
    const s = sin(t, RUN_HZ);
    setArm(pose, 'f', 28 * s - 15, -80);
    setArm(pose, 'b', -42 * s, -85);
    wrist(pose, 45 - 10 * s); // vũ khí chĩa chéo lên trước
  }

  // Vung tay cầm vũ khí: giơ lên quá đầu ra sau (cẳng tay gập, vũ khí thõng sau lưng), chém xuống trước, cổ tay bẻ theo.
  // k: các mốc thời gian [bắt đầu, giơ cao nhất, chém tới, giữ, hết nhát]; deep: độ chém sâu (rìu / chùy lớn hơn).
  function swingArms(u, pose, [t0, t1, t2, t3, t4], deep, extraLean = 0) {
    setArm(pose, 'f',
      keys(u, [[t0, -12], [t1, -200], [t2, -45 - deep * 15], [t3, -38 - deep * 15], [t4, -12]]),
      keys(u, [[t0, -55], [t1, -75], [t2, -5], [t3, -10], [(t3 + t4) / 2, -65], [t4, -55]]));
    wrist(pose, keys(u, [[t0, -10], [t1, 10], [t2, 62 + deep * 3], [t3, 58 + deep * 3], [t4, -10]]));
    setArm(pose, 'b',
      keys(u, [[t0, 10], [t1, -35], [t2, 35], [t4, 10]]),
      keys(u, [[t0, -25], [t1, -60], [t2, -30], [t4, -25]]));
    const chest = keys(u, [[t0, 2], [t1, -10 - deep * 4], [t2, 18 + deep * 8], [t3, 16 + deep * 7], [t4, 2]]);
    chestR(pose, chest + extraLean);
    pose.head = { r: -chest * 0.5 };
  }
  // Chém đứng tại chỗ: bước chân trước tới khi chém, eo dồn theo.
  function attack(T, deep) {
    const k = [0, T * 0.33, T * 0.55, T * 0.7, T];
    return (t, pose) => {
      const u = t % T;
      swingArms(u, pose, k, deep);
      setLeg(pose, 'f',
        keys(u, [[0, -8], [k[1], -12], [k[2], -32 - deep * 8], [k[3], -30 - deep * 8], [T, -8]]),
        keys(u, [[0, 8], [k[1], 12], [k[2], 30 + deep * 15], [k[3], 28 + deep * 15], [T, 8]]));
      setLeg(pose, 'b', keys(u, [[0, 9], [k[2], 24 + deep * 6], [k[3], 22], [T, 9]]), keys(u, [[0, 4], [k[2], 10], [T, 4]]));
      pose.hip = { x: keys(u, [[0, 0], [k[1], -6], [k[2], 16 + deep * 6], [k[3], 14], [T, 0]]) * (thigh + shin) / 184 };
      ground(pose);
    };
  }
  // Vừa chạy vừa chém: chân giữ nhịp chạy, nửa người trên vung vũ khí.
  function runAttack(T, deep) {
    const k = [0, T * 0.33, T * 0.55, T * 0.7, T];
    return (t, pose) => {
      runLegs(t, pose);
      swingArms(t % T, pose, k, deep, 10);
    };
  }

  return {
    idle,
    walk,
    run,
    slash: attack(SLASH_T, 0),
    chop: attack(CHOP_T, 1),
    run_slash: runAttack(SLASH_T, 0),
    run_chop: runAttack(CHOP_T, 1),
  };
}

// Dựng định nghĩa rig (xem rig.js) cho một nhân vật.
//  upper, fore, thigh, shin: độ dài các đoạn (pixel ảnh gốc, khớp tới khớp)
//  ankleY: độ cao cổ chân so với mặt đất (âm); legTop: khớp hông so với eo; legX: [x chân xa, x chân gần]
//  shoulder: [x, y] khớp vai so với eo (tay phía xa lệch thêm farShoulderX); neckY: đỉnh thân so với eo
//  limbs: { near, far } — mỗi phía { upper, fore, thigh, shin, foot?, hand? } = [tên ảnh, điểm neo]; far.tint: nhuộm
//  body: các xương thân (torso, neck, head...) — cha là 'chest'; z từ 2 tới 3
//  legZ: lớp chân phía gần (mặc định 4: trước thân; đặt < 2 để thân / váy che đầu đùi)
//  weaponScale, lean: xem makeAnims
export function buildBiped(c) {
  const limb = (side, near) => {
    const p = near ? c.limbs.near : c.limbs.far;
    const tint = near ? undefined : c.limbs.far.tint;
    const bone = (name, parent, x, y, z, key) => ({ name, parent, x, y, z, tint, ...(p[key] && { part: p[key][0], pivot: p[key][1] }) });
    const legZ = near ? c.legZ ?? 4 : 0, armZ = near ? 6 : 1;
    const sx = near ? 0 : c.farShoulderX ?? 0;
    return {
      leg: [
        bone(`thigh_${side}`, 'hip', c.legX[near ? 1 : 0], c.legTop, legZ, 'thigh'),
        bone(`shin_${side}`, `thigh_${side}`, 0, c.thigh, legZ, 'shin'),
        bone(`foot_${side}`, `shin_${side}`, 0, c.shin, legZ, 'foot'),
      ],
      arm: [
        bone(`upper_${side}`, 'chest', c.shoulder[0] + sx, c.shoulder[1], armZ, 'upper'),
        bone(`fore_${side}`, `upper_${side}`, 0, c.upper, armZ, 'fore'),
        bone(`hand_${side}`, `fore_${side}`, 0, c.fore, armZ, 'hand'),
      ],
    };
  };
  // Vũ khí: neo ở chỗ nắm, xoay sẵn để hướng nắm -> đầu vũ khí chĩa ra trước (vuông góc cẳng tay).
  const weapon = (name) => {
    const p = STICK_PARTS[name];
    const angle = Math.atan2(p.tip[1] - p.grip[1], p.tip[0] - p.grip[0]) / RAD;
    return {
      name, parent: 'hand_f', x: 0, y: 0, part: `stick_${name}`, pivot: [p.grip[0] / p.w, p.grip[1] / p.h],
      rot: -angle, sx: c.weaponScale, sy: c.weaponScale, z: 5, // z 5: nằm dưới bàn tay, trông như đang nắm
    };
  };
  const far = limb('b', false), near = limb('f', true);
  return {
    prefix: '',
    bones: [
      { name: 'hip', x: 0, y: c.ankleY - c.legTop - c.thigh - c.shin },
      ...far.leg,
      { name: 'chest', parent: 'hip', x: 0, y: 0 },
      ...far.arm,
      ...c.body,
      ...near.leg,
      ...near.arm,
      ...WEAPONS.map(weapon),
    ],
    anims: makeAnims(c),
  };
}

// ---- Nhìn thẳng (đi xuống) / nhìn lưng (đi lên) ----
// Xương đặt tên theo phía màn hình: _l bên trái, _r bên phải. Tay cầm vũ khí là tay phải của nhân vật: bên trái màn hình
// khi nhìn thẳng, bên phải khi nhìn lưng. Tay / chân chĩa về phía người xem hay ra xa thì co ngắn lại (sy) thay vì xoay.
// out: hướng dang ra ngoài của một bên (+1 bên trái, -1 bên phải; xoay dương là đưa đầu dưới sang trái).

function makeFacingAnims({ thigh, shin, neckY, lean = 1 }, hand) {
  const ow = hand === 'l' ? 1 : -1; // hướng dang ra của tay cầm vũ khí
  const other = hand === 'l' ? 'r' : 'l';
  // Hạ eo để chân dài nhất (sau khi co / xoay) chạm đất.
  const ground = (pose, lift = 0) => {
    const len = (side) => {
      const t = pose[`thigh_${side}`] ?? {}, s = pose[`shin_${side}`] ?? {};
      const a = (t.r ?? 0) * RAD, k = (s.r ?? 0) * RAD;
      return (thigh * Math.cos(a) + shin * (s.sy ?? 1) * Math.cos(a + k)) * (t.sy ?? 1);
    };
    const drop = thigh + shin - Math.max(len('l'), len('r'));
    pose.hip = { ...pose.hip, y: (pose.hip?.y ?? 0) + drop + lift * (thigh + shin) / 184 };
  };
  // Nhấc một chân: đùi đưa về phía người xem (co ngắn), cẳng chân gập ra sau (co thêm). up: 0..1.
  const stepLeg = (pose, side, up, amount) => {
    pose[`thigh_${side}`] = { sy: 1 - up * amount, r: (side === 'l' ? 1 : -1) * up * 3 };
    pose[`shin_${side}`] = { sy: 1 - up * amount * 0.6 };
  };
  // Tay một bên: r dương là dang ra ngoài / giơ lên, elbow dương là cẳng tay gập tiếp cùng chiều (giơ cao thì gập ra sau đầu).
  // wrist: vũ khí mặc định chĩa ngược cẳng tay (về phía vai); âm là ngả ra ngoài.
  const arm = (pose, side, r, elbow, sy = 1) => {
    const o = side === 'l' ? 1 : -1;
    pose[`upper_${side}`] = { r: o * r, sy };
    pose[`fore_${side}`] = { r: o * elbow, sy };
  };
  const wrist = (pose, r) => { for (const w of WEAPONS) pose[w] = { r: ow * r }; };

  function idle(t, pose) {
    const b = sin(t, BREATH_HZ);
    const lift = neckY * 0.02 * b;
    pose.torso = { sy: 1 + 0.02 * b, sx: 1 + 0.008 * b };
    pose.neck = { y: lift };
    pose.head = { r: sin(t, BREATH_HZ, -0.15) * 1.5 };
    arm(pose, 'l', 5 + 2 * b, 8);
    arm(pose, 'r', 5 + 2 * b, 8);
    pose.upper_l.y = pose.upper_r.y = lift * 0.8;
    wrist(pose, -33);
    ground(pose);
  }

  // Đi: hai chân thay nhau nhấc lên, tay đánh tới / lui (co giãn), người lắc lư theo bước.
  function walkLegs(t, pose, amount, hz) {
    const s = sin(t, hz);
    stepLeg(pose, 'l', Math.max(0, s), amount);
    stepLeg(pose, 'r', Math.max(0, -s), amount);
    pose.hip = { x: s * 3 };
    pose.chest = { r: s * 2 * lean };
    pose.head = { r: -s * 2 };
    return s;
  }
  function walk(t, pose) {
    const s = walkLegs(t, pose, 0.28, WALK_HZ);
    ground(pose, -Math.abs(cos(t, WALK_HZ)) * 3);
    arm(pose, hand, 6, 12 + 6 * s, 1 + s * 0.08 * ow);
    arm(pose, other, 6, 10 - 6 * s, 1 - s * 0.1 * ow);
    wrist(pose, -30);
  }
  function runLegs(t, pose) {
    walkLegs(t, pose, 0.5, RUN_HZ);
    ground(pose, -10 * Math.abs(cos(t, RUN_HZ)) ** 2);
  }
  function run(t, pose) {
    runLegs(t, pose);
    const s = sin(t, RUN_HZ);
    arm(pose, hand, 14, 10, 0.75 + s * 0.15 * ow); // khuỷu gập, cẳng tay chĩa về người xem nên ngắn lại
    arm(pose, other, 14, 10, 0.75 - s * 0.15 * ow);
    wrist(pose, -45);
  }

  // Chém: tay cầm vũ khí giơ cao sang ngang (vũ khí ngả ra sau đầu), bổ chéo xuống qua trước người, cổ tay lật theo.
  function swingArms(u, pose, [t0, t1, t2, t3, t4], deep) {
    arm(pose, hand,
      keys(u, [[t0, 5], [t1, 150], [t2, -25 - deep * 10], [t3, -20 - deep * 10], [t4, 5]]),
      keys(u, [[t0, 8], [t1, 55], [t2, 5], [t3, 8], [t4, 8]]));
    wrist(pose, keys(u, [[t0, -33], [t1, -185], [t2, -255], [t3, -250], [t4, -33]]));
    arm(pose, other, keys(u, [[t0, 5], [t1, 25], [t2, 10], [t4, 5]]), keys(u, [[t0, 8], [t1, 30], [t4, 8]]));
    pose.chest = { r: keys(u, [[t0, 0], [t1, 4 * ow], [t2, -(6 + deep * 3) * ow], [t3, -(5 + deep * 3) * ow], [t4, 0]]) * lean };
    pose.head = { r: keys(u, [[t0, 0], [t1, 3 * ow], [t2, -3 * ow], [t4, 0]]) };
  }
  function attack(T, deep) {
    const k = [0, T * 0.33, T * 0.55, T * 0.7, T];
    return (t, pose) => {
      const u = t % T;
      swingArms(u, pose, k, deep);
      const crouch = keys(u, [[0, 0], [k[1], -0.03], [k[2], 0.08 + deep * 0.04], [k[3], 0.07], [T, 0]]);
      for (const side of ['l', 'r']) stepLeg(pose, side, Math.max(0, crouch), 1);
      ground(pose);
    };
  }
  // Chém từ sau ra trước (vung về phía người xem / ra xa): tay giơ thẳng lên đầu, vũ khí dựng sau đầu; rồi tay chĩa
  // thẳng vào người xem (co ngắn hẳn) và bổ xuống chéo về phía trước (vẫn hơi ngắn), vũ khí luôn nối dài theo tay.
  // Lúc tay co ngắn nhất thì đổi cách biểu diễn (góc giơ lên <-> buông xuống) — tay và vũ khí ngắn nên không thấy giật.
  // Lớp vẽ đổi theo pha: nhìn thẳng thì vũ khí sau đầu lúc giơ, ra trước lúc chém; nhìn lưng thì ngược lại.
  const front = hand === 'l';
  function forwardSwing(u, pose, [t0, t1, t2, t3, t4], deep) {
    const e = 0.001, ta = (t0 + t1) / 2, ts = (t1 + t2) / 2;
    const upper = { r: keys(u, [[t0, 14], [ta, 14], [ta + e, 172], [t1, 172], [ts, 172], [ts + e, 6], [t2, 2], [t3, 4], [t4, 14]]) };
    upper.sy = keys(u, [[t0, 0.75], [ta, 0.12], [t1, 1], [ts, 0.12], [t2, 0.55 + deep * 0.05], [t3, 0.6], [t4, 0.75]]);
    const fore = { r: keys(u, [[t0, 10], [t1, -6], [t2, 0], [t4, 10]]), sy: keys(u, [[t0, 1], [t1, 0.8], [t2, 1], [t4, 1]]) };
    // cổ tay: 180 là vũ khí nối dài theo cẳng tay; giơ lên thì ngả nhẹ ra sau (ra ngoài)
    const r = keys(u, [[t0, -45], [ta, -45], [ta + e, 165], [t1, 160], [ts, 175], [t2, 180], [t3, 180], [t4, 315]]);
    const phase = u < ta ? 0 : u < ts ? 1 : 2; // 0: chưa giơ, 1: đang giơ trên đầu, 2: đã chém xuống
    const z = front
      ? [{ arm: 6, fore: 6, weapon: 5 }, { arm: 6, fore: 1.5, weapon: 1.4 }, { arm: 6, fore: 6, weapon: 5 }][phase]
      : [{ arm: 1.2, fore: 1.2, weapon: 1.1 }, { arm: 6, fore: 6, weapon: 5 }, { arm: 1.2, fore: 1.2, weapon: 1.1 }][phase];
    pose[`upper_${hand}`] = { r: ow * upper.r, sy: upper.sy, z: z.arm };
    pose[`fore_${hand}`] = { r: ow * fore.r, sy: fore.sy, z: z.fore };
    pose[`hand_${hand}`] = { z: z.fore };
    for (const w of WEAPONS) pose[w] = { r: ow * r, z: z.weapon };
    arm(pose, other, keys(u, [[t0, 14], [t1, 30], [t2, 12], [t4, 14]]), keys(u, [[t0, 10], [t1, 25], [t4, 10]]), 0.8);
    pose.head = { ...pose.head, r: keys(u, [[t0, 0], [t1, -2 * ow], [t2, 3 * ow], [t4, 0]]) };
  }
  function runAttack(T, deep) {
    const k = [0, T * 0.33, T * 0.55, T * 0.7, T];
    return (t, pose) => {
      runLegs(t, pose);
      forwardSwing(t % T, pose, k, deep);
    };
  }

  return {
    idle,
    walk,
    run,
    slash: attack(SLASH_T, 0),
    chop: attack(CHOP_T, 1),
    run_slash: runAttack(SLASH_T, 0),
    run_chop: runAttack(CHOP_T, 1),
  };
}

// Dựng rig nhìn thẳng (view 'front') / nhìn lưng ('back'). c: cỡ như buildBiped; f: phần riêng của góc nhìn:
//  body: các xương thân (cha 'chest', z 2..3); shoulder: [x, y] vai bên trái màn hình so với eo (bên phải đối xứng);
//  legX: khoảng cách từ giữa tới mỗi chân; limbs: ảnh tay / chân như c.limbs.near (bên phải màn hình lật ngang);
//  footSx: co ngang bàn chân (nhìn thẳng thấy mũi chân ngắn lại).
export function buildFacing(c, view, f) {
  const hand = view === 'front' ? 'l' : 'r';
  // nhìn thẳng: tay cầm vũ khí ở trước thân; nhìn lưng: vũ khí bị thân che
  const handZ = view === 'front' ? 6 : 1.2, weaponZ = view === 'front' ? 5 : 1.1;
  const legZ = c.legZ ?? 0;
  const limb = (side) => {
    const o = side === 'l' ? 1 : -1;
    const z = side === hand ? handZ : 1;
    const bone = (name, parent, x, y, bz, key, extra) => ({
      name, parent, x, y, z: bz, flip: side === 'r', ...(f.limbs[key] && { part: f.limbs[key][0], pivot: f.limbs[key][1] }), ...extra,
    });
    return [
      bone(`thigh_${side}`, 'hip', -o * f.legX, c.legTop, legZ, 'thigh'),
      bone(`shin_${side}`, `thigh_${side}`, 0, c.thigh, legZ, 'shin'),
      bone(`foot_${side}`, `shin_${side}`, 0, c.shin, legZ, 'foot', { sx: f.footSx ?? 1, flip: side === 'l' }),
      bone(`upper_${side}`, 'chest', -o * Math.abs(f.shoulder[0]), f.shoulder[1], z, 'upper'),
      bone(`fore_${side}`, `upper_${side}`, 0, c.upper, z, 'fore'),
      bone(`hand_${side}`, `fore_${side}`, 0, c.fore, z, 'hand'),
    ];
  };
  // vũ khí: hướng nắm -> đầu chĩa lên dọc cẳng tay (về phía vai), ngả ra ngoài theo cổ tay
  const weapon = (name) => {
    const p = STICK_PARTS[name];
    const angle = Math.atan2(p.tip[1] - p.grip[1], p.tip[0] - p.grip[0]) / RAD;
    return {
      name, parent: `hand_${hand}`, x: 0, y: 0, part: `stick_${name}`, pivot: [p.grip[0] / p.w, p.grip[1] / p.h],
      rot: -angle - 90, sx: c.weaponScale, sy: c.weaponScale, z: weaponZ,
    };
  };
  return {
    prefix: '',
    bones: [
      { name: 'hip', x: 0, y: c.ankleY - c.legTop - c.thigh - c.shin },
      { name: 'chest', parent: 'hip', x: 0, y: 0 },
      ...limb('l'),
      ...limb('r'),
      ...f.body,
      ...WEAPONS.map(weapon),
    ],
    anims: makeFacingAnims(c, hand),
  };
}

// Ba góc nhìn cho DirectionalRig: side (buildBiped), front / back (buildFacing với c.front / c.back).
export const buildViews = (c) => ({ side: buildBiped(c), front: buildFacing(c, 'front', c.front), back: buildFacing(c, 'back', c.back) });

// Cầm vũ khí (id trong WEAPONS hoặc null là tay không): chỉ hiện ảnh của món đang cầm. rig: Rig hoặc DirectionalRig.
export function equipWeapon(rig, id) {
  for (const r of rig.rigs ? Object.values(rig.rigs) : [rig]) {
    for (const w of WEAPONS) r.byName[w].img.setVisible(w === id);
  }
}
// Nhát đánh hợp với món đang cầm: rìu / chùy nặng thì bổ, kiếm / tay không thì chém nhanh.
export const attackOf = (id, running) => `${running ? 'run_' : ''}${id === 'axe' || id === 'mace' ? 'chop' : 'slash'}`;

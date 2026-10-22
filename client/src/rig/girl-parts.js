// Tạo bởi tools/crop-girl.mjs, đừng sửa tay.
// Cỡ ảnh và điểm mốc (pixel, trong ảnh đã cắt) của mảnh nhân vật cô bé ở client/public/girl/<tên>.png.
// head*: neck là khớp cổ; dress: neck / hip / shoulder (vai trái khi nhìn thẳng) / shoulderSide (vai khi nhìn ngang);
// tay / chân: joint là khớp trên, len là độ dài tới khớp dưới.
export const GIRL_PARTS = {
  head: { w: 365, h: 244, neck: [170, 220] },
  head_sad: { w: 365, h: 246, neck: [177, 221] },
  head_angry: { w: 365, h: 234, neck: [168, 211] },
  head_back: { w: 365, h: 234, neck: [183, 220] },
  head_side: { w: 347, h: 229, neck: [205, 213] },
  dress: { w: 276, h: 356, neck: [141, 12], hip: [141, 322], shoulder: [69, 77], shoulderSide: [141, 77] },
  upper: { w: 39, h: 119, joint: [19.4, 21.9], len: 81.2 },
  fore: { w: 56, h: 106, joint: [24.1, 13.1], len: 58 },
  thigh: { w: 44, h: 74, joint: [23, 7], len: 59 },
  shin: { w: 62, h: 76, joint: [26, 4], len: 45 },
};

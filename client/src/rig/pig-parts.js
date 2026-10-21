// Tạo bởi tools/crop-pig.mjs, đừng sửa tay.
// Cỡ ảnh và điểm mốc (pixel, trong ảnh đã cắt) của mảnh nhân vật lợn ở client/public/pig/<tên>.png.
// body: hip / shoulder là khớp hông / vai; tay / chân: joint là khớp trên, len là độ dài tới khớp dưới.
export const PIG_PARTS = {
  body: { w: 172, h: 247, hip: [75, 227], shoulder: [85, 149] },
  body_front: { w: 189, h: 221, hip: [95, 213], shoulder: [11, 115] },
  body_back: { w: 186, h: 235, hip: [93, 228], shoulder: [10, 142] },
  upper: { w: 56, h: 76, joint: [28.3, 14.3], len: 39.3 },
  fore: { w: 58, h: 87, joint: [26.9, 9.1], len: 60.8 },
  thigh: { w: 48, h: 50, joint: [27, 8], len: 23 },
  shin: { w: 45, h: 41, joint: [21.5, 2.5], len: 27 },
};

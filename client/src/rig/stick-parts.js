// Tạo bởi tools/crop-stick.mjs, đừng sửa tay.
// Cỡ ảnh và các điểm mốc (pixel, trong ảnh đã cắt) của mảnh người que ở client/public/stick/<tên>.png.
export const STICK_PARTS = {
  head: { w: 137, h: 145, neck: [67, 141] },
  torso: { w: 103, h: 186, neck: [51, 4], hip: [51, 180] },
  sword: { w: 81, h: 368, grip: [35, 328.7], tip: [35, 7.9] },
  axe: { w: 167, h: 496, grip: [27.5, 437.9], tip: [27.5, 85.1] },
  mace: { w: 204, h: 447, grip: [108.1, 386.4], tip: [108.1, 113.3] },
};

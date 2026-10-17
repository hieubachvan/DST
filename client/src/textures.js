// Vẽ toàn bộ hình ảnh bằng code để game chạy ngay mà không cần file ảnh.
// Sau này có thể thay bằng sprite thật bằng cách load ảnh cùng key.

export const FLOWER_COLORS = [0xf6f2f0, 0xf2a7c3, 0xf5d547, 0xa7c7f2, 0xd0a2f0];

const pts = (arr) => arr.map(([x, y]) => ({ x, y }));

// Hình nào đã có sprite thật (nạp cùng key) thì bỏ qua, không vẽ đè.
export function makeTextures(scene) {
  if (scene.textures.exists('shadow')) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const gen = (key, w, h, draw) => {
    if (scene.textures.exists(key)) return;
    g.clear();
    draw(g);
    g.generateTexture(key, w, h);
  };

  gen('shadow', 40, 14, (g) => {
    g.fillStyle(0x000000, 0.28);
    g.fillEllipse(20, 7, 40, 14);
  });

  gen('tree', 70, 122, (g) => {
    g.fillStyle(0x4a321c);
    g.fillRect(31, 98, 8, 22);
    const layers = [[104, 4, 66, 40, 0x1d4529], [80, 9, 61, 20, 0x25573a], [56, 14, 56, 2, 0x2f6b45]];
    for (const [by, l, r, top, c] of layers) {
      g.fillStyle(c);
      g.fillTriangle(35, top, l, by, r, by);
      g.fillStyle(0x000000, 0.18);
      g.fillTriangle(35, top, 35, by, r, by);
    }
  });

  const sapling = (h) => (g) => {
    g.lineStyle(3, 0x6b4a2b);
    g.lineBetween(15, 40, 15, 40 - h);
    if (h > 15) {
      g.lineBetween(15, 26, 6, 12);
      g.lineBetween(15, 22, 24, 8);
      g.fillStyle(0x6c9a3a);
      for (const [x, y] of [[6, 12], [24, 8], [15, 40 - h]]) g.fillCircle(x, y, 3);
    }
  };
  gen('sapling', 30, 42, sapling(30));
  gen('sapling_picked', 30, 42, sapling(8));

  const grass = (h) => (g) => {
    const blades = [[6, -6], [11, -2], [16, 0], [21, 3], [27, 6], [14, -4], [19, 2]];
    blades.forEach(([x, lean], i) => {
      g.lineStyle(3, i % 2 ? 0xb5b04a : 0x9c9a3c);
      g.lineBetween(x, 34, x + lean * (h / 30), 34 - h + (i % 3) * 3);
    });
  };
  gen('grass', 36, 36, grass(28));
  gen('grass_picked', 36, 36, grass(6));

  const bush = (berries) => (g) => {
    g.fillStyle(0x2e5a2a);
    g.fillCircle(15, 26, 13);
    g.fillCircle(35, 26, 13);
    g.fillCircle(25, 16, 14);
    g.fillStyle(0x3d7536);
    g.fillCircle(21, 13, 6);
    g.fillCircle(31, 21, 5);
    if (berries) {
      g.fillStyle(0xc0304a);
      for (const [x, y] of [[12, 22], [22, 28], [30, 14], [38, 26], [18, 12], [33, 31]]) g.fillCircle(x, y, 3.2);
    }
  };
  gen('bush', 50, 40, bush(false));
  gen('bush_berries', 50, 40, bush(true));

  gen('boulder', 64, 48, (g) => {
    g.fillStyle(0x8d8a83);
    g.fillPoints(pts([[6, 40], [2, 26], [12, 10], [30, 3], [48, 6], [60, 20], [62, 38], [50, 46], [16, 46]]), true);
    g.fillStyle(0x6e6b65);
    g.fillPoints(pts([[36, 46], [44, 26], [60, 20], [62, 38], [50, 46]]), true);
    g.fillStyle(0xaaa69d);
    g.fillPoints(pts([[12, 12], [30, 5], [32, 14], [16, 22]]), true);
    g.fillStyle(0x55524d);
    for (const [x, y] of [[20, 32], [26, 26], [44, 14], [12, 36]]) g.fillCircle(x, y, 1.8);
  });

  gen('flint', 20, 16, (g) => {
    g.fillStyle(0x3b4350);
    g.fillTriangle(2, 15, 10, 1, 18, 15);
    g.fillStyle(0x6c7a90);
    g.fillTriangle(7, 11, 10, 4, 12, 11);
  });

  gen('carrot', 24, 28, (g) => {
    g.lineStyle(3, 0x4f8a2c);
    g.lineBetween(12, 20, 6, 4);
    g.lineBetween(12, 20, 12, 2);
    g.lineBetween(12, 20, 18, 5);
    g.fillStyle(0xe8822a);
    g.fillEllipse(12, 23, 12, 8);
  });

  FLOWER_COLORS.forEach((col, i) => {
    gen(`flower${i}`, 20, 26, (g) => {
      g.lineStyle(2, 0x4f8a2c);
      g.lineBetween(10, 26, 10, 10);
      g.fillStyle(col);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        g.fillCircle(10 + Math.cos(a) * 5, 8 + Math.sin(a) * 5, 3.5);
      }
      g.fillStyle(0xf2c230);
      g.fillCircle(10, 8, 2.5);
    });
  });

  gen('fire_base', 64, 30, (g) => {
    g.fillStyle(0x7d7a72);
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      g.fillCircle(32 + Math.cos(a) * 26, 16 + Math.sin(a) * 10, 5);
    }
    g.lineStyle(7, 0x5a3a1e);
    g.lineBetween(16, 10, 48, 22);
    g.lineBetween(16, 22, 48, 10);
  });

  gen('flame', 32, 46, (g) => {
    g.fillStyle(0xe8642a);
    g.fillCircle(16, 32, 12);
    g.fillTriangle(4, 31, 28, 31, 16, 2);
    g.fillStyle(0xf8c440);
    g.fillCircle(16, 35, 7);
    g.fillTriangle(9, 34, 23, 34, 16, 14);
  });

  // Nhân vật: ghép từ nhiều phần để thân áo có thể đổi màu theo người chơi.
  gen('p_legs', 18, 12, (g) => {
    g.fillStyle(0x3a2a20);
    g.fillRect(3, 0, 5, 12);
    g.fillRect(10, 0, 5, 12);
  });
  gen('p_body', 24, 22, (g) => {
    g.fillStyle(0xffffff);
    g.fillRoundedRect(2, 0, 20, 21, 6);
    g.fillStyle(0xcccccc);
    g.fillRect(11, 3, 2, 16);
  });
  gen('p_head', 30, 30, (g) => {
    g.fillStyle(0xf3e6d3);
    g.fillCircle(15, 15, 13);
    g.fillStyle(0x111111);
    g.fillCircle(10, 17, 2.2);
    g.fillCircle(20, 17, 2.2);
  });
  gen('p_hair', 36, 22, (g) => {
    g.fillStyle(0x15110e);
    g.fillEllipse(18, 17, 32, 10);
    const tips = [[4, 4], [10, 0], [17, 2], [23, 0], [30, 5]];
    for (const [x, y] of tips) g.fillTriangle(x - 3, 18, x + 6, 18, x + 1, y);
  });

  gen('ghost', 36, 46, (g) => {
    g.fillStyle(0xffffff);
    g.fillCircle(18, 16, 14);
    g.fillRect(4, 16, 28, 22);
    for (const x of [8, 18, 28]) g.fillCircle(x, 38, 5);
    g.fillStyle(0x111111);
    g.fillEllipse(13, 15, 4, 7);
    g.fillEllipse(23, 15, 4, 7);
    g.fillCircle(18, 25, 2.5);
  });

  gen('spider', 60, 42, (g) => {
    g.lineStyle(3, 0x141414);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const kx = 30 + side * (13 + i * 3), ky = 16 + (i - 1.5) * 7;
        g.lineBetween(30, 22, kx, ky);
        g.lineBetween(kx, ky, 30 + side * (25 + i), 30 + (i - 1.5) * 5);
      }
    }
    g.fillStyle(0x1b1b1b);
    g.fillEllipse(30, 17, 28, 24);
    g.fillStyle(0x3a3a3a);
    g.fillEllipse(30, 13, 9, 12);
    g.fillStyle(0x222222);
    g.fillCircle(30, 29, 9);
    g.fillStyle(0xff3030);
    g.fillCircle(26, 28, 2.2);
    g.fillCircle(34, 28, 2.2);
    g.fillStyle(0xf0f0f0);
    g.fillTriangle(26, 35, 29, 35, 27, 40);
    g.fillTriangle(31, 35, 34, 35, 33, 40);
  });

  gen('firepit_base', 76, 36, (g) => {
    g.fillStyle(0x3a3530);
    g.fillEllipse(38, 19, 60, 22);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      g.fillStyle(k % 2 ? 0x8f8b82 : 0x77736b);
      g.fillCircle(38 + Math.cos(a) * 32, 19 + Math.sin(a) * 13, 6);
    }
    g.lineStyle(6, 0x4a2f18);
    g.lineBetween(24, 14, 52, 24);
    g.lineBetween(24, 24, 52, 14);
  });

  gen('science', 64, 80, (g) => {
    g.fillStyle(0x6b4a2b);
    g.fillRect(10, 40, 44, 36);
    g.fillStyle(0x86603a);
    g.fillRect(10, 40, 44, 6);
    g.fillStyle(0x4a321c);
    g.fillRect(14, 50, 8, 26);
    g.fillRect(42, 50, 8, 26);
    g.fillStyle(0xd9a634);
    g.fillCircle(32, 30, 16);
    g.fillStyle(0xf2cf63);
    g.fillCircle(27, 25, 6);
    g.lineStyle(3, 0x8a6a20);
    g.lineBetween(32, 14, 32, 2);
    g.fillStyle(0xd9a634);
    g.fillCircle(32, 3, 3);
    g.fillStyle(0x9a9a9a);
    g.fillCircle(32, 60, 7);
    g.fillStyle(0x6b4a2b);
    g.fillCircle(32, 60, 3);
  });

  gen('crockpot', 60, 64, (g) => {
    g.lineStyle(5, 0x4a4540);
    g.lineBetween(14, 40, 8, 62);
    g.lineBetween(46, 40, 52, 62);
    g.lineBetween(30, 44, 30, 62);
    g.fillStyle(0x5d5a55);
    g.fillEllipse(30, 32, 48, 36);
    g.fillStyle(0x76726b);
    g.fillEllipse(30, 18, 44, 12);
    g.fillStyle(0x3d3a36);
    g.fillEllipse(30, 17, 34, 7);
    g.fillStyle(0x8d8a83);
    g.fillEllipse(22, 30, 8, 14);
  });

  gen('chest', 54, 42, (g) => {
    g.fillStyle(0x7a4f28);
    g.fillRect(4, 14, 46, 26);
    g.fillStyle(0x93622f);
    g.fillRoundedRect(4, 4, 46, 14, 6);
    g.fillStyle(0x4a2f18);
    g.fillRect(4, 17, 46, 3);
    g.fillRect(12, 4, 4, 36);
    g.fillRect(38, 4, 4, 36);
    g.fillStyle(0xd9a634);
    g.fillRect(24, 15, 6, 8);
  });

  const trap = (caught) => (g) => {
    g.fillStyle(0xb89a5a);
    g.fillTriangle(4, 30, 36, 30, 20, 4);
    g.lineStyle(1, 0x8a6f3a);
    for (let y = 10; y < 30; y += 5) g.lineBetween(20 - (y - 4) * 0.6, y, 20 + (y - 4) * 0.6, y);
    g.lineStyle(2, 0x6b4a2b);
    g.lineBetween(20, 4, 20, 0);
    if (caught) {
      g.fillStyle(0xa58a6c);
      g.fillEllipse(30, 8, 5, 14);
      g.fillEllipse(36, 10, 5, 14);
    }
  };
  gen('trap', 42, 32, trap(false));
  gen('trap_caught', 42, 32, trap(true));

  gen('rabbit', 30, 30, (g) => {
    g.fillStyle(0x9c8468);
    g.fillEllipse(17, 22, 22, 14);
    g.fillCircle(8, 16, 7);
    g.fillEllipse(5, 6, 4, 12);
    g.fillEllipse(10, 5, 4, 12);
    g.fillStyle(0xf0e8dc);
    g.fillCircle(27, 21, 3.5);
    g.fillStyle(0x111111);
    g.fillCircle(6, 15, 1.5);
  });

  gen('hound', 60, 44, (g) => {
    g.fillStyle(0x3a1414);
    g.fillRect(14, 28, 5, 14);
    g.fillRect(40, 28, 5, 14);
    g.fillEllipse(30, 24, 38, 20);
    g.fillStyle(0x5a1e1a);
    g.fillEllipse(30, 20, 30, 10);
    g.fillStyle(0x3a1414);
    g.fillCircle(50, 16, 10);
    g.fillTriangle(44, 8, 50, 0, 52, 10);
    g.fillTriangle(6, 18, 12, 22, 0, 12);
    g.fillStyle(0xffd040);
    g.fillCircle(53, 14, 2);
    g.fillStyle(0xf0f0f0);
    g.fillTriangle(54, 22, 57, 22, 55, 27);
  });

  gen('pig', 48, 36, (g) => {
    g.fillStyle(0x7a4a32);
    g.fillRect(12, 24, 5, 10);
    g.fillRect(31, 24, 5, 10);
    g.fillStyle(0xa8684a);
    g.fillEllipse(24, 20, 36, 22);
    g.fillCircle(40, 16, 9);
    g.fillStyle(0xd89a80);
    g.fillEllipse(46, 18, 6, 6);
    g.fillStyle(0x111111);
    g.fillCircle(40, 12, 1.5);
  });

  gen('beefalo', 72, 64, (g) => {
    g.fillStyle(0x3a2a1c);
    g.fillRect(16, 46, 7, 16);
    g.fillRect(48, 46, 7, 16);
    g.fillStyle(0x6b5038);
    g.fillEllipse(36, 34, 58, 38);
    g.fillCircle(60, 26, 14);
    g.lineStyle(4, 0xe8dcc0);
    g.lineBetween(54, 14, 48, 2);
    g.lineBetween(66, 14, 70, 2);
    g.fillStyle(0x111111);
    g.fillCircle(62, 24, 2);
  });

  gen('tent', 80, 84, (g) => {
    g.fillStyle(0xb39257);
    g.fillTriangle(40, 4, 4, 80, 76, 80);
    g.fillStyle(0x000000, 0.2);
    g.fillTriangle(40, 4, 40, 80, 76, 80);
    g.fillStyle(0x3a2a1c);
    g.fillTriangle(40, 40, 28, 80, 52, 80);
  });

  gen('dryingrack', 70, 70, (g) => {
    g.lineStyle(5, 0x5b3d22);
    g.lineBetween(8, 68, 12, 6);
    g.lineBetween(62, 68, 58, 6);
    g.lineBetween(6, 10, 64, 10);
    g.fillStyle(0x9a3a30);
    g.fillEllipse(35, 30, 16, 26);
  });

  gen('gnoise', 128, 128, (g) => {
    for (let i = 0; i < 260; i++) {
      g.fillStyle(i % 2 ? 0x000000 : 0xffffff, i % 2 ? 0.08 : 0.05);
      g.fillRect(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }
  });

  g.destroy();

  // Ánh sáng: gradient tròn dùng để "khoét" lớp bóng tối.
  if (scene.textures.exists('light')) return;
  const light = scene.textures.createCanvas('light', 256, 256);
  const ctx = light.getContext();
  const grd = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.55, 'rgba(255,255,255,0.85)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 256, 256);
  light.refresh();
}

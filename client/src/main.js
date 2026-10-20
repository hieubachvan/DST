import Phaser from 'phaser';
import { io } from 'socket.io-client';
import { GameScene } from './GameScene.js';
import { Hud } from './hud.js';
import { Lobby } from './lobby.js';
import { loadArt, loadRigs } from './art.js';
import './style.css';

// Nạp danh sách sprite trước, vì giao diện cần biết món nào có hình.
await Promise.all([loadArt(), loadRigs(['bearger'])]);

const socket = io();
const hud = new Hud(socket);

// Mã bí mật nhận diện nhân vật của trình duyệt này (lưu trong máy, không gửi cho người khác).
function playerToken() {
  try {
    let t = localStorage.getItem('ds-token');
    if (!t) {
      t = crypto.randomUUID?.().replaceAll('-', '') ?? Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
      localStorage.setItem('ds-token', t);
    }
    return t;
  } catch {
    return null;
  }
}

const lobby = new Lobby((serverId, passcode, name, char) => {
  socket.emit('join', { serverId, passcode, name, char, token: playerToken() });
});
let game = null;

// Vào thẳng game bằng link dạng ?server=<id>&pass=<passcode>&name=<tên>
const params = new URLSearchParams(location.search);
if (params.get('server') && params.get('pass')) {
  lobby.autoJoin(params.get('server'), params.get('pass'), params.get('name') || '');
}

socket.on('join:error', ({ message }) => lobby.error(message));

socket.on('init', (init) => {
  if (game) return;
  lobby.joined();
  hud.serverName = init.serverName;
  hud.setWorld(init.settings);
  document.getElementById('login').hidden = true;
  hud.show();
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#1b2a1f',
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  });
  game.scene.add('game', GameScene, true, { socket, hud, init });
});

// Khi xoay điện thoại, Phaser đôi khi đã ghi nhận cỡ khung mới nhưng không đổi cỡ canvas
// (một phần màn hình bị đen). Tự kiểm tra lại sau mỗi lần đổi cỡ / xoay và ép cập nhật nếu lệch.
function fixGameSize() {
  if (!game) return;
  const s = game.scale;
  const r = document.getElementById('game').getBoundingClientRect();
  if (Math.round(r.width) === Math.round(s.gameSize.width) && Math.round(r.height) === Math.round(s.gameSize.height)) return;
  s.getParentBounds();
  s.refresh();
}
for (const [ev, ms] of [['resize', 150], ['orientationchange', 400]]) {
  window.addEventListener(ev, () => setTimeout(fixGameSize, ms));
}
window.visualViewport?.addEventListener('resize', () => setTimeout(fixGameSize, 150));

socket.on('connect_error', () => {
  if (!game) document.getElementById('login-status').textContent = 'Không kết nối được máy chủ, đang thử lại...';
});

socket.on('kicked', (d) => hud.disconnected(d?.reason));

socket.on('disconnect', () => {
  if (game) hud.disconnected();
});

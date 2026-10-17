// Âm thanh: nhạc nền chơi liên tục, và một đoạn nhạc ngắn khi trời sáng / chạng vạng.
// Dùng Web Audio: nhạc nền được cắt bỏ khoảng lặng ở hai đầu rồi nối các vòng bằng crossfade,
// nên không bị hụt hay im lặng mỗi lần lặp lại (file nhạc nền chỉ dài khoảng 30 giây).
// Trình duyệt chỉ cho phát âm thanh sau lần chạm / bấm phím đầu tiên, nên nhạc bắt đầu từ lúc đó.
const SOUND_URL = '/sounds/';
const MUSIC_VOL = 0.35;
const CUE_VOL = 0.8;
const DUCK_VOL = 0.08; // nhạc nền nhỏ lại trong lúc phát đoạn nhạc chuyển buổi
const CUES = { day: 'dawn', dusk: 'dusk' };
const SILENCE = 0.004; // biên độ dưới mức này coi là im lặng
const XFADE = 2.5; // giây chồng lên nhau giữa hai vòng nhạc nền
const LOOKAHEAD = 4; // lên lịch trước vòng nhạc kế tiếp chừng này giây

// Đoạn có tiếng trong buffer: bỏ khoảng lặng ở đầu và cuối.
function trim(buf) {
  const data = buf.getChannelData(0);
  let a = 0, b = data.length - 1;
  while (a < b && Math.abs(data[a]) < SILENCE) a++;
  while (b > a && Math.abs(data[b]) < SILENCE) b--;
  return { start: a / buf.sampleRate, len: (b - a) / buf.sampleRate };
}

export class Sound {
  constructor() {
    this.muted = false;
    try { this.muted = localStorage.getItem('ds-muted') === '1'; } catch {}
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    if (this.muted) this.ctx.suspend().catch(() => {});
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = MUSIC_VOL;
    this.musicGain.connect(this.master);
    this.buffers = {};
    this.nextAt = 0;
    this.load('theme').then(() => this.startMusic());
    for (const name of Object.values(CUES)) this.load(name);

    // Chạm / bấm phím: mở khóa âm thanh lần đầu, và đánh thức lại nếu trình duyệt đã tạm dừng
    // (điện thoại tắt màn hình, chuyển app, có cuộc gọi...).
    const wake = () => this.resume();
    for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, wake, true);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.resume(); });
    setInterval(() => this.schedule(), 500);
  }

  async load(name) {
    try {
      const data = await (await fetch(`${SOUND_URL}${name}.mp3`)).arrayBuffer();
      // Dạng callback để chạy được cả trên Safari cũ (không trả về Promise)
      const buf = await new Promise((ok, fail) => this.ctx.decodeAudioData(data, ok, fail));
      this.buffers[name] = { buf, ...trim(buf) };
    } catch (err) {
      console.warn('Không tải được âm thanh', name, err);
    }
  }

  resume() {
    if (!this.ctx || this.muted || this.ctx.state === 'running') return;
    this.ctx.resume().then(() => this.schedule()).catch(() => {});
  }

  startMusic() {
    if (!this.buffers.theme) return;
    this.nextAt = 0;
    this.schedule();
  }

  // Lên lịch các vòng nhạc nền nối tiếp nhau, vòng sau bắt đầu trước khi vòng trước kết thúc.
  // Khi âm thanh đang tạm dừng thì đồng hồ của AudioContext đứng yên, nên không lên lịch thêm.
  schedule() {
    const m = this.buffers?.theme;
    if (!m || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this.nextAt < now) this.nextAt = now + 0.05; // lần đầu, hoặc vừa được đánh thức lại
    const x = Math.min(XFADE, m.len / 4);
    while (this.nextAt - now < LOOKAHEAD) {
      const at = this.nextAt;
      const src = this.ctx.createBufferSource();
      const g = this.ctx.createGain();
      src.buffer = m.buf;
      src.connect(g).connect(this.musicGain);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(1, at + x);
      g.gain.setValueAtTime(1, at + m.len - x);
      g.gain.linearRampToValueAtTime(0, at + m.len);
      src.start(at, m.start, m.len);
      this.nextAt = at + m.len - x;
    }
  }

  // Đổi buổi trong ngày: phát đoạn nhạc tương ứng, nhạc nền nhỏ lại rồi to dần trở lại.
  phase(ph) {
    const c = this.buffers?.[CUES[ph]];
    if (!c || this.muted || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.value = CUE_VOL;
    src.buffer = c.buf;
    src.connect(g).connect(this.master);
    src.start(now, c.start, c.len);
    const vol = this.musicGain.gain;
    vol.cancelScheduledValues(now);
    vol.setValueAtTime(vol.value, now);
    vol.linearRampToValueAtTime(DUCK_VOL, now + 0.6);
    vol.setValueAtTime(DUCK_VOL, now + c.len - 1);
    vol.linearRampToValueAtTime(MUSIC_VOL, now + c.len + 1.5);
  }

  setMuted(muted) {
    this.muted = muted;
    try { localStorage.setItem('ds-muted', muted ? '1' : '0'); } catch {}
    if (!this.ctx) return;
    if (muted) this.ctx.suspend().catch(() => {});
    else this.resume();
  }
}

// Âm thanh: nhạc nền chơi liên tục, một đoạn nhạc ngắn khi trời sáng / chạng vạng, và hiệu ứng (tiếng boss...).
// Dùng Web Audio: nhạc nền được cắt bỏ khoảng lặng ở hai đầu rồi nối các vòng bằng crossfade,
// nên không bị hụt hay im lặng mỗi lần lặp lại (file nhạc nền chỉ dài khoảng 30 giây).
// Trình duyệt chỉ cho phát âm thanh sau lần chạm / bấm phím đầu tiên, nên nhạc bắt đầu từ lúc đó.
const SOUND_URL = '/sounds/';
const MUSIC_VOL = 0.15; // nhỏ để nghe rõ tiếng bước chân, chặt cây, đào đá...
const CUE_VOL = 0.8;
const DUCK_VOL = 0.04; // nhạc nền nhỏ lại trong lúc phát đoạn nhạc chuyển buổi
const CUES = { day: 'dawn', dusk: 'dusk' };
// Hiệu ứng âm thanh: tên -> [file trong /sounds/, âm lượng riêng].
// Các file .mp3 được cắt và chuẩn hóa âm lượng từ file gốc trong assets/sounds/
// (một nhát chặt, một cú đập đá, ~4 giây bước chân lặp được, một tiếng bẻ cành...).
const SFX = {
  deerclops_voice: ['deerclops_voice.ogg', 1],
  deerclops_boom: ['deerclops_boom.ogg', 1],
  chop: ['chop.mp3', 0.8],
  mine: ['mine.mp3', 0.45],
  run: ['run.mp3', 0.5],
  twig: ['twig.mp3', 0.9],
  rustle: ['rustle.mp3', 0.45],
  pickup: ['pickup.mp3', 0.7],
};
const SFX_VOL = 0.9;
const LOOP_FADE = 0.12; // giây to dần / nhỏ dần khi bật / tắt âm thanh lặp
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
    for (const [name, [file]] of Object.entries(SFX)) this.load(name, file);
    this.loops = {}; // tên -> { src, g } của âm thanh lặp đang phát

    // Chạm / bấm phím: mở khóa âm thanh lần đầu, và đánh thức lại nếu trình duyệt đã tạm dừng
    // (điện thoại tắt màn hình, chuyển app, có cuộc gọi...).
    const wake = () => this.resume();
    for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, wake, true);
    // Ẩn tab thì game ngừng cập nhật, nên phải tự tắt tiếng lặp (bước chân) kẻo nó kêu mãi trong nền.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.resume();
      else for (const name of Object.keys(this.loops)) this.loop(name, false);
    });
    setInterval(() => this.schedule(), 500);
  }

  async load(name, file = `${name}.mp3`) {
    try {
      const data = await (await fetch(`${SOUND_URL}${file}`)).arrayBuffer();
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

  // Phát một hiệu ứng âm thanh, vol từ 0 đến 1 (giảm theo khoảng cách do nơi gọi tính), rate: tốc độ / cao độ.
  sfx(name, vol = 1, rate = 1) {
    const c = this.buffers?.[name];
    if (!c || this.muted || this.ctx.state !== 'running') return;
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.value = SFX_VOL * SFX[name][1] * vol;
    src.buffer = c.buf;
    src.playbackRate.value = rate;
    src.connect(g).connect(this.master);
    src.start(this.ctx.currentTime, c.start, c.len);
  }

  // Bật / tắt một âm thanh lặp (tiếng bước chân). Gọi mỗi khung hình được, chỉ đổi khi trạng thái khác đi.
  loop(name, on) {
    const cur = this.loops?.[name];
    if (!this.ctx || !!cur === on) return;
    const now = this.ctx.currentTime;
    if (!on) {
      cur.g.gain.cancelScheduledValues(now);
      cur.g.gain.setValueAtTime(cur.g.gain.value, now);
      cur.g.gain.linearRampToValueAtTime(0, now + LOOP_FADE);
      cur.src.stop(now + LOOP_FADE + 0.02);
      delete this.loops[name];
      return;
    }
    const c = this.buffers[name];
    if (!c || this.muted || this.ctx.state !== 'running') return; // chưa sẵn sàng: khung hình sau thử lại
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    src.buffer = c.buf;
    src.loop = true;
    src.loopStart = c.start;
    src.loopEnd = c.start + c.len;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(SFX_VOL * SFX[name][1], now + LOOP_FADE);
    src.connect(g).connect(this.master);
    src.start(now, c.start);
    this.loops[name] = { src, g };
  }

  setMuted(muted) {
    this.muted = muted;
    try { localStorage.setItem('ds-muted', muted ? '1' : '0'); } catch {}
    if (!this.ctx) return;
    if (muted) this.ctx.suspend().catch(() => {});
    else this.resume();
  }
}

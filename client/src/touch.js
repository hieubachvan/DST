// Điều khiển cảm ứng cho điện thoại / máy tính bảng: cần điều khiển ảo và các nút giữ để hành động.
// Chế độ cảm ứng tự bật khi máy dùng màn hình cảm ứng làm chính, hoặc ngay khi người chơi chạm vào màn hình.
// Thử trên máy tính: thêm ?touch=1 vào địa chỉ (hoặc ?touch=0 để tắt hẳn).

const $ = (id) => document.getElementById(id);

export class Controls {
  constructor() {
    this.joy = { x: 0, y: 0 }; // hướng của cần điều khiển, độ dài 0..1
    this.gather = false; // đang giữ nút thu thập
    this.attack = false; // đang giữ nút tấn công
    this.touch = false;
    this.listeners = [];

    const forced = new URLSearchParams(location.search).get('touch');
    this.forced = forced === '1' || forced === '0';
    this.setTouch(forced === '1' || (forced !== '0' && matchMedia('(pointer: coarse)').matches));
    if (!this.forced) {
      // Máy vừa có chuột vừa có cảm ứng: đổi chế độ theo thứ người chơi vừa dùng.
      window.addEventListener('pointerdown', (e) => this.setTouch(e.pointerType !== 'mouse'), { capture: true, passive: true });
    }

    this.bindJoystick();
    this.bindHold('act-gather', 'gather');
    this.bindHold('act-attack', 'attack');
    this.bindFullscreen();
    this.bindPadToggle();

    // Chặn phóng to bằng hai ngón / chạm đúp trên iOS.
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  onChange(fn) { this.listeners.push(fn); }

  setTouch(on) {
    if (on === this.touch) return;
    this.touch = on;
    document.body.classList.toggle('touch', on);
    if (!on) this.release();
    for (const fn of this.listeners) fn(on);
  }

  // Thả hết nút (khi chuyển chế độ, mở bảng hướng dẫn, ...).
  release() {
    this.joy = { x: 0, y: 0 };
    this.gather = this.attack = false;
    $('joy-knob').style.transform = '';
    for (const id of ['joy', 'act-gather', 'act-attack']) $(id).classList.remove('on');
  }

  bindJoystick() {
    const base = $('joy');
    const knob = $('joy-knob');
    let id = null;
    const move = (e) => {
      const r = base.getBoundingClientRect();
      const max = r.width / 2 - 12;
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy);
      if (d > max) { dx *= max / d; dy *= max / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      // Vùng chết nhỏ ở giữa để chạm nhẹ không làm nhân vật trôi.
      this.joy = Math.hypot(dx, dy) < max * 0.2 ? { x: 0, y: 0 } : { x: dx / max, y: dy / max };
    };
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      this.joy = { x: 0, y: 0 };
      knob.style.transform = '';
      base.classList.remove('on');
    };
    base.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      e.preventDefault();
      id = e.pointerId;
      base.setPointerCapture(id);
      base.classList.add('on');
      move(e);
    });
    base.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) base.addEventListener(ev, end);
  }

  bindHold(elId, key) {
    const el = $(elId);
    const off = () => { this[key] = false; el.classList.remove('on'); };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      this[key] = true;
      el.classList.add('on');
    });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, off);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Nút 🕹️: bật / tắt cần điều khiển và nút ✋ ⚔️. Mặc định tắt cho rộng màn hình,
  // vì chạm vào mặt đất / vật đã đủ để đi và tương tác. Chỉ lưu khi người chơi tự bấm.
  get padVisible() { return !document.body.classList.contains('pad-hidden'); }

  setPad(visible, save = false) {
    document.body.classList.toggle('pad-hidden', !visible);
    $('tb-pad').classList.toggle('on', visible);
    if (!visible) this.release();
    if (save) try { localStorage.setItem('ds-pad', visible ? 'show' : 'hide'); } catch {}
  }

  bindPadToggle() {
    let visible = false;
    try { visible = localStorage.getItem('ds-pad') === 'show'; } catch {}
    this.setPad(visible);
    $('tb-pad').addEventListener('click', () => this.setPad(!this.padVisible, true));
  }

  bindFullscreen() {
    const btn = $('tb-full');
    const root = document.documentElement;
    if (!document.fullscreenEnabled || !root.requestFullscreen) {
      btn.hidden = true; // iPhone Safari không hỗ trợ toàn màn hình cho trang web
      return;
    }
    btn.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else root.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    });
    document.addEventListener('fullscreenchange', () => btn.classList.toggle('on', !!document.fullscreenElement));
  }
}

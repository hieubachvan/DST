import {
  ITEMS, RECIPES, CATEGORIES, STATIONS, GEAR_SLOTS, GEAR_NAMES, INV_SIZE, MAX_PACK, CHEST_SIZE,
  MAX_HP, MAX_HUNGER, MAX_SANITY, POISON, phaseAt,
} from '../../shared/data.js';
import { PRESETS, sanitizeSettings, clockOf, presetOf, settingsHtml, durationText } from '../../shared/settings.js';
import { iconHtml, spriteImg } from './art.js';
import { Controls } from './touch.js';
import { Sound } from './audio.js';

const LONG_PRESS_MS = 420;
const DRAG_PX = 8; // rê quá chừng này (pixel) từ chỗ bấm thì thành kéo đồ, không còn là bấm / giữ lâu

const PHASE_NAMES = { day: 'Ban ngày', dusk: 'Chạng vạng', night: 'Ban đêm' };
const GEAR_EMPTY = { hand: '✋', head: '🎩', body: '👕' };
const $ = (id) => document.getElementById(id);
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const recipeName = (r) => r.name ?? ITEMS[r.id].name;
const recipeIcon = (r) => iconHtml(r.id, r.icon ?? ITEMS[r.id]?.icon);
const mini = (id) => iconHtml(id).replace('class="ic', 'class="mini');

// Chữ để tìm kiếm: bỏ dấu, chữ thường, để gõ "da lua" cũng ra "Đá lửa".
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/\s+/g, ' ');
// Các mục hướng dẫn có dữ liệu để tìm kiếm.
const SEARCH_TABS = new Set(['craft', 'res', 'food']);

// Độ tươi còn lại (1 = mới, 0 = sắp hỏng; với đồ ôi thiu là sắp biến mất).
const freshness = (it) => Math.max(0, 1 - (it.age ?? 0) / ITEMS[it.id].perish);

function itemHtml(it) {
  const def = ITEMS[it.id];
  let html = iconHtml(it.id);
  if (it.count > 1) html += `<span class="cnt">${it.count}</span>`;
  if (def.uses) html += `<span class="dur"><i style="width:${Math.max(0, (it.dur / def.uses) * 100)}%"></i></span>`;
  if (def.perish) {
    const f = freshness(it);
    html += `<span class="dur"><i class="${f < 0.25 ? 'bad' : f < 0.5 ? 'warn' : ''}" style="width:${Math.round(f * 100)}%"></i></span>`;
  }
  return html;
}

// Thông số của món đồ (dùng cho chú thích khi rê chuột và menu trên điện thoại).
function itemInfo(it) {
  const def = ITEMS[it.id];
  const lines = [];
  if (def.food) lines.push(`No +${def.food.hunger} · Máu ${def.food.health >= 0 ? '+' : ''}${def.food.health}${def.food.sanity ? ` · Tinh thần ${def.food.sanity}` : ''}`);
  if (def.armor) lines.push(`Chặn ${Math.round(def.armor * 100)}% sát thương`);
  if (def.damage) lines.push(`Sát thương ${def.damage}`);
  if (def.uses) lines.push(`Độ bền ${Math.max(0, Math.round((it.dur / def.uses) * 100))}%`);
  if (def.perish) lines.push(it.id === 'rotten' ? `Sắp biến mất (${Math.round(freshness(it) * 100)}%)` : `Độ tươi ${Math.round(freshness(it) * 100)}%`);
  if (def.pack) lines.push(`Thêm ${def.pack} ô đồ${it.slots?.some(Boolean) ? ' · đang chứa đồ' : ''}`);
  if (def.speed) lines.push(`Đeo vào đi chậm ${Math.round((1 - def.speed) * 100)}%`);
  if (def.fuel) lines.push(`Củi: +${def.fuel} giây`);
  if (def.poison) lines.push(`Gây độc: quái mất thêm ${POISON.mob} máu trong ${POISON.ms / 1000} giây (boss chịu một nửa)`);
  if (def.cures) lines.push('Chữa khỏi trúng độc');
  if (def.hint) lines.push(`Cách dùng: ${def.hint}`);
  return lines;
}

// Việc làm khi bấm (chuột trái / chạm) vào món đồ trong túi.
function primaryAction(def, chestOpen) {
  return chestOpen ? 'Cất vào rương'
    : def.slot ? `Trang bị (ô ${GEAR_NAMES[def.slot]})` : def.food ? 'Ăn' : def.plant ? 'Trồng xuống đất cạnh bạn'
    : def.fuel ? 'Thêm vào lửa (khi đứng gần)' : null;
}

function itemTitle(it, chestOpen) {
  const def = ITEMS[it.id];
  const lines = [def.name, ...itemInfo(it).filter((l) => !l.startsWith('Độ bền'))];
  const left = primaryAction(def, chestOpen);
  if (left) lines.push(`Chuột trái: ${left}`);
  lines.push(def.food && /meat|morsel|jerky/.test(it.id) ?'Kéo: đổi chỗ, hoặc thả vào lợn để cho ăn' : 'Kéo: đổi chỗ');
  const right = [];
  if (def.dry) right.push('Phơi (khi gần Giàn phơi)');
  if (def.cook) right.push(def.food ? 'Nướng (khi gần lửa)' : `Đốt thành ${ITEMS[def.cook].name} (khi gần lửa)`);
  right.push(right.length ? 'Vứt' : 'Vứt xuống đất');
  lines.push(`Chuột phải: ${right.join(' / ')}`);
  return lines.join('\n');
}

export class Hud {
  constructor(socket) {
    this.socket = socket;
    this.inv = Array(INV_SIZE).fill(null);
    this.gear = { hand: null, head: null, body: null };
    this.stations = new Set();
    this.clock = clockOf(null); // đồng hồ mặc định, đổi theo thế giới khi vào game (setWorld)
    this.cat = CATEGORIES[0].id;
    this.chestId = null;
    this.typing = false;
    this.deathTimer = null;
    this.controls = new Controls();
    this.controls.onChange((touch) => this.onTouchMode(touch));

    // Các ô sau INV_SIZE là ô ba lô, chỉ hiện khi đang đeo ba lô.
    // Chạm: dùng ngay. Giữ lâu (cảm ứng): mở menu nướng / phơi / vứt. Chuột phải (máy tính): như cũ.
    // Kéo (chuột hay ngón tay): thả lên ô khác để đổi chỗ / gộp, thả vào lợn để cho ăn, thả vào rương để cất.
    this.slots = [];
    for (let i = 0; i < INV_SIZE + MAX_PACK; i++) {
      const el = document.createElement('div');
      el.className = 'slot';
      let timer = null;
      let longPressed = false;
      let pointer = 'mouse';
      let press = null; // { x, y, id }: đang bấm giữ ô này, chưa biết là bấm hay kéo
      let dragged = false;
      el.addEventListener('pointerdown', (e) => {
        pointer = e.pointerType;
        longPressed = false;
        dragged = false;
        clearTimeout(timer);
        if (!this.inv[i] || e.button !== 0) return;
        press = { x: e.clientX, y: e.clientY, id: e.pointerId };
        el.setPointerCapture(e.pointerId);
        if (pointer === 'mouse') return;
        timer = setTimeout(() => {
          longPressed = true;
          press = null;
          navigator.vibrate?.(15);
          this.openSheet(i);
        }, LONG_PRESS_MS);
      });
      // Rê quá DRAG_PX thì bắt đầu kéo; từ đó startDrag nghe di chuyển / thả trên cả cửa sổ.
      el.addEventListener('pointermove', (e) => {
        if (!press || e.pointerId !== press.id || this.drag) return;
        if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < DRAG_PX) return;
        clearTimeout(timer);
        dragged = true; // để cú click sau khi thả không dùng món đồ
        this.startDrag(i, e.pointerId);
        this.moveDrag(e.clientX, e.clientY);
      });
      for (const ev of ['pointerup', 'pointercancel']) {
        el.addEventListener(ev, () => {
          clearTimeout(timer);
          press = null;
        });
      }
      el.addEventListener('click', () => {
        if (longPressed || dragged) return;
        socket.emit(this.chestId ? 'chest:store' : 'use', { slot: i });
      });
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        // Android coi giữ lâu là chuột phải: bỏ qua, vì giữ lâu đã mở menu.
        if (pointer === 'mouse') socket.emit('alt', { slot: i });
      });
      $(i < INV_SIZE ? 'inv' : 'pack').appendChild(el);
      this.slots.push(el);
    }
    this.sheetSlot = null;
    document.addEventListener('pointerdown', (e) => {
      if (this.sheetSlot !== null && !$('sheet').contains(e.target)) this.closeSheet();
    }, true);

    // Chiều cao thanh túi đồ, để đặt các nút điều khiển, chat, rương ngay phía trên nó.
    new ResizeObserver(() => {
      document.documentElement.style.setProperty('--bar-h', `${$('bar').offsetHeight}px`);
    }).observe($('bar'));

    // Thanh nút trên cùng
    this.setCraftOpen(this.craftPref());
    $('tb-craft').addEventListener('click', () => this.setCraftOpen(!$('craft').classList.contains('open'), true));
    $('craft-close').addEventListener('click', () => this.setCraftOpen(false, true));
    $('tb-chat').addEventListener('click', () => this.toggleChat());
    this.minimap = null; // GameScene gắn vào khi đã vào game
    $('tb-map').addEventListener('click', () => this.minimap?.toggle());
    this.sound = new Sound();
    this.renderSoundBtn();
    $('tb-sound').addEventListener('click', () => this.toggleSound());
    $('roster').addEventListener('click', () => $('roster').classList.toggle('open'));

    this.gearEls = {};
    for (const s of GEAR_SLOTS) {
      const el = document.createElement('div');
      el.className = 'slot equip';
      el.dataset.empty = GEAR_EMPTY[s];
      el.addEventListener('click', () => socket.emit('unequip', { slot: s }));
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      $('gear').appendChild(el);
      this.gearEls[s] = el;
    }

    this.chestEls = [];
    for (let i = 0; i < CHEST_SIZE; i++) {
      const el = document.createElement('div');
      el.className = 'slot';
      el.addEventListener('click', () => socket.emit('chest:take', { slot: i }));
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      $('chest-slots').appendChild(el);
      this.chestEls.push(el);
    }
    $('chest-close').addEventListener('click', () => this.closeChest());

    this.catEls = CATEGORIES.map((c) => {
      const el = document.createElement('button');
      el.title = c.name;
      el.textContent = c.icon;
      el.addEventListener('click', () => {
        this.cat = c.id;
        this.render();
      });
      $('craft-tabs').appendChild(el);
      return el;
    });

    const chatin = $('chatin');
    if (this.controls.touch) chatin.placeholder = 'Nhập tin nhắn...';
    chatin.addEventListener('focus', () => { this.typing = true; });
    chatin.addEventListener('blur', () => { this.typing = false; });
    // Gửi bằng form để phím "Gửi" trên bàn phím điện thoại cũng hoạt động.
    $('chatform').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = chatin.value.trim();
      if (text) this.socket.emit('chat', { text });
      chatin.value = '';
      chatin.blur();
    });
    document.addEventListener('keydown', (e) => this.onKey(e));

    this.buildGuide();

    socket.on('inv', (d) => {
      this.inv = d.inv;
      this.gear = d.gear;
      this.render();
    });
    socket.on('me', (s) => this.setStats(s));
    socket.on('chat', (m) => this.addChat(m));
    socket.on('roster', (r) => this.setRoster(r));
    socket.on('died', (d) => this.showDeath(d));
    socket.on('respawned', () => this.hideDeath());
    socket.on('warn', (w) => this.warn(w));

    // Huy hiệu chỉ số dùng hình thật nếu có
    for (const [id, key] of [['st-hp', 'ui_health'], ['st-hunger', 'ui_hunger'], ['st-sanity', 'ui_sanity']]) {
      const img = spriteImg(key, 'badge');
      if (img) {
        $(id).querySelector('span').outerHTML = img;
        $(id).classList.add('has-badge');
      }
    }

    this.render();
  }

  show() {
    $('hud').hidden = false;
    let seen = false;
    try {
      seen = localStorage.getItem('ds-guide-seen') === '1';
      localStorage.setItem('ds-guide-seen', '1');
    } catch {}
    if (!seen) this.toggleGuide(true);
  }

  // Bàn phím/chuột bị chặn khi đang chat hoặc đang mở hướng dẫn.
  get busy() { return this.typing || !$('guide').hidden; }

  // ---------- Hướng dẫn ----------

  buildGuide() {
    const usedIn = (id) => RECIPES.filter((r) => r.needs[id]).map(recipeName);
    const sign = (n) => (n > 0 ? `+${n}` : `${n}`);
    const card = (r) => {
      const def = ITEMS[r.id] ?? {};
      const stats = [];
      if (def.damage) stats.push(`Sát thương ${def.damage}`);
      if (def.armor) stats.push(`Chặn ${Math.round(def.armor * 100)}% sát thương`);
      if (def.food) stats.push(`No +${def.food.hunger} · Máu ${sign(def.food.health)} · Tinh thần ${sign(def.food.sanity)}`);
      if (def.uses) stats.push(def.burns ? `Dùng được ${def.uses} giây` : def.armor ? `Bền ${def.uses}` : `Dùng được ${def.uses} lần`);
      if (def.pack) stats.push(`Thêm ${def.pack} ô đồ`);
      if (def.speed) stats.push(`Đi chậm ${Math.round((1 - def.speed) * 100)}%`);
      if (r.place) stats.push('Đặt ngay xuống đất cạnh bạn');
      const needs = Object.entries(r.needs).map(([id, n]) => {
        const src = ITEMS[id].from ?? (RECIPES.some((x) => x.id === id) ? 'Chế tạo ở nhóm Tinh chế' : '');
        return `<li>${mini(id)} <b>${n} ${ITEMS[id].name}</b><small>${src}</small></li>`;
      });
      const lock = r.station ? `<p class="g-lock">🔒 Phải đứng gần ${STATIONS[r.station].name}</p>` : '';
      return `<div class="g-card"><div class="g-head"><span class="ic">${recipeIcon(r)}</span><div><b>${recipeName(r)}</b><p>${r.desc}</p>${stats.length ? `<small>${stats.join(' · ')}</small>` : ''}</div></div>${lock}<ul>${needs.join('')}</ul></div>`;
    };

    $('guide-recipes').innerHTML = CATEGORIES.map((c) => {
      const list = RECIPES.filter((r) => r.cat === c.id);
      return `<div class="g-cat" data-cat="${c.id}"><h3>${c.icon} ${c.name}</h3><div class="g-grid">${list.map(card).join('')}</div></div>`;
    }).join('');
    $('guide-cats').innerHTML = [{ id: 'all', name: 'Tất cả', icon: '📋' }, ...CATEGORIES]
      .map((c) => `<button type="button" data-cat="${c.id}">${c.icon} ${c.name}</button>`).join('');

    $('guide-res').innerHTML = `<table class="g-table"><tr><th>Nguyên liệu</th><th>Lấy ở đâu</th><th>Dùng để làm</th></tr>${
      Object.entries(ITEMS).filter(([, d]) => d.from && !d.food).map(([id, d]) => {
        const uses = usedIn(id);
        if (d.fuel) uses.push(`Củi (+${d.fuel} giây)`);
        return `<tr><td>${mini(id)} ${d.name}</td><td>${d.from}</td><td>${uses.join(', ') || '—'}</td></tr>`;
      }).join('')
    }</table>`;

    $('guide-food').innerHTML = `<table class="g-table"><tr><th>Món</th><th>Độ no</th><th>Máu</th><th>Tinh thần</th><th>Ghi chú</th></tr>${
      Object.entries(ITEMS).filter(([, d]) => d.food).map(([id, d]) => {
        const f = d.food;
        const recipe = RECIPES.find((r) => r.id === id);
        const notes = [];
        if (d.cook) notes.push(`Nướng thành ${mini(d.cook)} ${ITEMS[d.cook].name}`);
        if (d.dry) notes.push(`Phơi thành ${mini(d.dry)} ${ITEMS[d.dry].name}`);
        const note = notes.length ? notes.join(' · ')
          : d.dryTime ? `Phơi trên Giàn phơi (${d.dryTime} giây)`
          : recipe?.station === 'crockpot' ? 'Nấu ở Nồi nấu'
          : recipe ? 'Chế tạo'
          : d.from ?? 'Nướng trên lửa mà có';
        const cell = (n) => `<td class="${n > 0 ? 'ok' : n < 0 ? 'no' : ''}">${n ? sign(n) : '—'}</td>`;
        return `<tr><td>${mini(id)} ${d.name}</td>${cell(f.hunger)}${cell(f.health)}${cell(f.sanity)}<td>${note}</td></tr>`;
      }).join('')
    }</table>`;

    // Chữ tìm kiếm của từng thẻ công thức / dòng bảng: toàn bộ nội dung đã bỏ dấu.
    for (const el of document.querySelectorAll('#guide .g-card, #guide .g-table tr')) {
      if (el.tagName !== 'TR' || el.querySelector('td')) el.dataset.q = norm(el.textContent);
    }

    this.guideTab = 'start';
    this.guideCat = 'all';
    for (const btn of document.querySelectorAll('#guide-tabs button')) {
      btn.addEventListener('click', () => {
        this.guideTab = btn.dataset.tab;
        $('guide-search').value = '';
        this.filterGuide();
      });
    }
    for (const btn of document.querySelectorAll('#guide-cats button')) {
      btn.addEventListener('click', () => {
        this.guideCat = btn.dataset.cat;
        this.filterGuide();
      });
    }
    $('guide-search').addEventListener('input', () => this.filterGuide());
    this.filterGuide();
    $('guide-btn').addEventListener('click', () => this.toggleGuide());
    $('lobby-guide').addEventListener('click', () => this.toggleGuide(true));
    document.querySelector('.guide-close').addEventListener('click', () => this.toggleGuide(false));
    $('guide').addEventListener('click', (e) => { if (e.target.id === 'guide') this.toggleGuide(false); });
  }

  // Đang gõ tìm kiếm thì hiện kết quả của mọi mục có dữ liệu cùng lúc; không thì chỉ hiện mục đang chọn,
  // riêng mục Chế tạo lọc thêm theo nhóm.
  filterGuide() {
    const q = norm($('guide-search').value.trim());
    for (const b of document.querySelectorAll('#guide-tabs button')) b.classList.toggle('on', !q && b.dataset.tab === this.guideTab);
    for (const s of document.querySelectorAll('#guide section')) s.hidden = q ? !SEARCH_TABS.has(s.dataset.tab) : s.dataset.tab !== this.guideTab;
    for (const el of document.querySelectorAll('#guide .g-intro')) el.hidden = !!q;
    for (const el of document.querySelectorAll('#guide .g-sechead')) el.hidden = !q;
    $('guide-cats').hidden = !!q;
    for (const b of document.querySelectorAll('#guide-cats button')) b.classList.toggle('on', b.dataset.cat === this.guideCat);

    let found = 0;
    for (const g of document.querySelectorAll('#guide-recipes .g-cat')) {
      const inCat = !!q || this.guideCat === 'all' || g.dataset.cat === this.guideCat;
      let n = 0;
      for (const c of g.querySelectorAll('.g-card')) {
        c.hidden = !(inCat && c.dataset.q.includes(q));
        if (!c.hidden) n++;
      }
      g.hidden = !n;
      found += n;
    }
    for (const t of document.querySelectorAll('#guide .g-table')) {
      let n = 0;
      for (const tr of t.querySelectorAll('tr[data-q]')) {
        tr.hidden = !tr.dataset.q.includes(q);
        if (!tr.hidden) n++;
      }
      t.hidden = !n;
      found += n;
    }
    // Mục không còn kết quả nào thì ẩn luôn khi đang tìm.
    if (q) for (const s of document.querySelectorAll('#guide section')) if (!s.hidden && !s.querySelector('.g-card:not([hidden]), tr[data-q]:not([hidden])')) s.hidden = true;
    $('guide-empty').hidden = !q || found > 0;
  }

  toggleGuide(open = $('guide').hidden) {
    $('guide').hidden = !open;
    if (open) {
      this.controls.release();
      this.closeSheet();
    }
  }

  // ---------- Bố cục theo thiết bị ----------

  // Bảng chế tạo: máy tính mặc định mở (nhớ lựa chọn), điện thoại mặc định đóng để đỡ che màn hình.
  craftPref() {
    if (this.controls.touch) return false;
    try { return localStorage.getItem('ds-craft-closed') !== '1'; } catch { return true; }
  }

  setCraftOpen(open, byUser = false) {
    $('craft').classList.toggle('open', open);
    $('tb-craft').classList.toggle('on', open);
    if (byUser && !this.controls.touch) {
      try { localStorage.setItem('ds-craft-closed', open ? '0' : '1'); } catch {}
    }
    if (open && this.controls.touch) this.setChatOpen(false);
  }

  // Chat: máy tính luôn hiện, điện thoại mở / đóng bằng nút 💬.
  setChatOpen(open) {
    document.body.classList.toggle('chat-open', open);
    $('tb-chat').classList.toggle('on', open);
    $('tb-chat').classList.remove('unread');
    if (!open) $('chatin').blur();
  }

  toggleSound() {
    this.sound.setMuted(!this.sound.muted);
    this.renderSoundBtn();
  }

  renderSoundBtn() {
    const btn = $('tb-sound');
    btn.firstChild.textContent = this.sound.muted ? '🔇' : '🔊';
    btn.classList.toggle('on', !this.sound.muted);
  }

  toggleChat() {
    if (!this.controls.touch) return $('chatin').focus();
    const open = !document.body.classList.contains('chat-open');
    this.setChatOpen(open);
    if (open) this.setCraftOpen(false);
  }

  onTouchMode(touch) {
    $('chatin').placeholder = touch ? 'Nhập tin nhắn...' : 'Nhấn Enter để chat';
    this.setCraftOpen(this.craftPref());
    if (!touch) this.setChatOpen(false);
    this.closeSheet();
  }

  // Dòng chữ dưới nút ✋ / ⚔️: cho biết giữ nút sẽ làm gì.
  setActionLabels(gather, attack) {
    if (gather !== this.gatherLabel) $('act-gather-label').textContent = this.gatherLabel = gather;
    if (attack !== this.attackLabel) $('act-attack').querySelector('small').textContent = this.attackLabel = attack;
  }

  // ---------- Kéo thả đồ ----------

  // Bắt đầu kéo ô i: icon của món đồ chạy theo con trỏ / ngón tay.
  // Di chuyển / thả nghe trên cả cửa sổ (không chỉ trên ô đồ): lỡ mất pointer capture (đổi tab, cử chỉ hệ thống)
  // thì vẫn kết thúc được lượt kéo, icon không bị kẹt lại trên màn hình.
  startDrag(i, pointerId) {
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.innerHTML = this.slots[i].querySelector('.ic')?.outerHTML ?? '';
    document.body.appendChild(ghost);
    this.slots[i].classList.add('dragging');
    const mine = (e) => e.pointerId === pointerId;
    const listeners = {
      pointermove: (e) => mine(e) && this.moveDrag(e.clientX, e.clientY),
      pointerup: (e) => mine(e) && this.endDrag(e.clientX, e.clientY),
      pointercancel: (e) => mine(e) && this.cancelDrag(),
      blur: () => this.cancelDrag(),
    };
    for (const [ev, fn] of Object.entries(listeners)) window.addEventListener(ev, fn, true);
    this.drag = { i, ghost, over: null, listeners };
  }

  // Ô đồ dưới điểm (x, y) màn hình: chỉ số trong túi hoặc -1.
  slotAt(el) {
    return this.slots.indexOf(el?.closest('.slot'));
  }

  moveDrag(x, y) {
    const d = this.drag;
    d.ghost.style.left = `${x}px`;
    d.ghost.style.top = `${y}px`;
    const el = document.elementFromPoint(x, y);
    const to = this.slotAt(el);
    const over = to >= 0 && to !== d.i ? this.slots[to] : null;
    if (over !== d.over) {
      d.over?.classList.remove('drop');
      over?.classList.add('drop');
      d.over = over;
    }
    // Trên màn chơi: lợn dưới con trỏ sáng lên (thả vào là cho ăn)
    this.scene?.dragOver(el?.closest('#game') ? [x, y] : null);
  }

  // Thả: lên ô khác thì đổi chỗ / gộp, vào rương đang mở thì cất, ra màn chơi trúng lợn thì cho lợn ăn.
  endDrag(x, y) {
    const { i } = this.drag;
    this.cancelDrag();
    const el = document.elementFromPoint(x, y);
    const to = this.slotAt(el);
    if (to >= 0) {
      if (to !== i) this.socket.emit('swap', { from: i, to });
    } else if (this.chestId && el?.closest('#chest')) {
      this.socket.emit('chest:store', { slot: i });
    } else if (el?.closest('#game')) {
      this.scene?.dropItem(i, x, y);
    }
  }

  cancelDrag() {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    for (const [ev, fn] of Object.entries(d.listeners)) window.removeEventListener(ev, fn, true);
    d.ghost.remove();
    d.over?.classList.remove('drop');
    this.slots[d.i].classList.remove('dragging');
    this.scene?.dragOver(null);
  }

  // ---------- Menu giữ lâu vào ô đồ (cảm ứng) ----------

  openSheet(i) {
    const it = this.inv[i];
    if (!it) return;
    const def = ITEMS[it.id];
    this.sheetSlot = i;
    $('sheet-title').innerHTML = `${iconHtml(it.id)}<b>${def.name}</b>${it.count > 1 ? `<small>×${it.count}</small>` : ''}`;
    $('sheet-info').textContent = itemInfo(it).join(' · ');
    const alt = (mode) => () => this.socket.emit('alt', { slot: i, mode });
    const btns = [];
    const primary = primaryAction(def, !!this.chestId);
    if (primary) btns.push([primary.replace(/ \(.*\)$/, ''), () => this.socket.emit(this.chestId ? 'chest:store' : 'use', { slot: i })]);
    if (def.cook) btns.push([def.food ? '🔥 Nướng' : `🔥 Đốt thành ${ITEMS[def.cook].name}`, alt('cook')]);
    if (def.dry) btns.push(['🪝 Phơi', alt('dry')]);
    btns.push(['🗑️ Vứt xuống đất', alt('drop'), 'danger']);
    const box = $('sheet-btns');
    box.innerHTML = '';
    for (const [label, fn, cls] of btns) {
      const b = document.createElement('button');
      b.textContent = label;
      if (cls) b.className = cls;
      b.addEventListener('click', () => {
        fn();
        this.closeSheet();
      });
      box.appendChild(b);
    }
    // Đặt menu ngay trên ô đồ, không tràn ra ngoài màn hình.
    const sheet = $('sheet');
    sheet.hidden = false;
    const r = this.slots[i].getBoundingClientRect();
    const w = sheet.offsetWidth;
    sheet.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
    sheet.style.bottom = `${innerHeight - r.top + 8}px`;
    for (const s of this.slots) s.classList.remove('picked');
    this.slots[i].classList.add('picked');
  }

  closeSheet() {
    if (this.sheetSlot === null) return;
    this.slots[this.sheetSlot]?.classList.remove('picked');
    this.sheetSlot = null;
    $('sheet').hidden = true;
  }

  // ---------- Bàn phím ----------

  onKey(e) {
    // Bảng hướng dẫn mở được cả ở màn hình chờ (trước khi vào game).
    if (!$('guide').hidden) {
      const search = $('guide-search');
      if (e.target === search) {
        // Esc lần đầu xóa chữ đang tìm, lần sau mới đóng bảng; các phím khác là đang gõ.
        if (e.key !== 'Escape') return;
        if (search.value) {
          e.preventDefault();
          search.value = '';
          return this.filterGuide();
        }
        search.blur();
      }
      if (e.key === 'Escape' || (!$('hud').hidden && (e.key === 'h' || e.key === 'H'))) this.toggleGuide(false);
      return;
    }
    if ($('hud').hidden) return;
    const chatin = $('chatin');
    if (e.key === 'Enter') {
      if (this.typing) return; // form chat tự gửi
      e.preventDefault();
      chatin.focus();
      return;
    }
    if (e.key === 'Escape') {
      if (this.typing) return chatin.blur();
      if (this.sheetSlot !== null) return this.closeSheet();
      if (this.chestId) return this.closeChest();
      if (this.minimap?.open) return this.minimap.toggle(false);
    }
    if (this.typing) return;
    if (e.key === 'Tab') {
      e.preventDefault(); // không cho trình duyệt chuyển focus
      if (!e.repeat) this.minimap?.toggle();
      return;
    }
    if (e.key === 'h' || e.key === 'H') return this.toggleGuide(true);
    if (e.key === 'c' || e.key === 'C') return this.setCraftOpen(!$('craft').classList.contains('open'), true);
    if (e.key === 'm' || e.key === 'M') return this.toggleSound();
    if (/^[0-9]$/.test(e.key)) {
      const slot = e.key === '0' ? 9 : Number(e.key) - 1;
      this.socket.emit(this.chestId ? 'chest:store' : 'use', { slot });
    }
  }

  // ---------- Túi đồ & chế tạo ----------

  count(id) {
    return this.inv.reduce((s, it) => s + (it && it.id === id ? it.count : 0), 0);
  }

  canCraft(r) {
    return (!r.station || this.stations.has(r.station)) && Object.entries(r.needs).every(([id, n]) => this.count(id) >= n);
  }

  setStations(set) {
    const key = [...set].sort().join();
    if (key === [...this.stations].sort().join()) return;
    this.stations = set;
    this.render();
  }

  render() {
    this.slots.forEach((el, i) => {
      const it = this.inv[i];
      el.innerHTML = (i < 10 ? `<span class="key">${(i + 1) % 10}</span>` : '') + (it ? itemHtml(it) : '');
      el.title = it ? itemTitle(it, !!this.chestId) : '';
      el.hidden = i >= this.inv.length; // ba lô nhỏ thì ẩn các ô thừa
    });
    $('pack').hidden = this.inv.length <= INV_SIZE;
    if (this.sheetSlot !== null && !this.inv[this.sheetSlot]) this.closeSheet();
    for (const s of GEAR_SLOTS) {
      const it = this.gear[s];
      this.gearEls[s].innerHTML = it ? itemHtml(it) : '';
      this.gearEls[s].title = it ? `${ITEMS[it.id].name}\nClick để cất vào túi` : `Ô ${GEAR_NAMES[s]} (trống)`;
    }

    CATEGORIES.forEach((c, i) => {
      const el = this.catEls[i];
      el.classList.toggle('on', c.id === this.cat);
      el.classList.toggle('ready', RECIPES.some((r) => r.cat === c.id && this.canCraft(r)));
    });
    $('craft-title').textContent = CATEGORIES.find((c) => c.id === this.cat).name;

    const list = $('recipes');
    list.innerHTML = '';
    for (const r of RECIPES.filter((x) => x.cat === this.cat)) {
      const locked = r.station && !this.stations.has(r.station);
      const needs = Object.entries(r.needs).map(([id, n]) => {
        const have = this.count(id);
        return `<span class="${have >= n ? 'ok' : 'no'}">${mini(id)}${have}/${n}</span>`;
      });
      const el = document.createElement('div');
      el.className = 'recipe' + (this.canCraft(r) ? '' : ' off');
      el.title = r.desc + (r.station ? `\n🔒 Phải đứng gần ${STATIONS[r.station].name}` : '');
      el.innerHTML = `<span class="ic">${recipeIcon(r)}</span><div><b>${recipeName(r)}</b>${
        locked ? `<small class="lock">🔒 Cần ${STATIONS[r.station].name}</small>` : ''
      }<small>${needs.join('')}</small></div>`;
      el.addEventListener('click', () => this.socket.emit('craft', { id: r.id }));
      list.appendChild(el);
    }
  }

  // ---------- Rương ----------

  openChest(id, slots, type = 'chest') {
    this.chestId = id;
    const r = RECIPES.find((x) => x.id === type);
    $('chest-title').textContent = `${r?.icon ?? '🧰'} ${r?.name ?? 'Rương'}`;
    $('chest').hidden = false;
    this.renderChest(slots);
    this.render();
  }

  renderChest(slots) {
    slots.forEach((it, i) => {
      this.chestEls[i].innerHTML = it ? itemHtml(it) : '';
      this.chestEls[i].title = it ? `${ITEMS[it.id].name}\nClick để lấy vào túi` : '';
    });
  }

  closeChest() {
    if (!this.chestId) return;
    this.chestId = null;
    $('chest').hidden = true;
    this.socket.emit('chest:close');
    this.render();
  }

  // ---------- Chỉ số, chat, ... ----------

  setStats(s) {
    const set = (id, v, max) => {
      const el = $(id);
      el.querySelector('.fill').style.height = `${Math.max(0, (v / max) * 100)}%`;
      el.querySelector('b').textContent = Math.max(0, Math.ceil(v));
      el.classList.toggle('low', !s.dead && v / max < 0.2);
    };
    set('st-hp', s.hp, MAX_HP);
    $('st-hp').classList.toggle('poisoned', !s.dead && !!s.poison);
    $('st-hp').title = s.poison ? 'Máu — đang trúng độc! Dùng Thuốc đắp hoặc Thuốc giải để chữa' : 'Máu';
    set('st-hunger', s.hunger, MAX_HUNGER);
    set('st-sanity', s.sanity, MAX_SANITY);
    const r = s.sanity / MAX_SANITY;
    $('vignette').style.opacity = s.dead ? 0 : r < 0.5 ? (1 - r / 0.5) * 0.85 : 0;
  }

  // Thông số của thế giới vừa vào (gói init): đồng hồ ngày đêm và các con số trong hướng dẫn.
  setWorld(settings) {
    const cfg = sanitizeSettings(settings);
    this.cfg = cfg;
    this.clock = clockOf(cfg);
    const { len, dayEnd, duskEnd } = this.clock;
    const deg = (t) => `${(t / len) * 360}deg`;
    $('clock').style.background = `conic-gradient(#e2b84a 0deg ${deg(dayEnd)}, #b8553a ${deg(dayEnd)} ${deg(duskEnd)}, #283a6a ${deg(duskEnd)} 360deg)`;

    const fill = (key, text) => { for (const el of document.querySelectorAll(`#guide [data-w="${key}"]`)) el.textContent = text; };
    const show = (key, on) => { for (const el of document.querySelectorAll(`#guide [data-w="${key}"]`)) el.hidden = !on; };
    fill('dayLen', durationText(len));
    fill('dayPart', durationText(dayEnd));
    fill('duskPart', durationText(duskEnd - dayEnd));
    fill('nightPart', durationText(len - duskEnd));
    fill('hunger', durationText(480 / cfg.hunger));
    fill('abandon', `${cfg.abandonDays} ngày`);
    show('abandonOn', cfg.abandonDays > 0);
    fill('houndDay', `ngày ${String(cfg.houndDay).replace('.', ',')}`);
    show('houndsOn', cfg.hounds);
    show('queenOn', cfg.spiderQueen);
    fill('queenRespawn', `${cfg.queenRespawn} ngày`);
    fill('regrow', cfg.regrow === 1 ? '' : ` Ở thế giới này mọi thứ mọc lại ${cfg.regrow > 1 ? 'nhanh' : 'chậm'} hơn (×${String(cfg.regrow).replace('.', ',')}).`);

    const preset = presetOf(cfg);
    $('guide-world-preset').textContent = preset ? `${PRESETS[preset].icon} ${PRESETS[preset].name}` : '⚙️ Tùy chỉnh';
    $('guide-world-list').innerHTML = settingsHtml(cfg);
    $('guide-world').hidden = false;
    $('guide-world-note').hidden = true;
  }

  setClock(t) {
    const { len } = this.clock;
    const d = t % len;
    const ph = phaseAt(t, this.clock);
    if (ph !== this.lastPhase) {
      if (this.lastPhase) this.sound.phase(ph); // không phát lúc vừa vào game
      this.lastPhase = ph;
      const img = spriteImg({ day: 'ui_sun', dusk: 'ui_sunset', night: 'ui_moon' }[ph], 'clock-ic');
      $('clock-ic').innerHTML = img ?? '';
    }
    $('hand').style.transform = `rotate(${(d / len) * 360}deg)`;
    $('dayNum').textContent = `Ngày ${Math.floor(t / len) + 1}`;
    $('phase').textContent = PHASE_NAMES[ph];
  }

  setRoster(list) {
    const el = $('roster');
    el.innerHTML = '';
    // Trên điện thoại chỉ hiện gọn "👥 3", chạm để mở danh sách.
    const title = document.createElement('div');
    const long = document.createElement('span');
    long.className = 'long';
    long.textContent = `${this.serverName ? `🌍 ${this.serverName} · ` : ''}Đang online: `;
    const short = document.createElement('span');
    short.className = 'short';
    short.textContent = '👥 ';
    title.append(long, short, document.createTextNode(list.length));
    title.className = 'roster-title';
    el.appendChild(title);
    for (const p of list) {
      const row = document.createElement('div');
      const dot = document.createElement('i');
      dot.style.background = hex(p.color);
      const days = document.createElement('small');
      days.textContent = ` · ${p.days} ngày`;
      days.title = 'Số ngày sống sót liên tục (chết thì tính lại từ 0)';
      row.append(dot, document.createTextNode(p.name), days);
      el.appendChild(row);
    }
  }

  addChat(m) {
    const log = $('chatlog');
    const row = document.createElement('div');
    if (m.sys) {
      row.className = 'sys';
      row.textContent = m.text;
    } else {
      const name = document.createElement('b');
      name.style.color = hex(m.color);
      name.textContent = `${m.name}: `;
      row.append(name, document.createTextNode(m.text));
    }
    log.appendChild(row);
    while (log.children.length > 40) log.firstChild.remove();
    if (!m.sys && this.controls.touch && !document.body.classList.contains('chat-open')) $('tb-chat').classList.add('unread');
  }

  flash(kind = 'hurt') {
    const el = $('flash');
    el.className = '';
    void el.offsetWidth; // khởi động lại animation
    el.className = kind === 'dark' ? 'on dark' : 'on';
  }

  showDeath({ cause, respawn, days }) {
    this.closeChest();
    $('dead').hidden = false;
    $('deadcause').textContent = `Nguyên nhân: ${cause} · Đã sống sót ${days ?? 0} ngày`;
    let left = respawn;
    $('deadcount').textContent = left;
    clearInterval(this.deathTimer);
    this.deathTimer = setInterval(() => {
      left = Math.max(0, left - 1);
      $('deadcount').textContent = left;
    }, 1000);
  }

  hideDeath() {
    clearInterval(this.deathTimer);
    $('dead').hidden = true;
  }

  disconnected(reason) {
    if (reason) $('disc-reason').textContent = reason;
    $('disc').hidden = false;
  }

  // Thanh máu boss: [id, máu, máu tối đa], hoặc undefined khi không có boss ở gần.
  setBoss(bo) {
    const el = $('bossbar');
    el.hidden = !bo;
    if (!bo) return;
    const [, hp, max, name = 'Deerclops'] = bo;
    $('bossfill').style.width = `${(hp / max) * 100}%`;
    $('bosstext').textContent = `${name} — ${hp} / ${max}`;
  }

  // Banner cảnh báo giữa màn hình (chó săn sắp tới...)
  warn({ text, big }) {
    const el = $('warn');
    el.textContent = text;
    el.classList.toggle('big', !!big);
    el.hidden = false;
    clearTimeout(this.warnTimer);
    this.warnTimer = setTimeout(() => { el.hidden = true; }, big ? 5000 : 4000);
    this.addChat({ sys: true, text: `⚠ ${text}` });
    if (big) this.flash();
  }
}

import {
  ITEMS, RECIPES, CATEGORIES, STATIONS, GEAR_SLOTS, GEAR_NAMES, INV_SIZE, PACK_SIZE, CHEST_SIZE,
  MAX_HP, MAX_HUNGER, MAX_SANITY, DAY_LEN, phaseAt,
} from '../../shared/data.js';
import { iconHtml, spriteImg } from './art.js';
import { Controls } from './touch.js';
import { Sound } from './audio.js';

const LONG_PRESS_MS = 420;

const PHASE_NAMES = { day: 'Ban ngày', dusk: 'Chạng vạng', night: 'Ban đêm' };
const GEAR_EMPTY = { hand: '✋', head: '🎩', body: '👕' };
const $ = (id) => document.getElementById(id);
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const recipeName = (r) => r.name ?? ITEMS[r.id].name;
const recipeIcon = (r) => iconHtml(r.id, r.icon ?? ITEMS[r.id]?.icon);
const mini = (id) => iconHtml(id).replace('class="ic', 'class="mini');

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
  if (def.pack) lines.push(`Thêm ${PACK_SIZE} ô đồ${it.slots?.some(Boolean) ? ' · đang chứa đồ' : ''}`);
  if (def.fuel) lines.push(`Củi: +${def.fuel} giây`);
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
    this.cat = CATEGORIES[0].id;
    this.chestId = null;
    this.typing = false;
    this.deathTimer = null;
    this.controls = new Controls();
    this.controls.onChange((touch) => this.onTouchMode(touch));

    // Các ô sau INV_SIZE là ô ba lô, chỉ hiện khi đang đeo ba lô.
    // Chạm: dùng ngay. Giữ lâu (cảm ứng): mở menu nướng / phơi / vứt. Chuột phải (máy tính): như cũ.
    this.slots = [];
    for (let i = 0; i < INV_SIZE + PACK_SIZE; i++) {
      const el = document.createElement('div');
      el.className = 'slot';
      let timer = null;
      let longPressed = false;
      let pointer = 'mouse';
      el.addEventListener('pointerdown', (e) => {
        pointer = e.pointerType;
        longPressed = false;
        clearTimeout(timer);
        if (pointer === 'mouse' || !this.inv[i]) return;
        timer = setTimeout(() => {
          longPressed = true;
          navigator.vibrate?.(15);
          this.openSheet(i);
        }, LONG_PRESS_MS);
      });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => clearTimeout(timer));
      el.addEventListener('click', () => {
        if (longPressed) return;
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
      if (def.pack) stats.push(`Thêm ${PACK_SIZE} ô đồ`);
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
      return `<h3>${c.icon} ${c.name}</h3><div class="g-grid">${list.map(card).join('')}</div>`;
    }).join('');

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

    for (const btn of document.querySelectorAll('#guide-tabs button')) {
      btn.addEventListener('click', () => {
        for (const b of document.querySelectorAll('#guide-tabs button')) b.classList.toggle('on', b === btn);
        for (const s of document.querySelectorAll('#guide section')) s.hidden = s.dataset.tab !== btn.dataset.tab;
      });
    }
    $('guide-btn').addEventListener('click', () => this.toggleGuide());
    document.querySelector('.guide-close').addEventListener('click', () => this.toggleGuide(false));
    $('guide').addEventListener('click', (e) => { if (e.target.id === 'guide') this.toggleGuide(false); });
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
    if ($('hud').hidden) return;
    if (!$('guide').hidden) {
      if (e.key === 'Escape' || e.key === 'h' || e.key === 'H') this.toggleGuide(false);
      return;
    }
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
    set('st-hunger', s.hunger, MAX_HUNGER);
    set('st-sanity', s.sanity, MAX_SANITY);
    const r = s.sanity / MAX_SANITY;
    $('vignette').style.opacity = s.dead ? 0 : r < 0.5 ? (1 - r / 0.5) * 0.85 : 0;
  }

  setClock(t) {
    const d = t % DAY_LEN;
    const ph = phaseAt(t);
    if (ph !== this.lastPhase) {
      if (this.lastPhase) this.sound.phase(ph); // không phát lúc vừa vào game
      this.lastPhase = ph;
      const img = spriteImg({ day: 'ui_sun', dusk: 'ui_sunset', night: 'ui_moon' }[ph], 'clock-ic');
      $('clock-ic').innerHTML = img ?? '';
    }
    $('hand').style.transform = `rotate(${(d / DAY_LEN) * 360}deg)`;
    $('dayNum').textContent = `Ngày ${Math.floor(t / DAY_LEN) + 1}`;
    $('phase').textContent = PHASE_NAMES[phaseAt(t)];
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

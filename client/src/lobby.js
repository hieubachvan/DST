// Màn hình sảnh: chọn server, nhập passcode + tên, và bảng quản trị cho admin.
import {
  SETTINGS, SETTING_GROUPS, PRESETS, presetSettings, presetOf, sanitizeSettings, settingsHtml,
} from '../../shared/settings.js';
import { CHARACTERS } from '../../shared/data.js';

const $ = (id) => document.getElementById(id);
const presetLabel = (id) => (id ? `${PRESETS[id].icon} ${PRESETS[id].name}` : '⚙️ Tùy chỉnh');
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export class Lobby {
  // onJoin(serverId, passcode, name, char) được gọi khi người chơi bấm "Vào thế giới"
  constructor(onJoin) {
    this.onJoin = onJoin;
    this.selected = null;
    this.adminToken = sessionStorage.getItem('ds-admin');

    $('back').addEventListener('click', () => this.showPick());
    $('login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.submit();
    });
    $('name').value = store.get('ds-name') || '';
    this.renderChars();

    $('admin-open').addEventListener('click', () => this.openAdmin());
    $('admin-close').addEventListener('click', () => { $('admin').hidden = true; this.refresh(); });
    $('admin-login').addEventListener('submit', (e) => { e.preventDefault(); this.adminLogin(); });
    $('admin-logout').addEventListener('click', () => this.adminLogout());
    $('admin-create').addEventListener('submit', (e) => { e.preventDefault(); this.adminCreate(); });
    this.buildSettingsForm();

    this.refresh();
    this.timer = setInterval(() => { if (!$('login').hidden) this.refresh(); }, 5000);
  }

  // ---------- Người chơi ----------

  async refresh() {
    try {
      const list = await (await fetch('/api/servers')).json();
      this.servers = list;
      this.renderList();
    } catch {
      $('server-list').innerHTML = '<p class="muted">Không tải được danh sách server, đang thử lại...</p>';
    }
  }

  renderList() {
    const el = $('server-list');
    el.innerHTML = '';
    $('server-empty').hidden = this.servers.length > 0;
    for (const s of this.servers) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'server-card';
      btn.innerHTML = `<b>${esc(s.name)}</b><span>Ngày ${s.day} · ${s.online} người online · ${presetLabel(s.preset)}</span>`;
      btn.addEventListener('click', () => this.choose(s));
      el.appendChild(btn);
    }
  }

  choose(server) {
    this.selected = server;
    $('pick').hidden = true;
    $('login-form').hidden = false;
    $('pick-name').textContent = server.name;
    $('passcode').value = store.get(`ds-pass:${server.id}`) || '';
    $('login-status').textContent = '';
    ($('passcode').value ? $('name') : $('passcode')).focus();
  }

  showPick() {
    this.selected = null;
    $('pick').hidden = false;
    $('login-form').hidden = true;
    this.refresh();
  }

  submit() {
    if (!this.selected) return;
    const passcode = $('passcode').value;
    const name = $('name').value.trim();
    if (!passcode) return this.error('Hãy nhập passcode của server.');
    store.set('ds-name', name);
    const char = this.char;
    store.set('ds-char', char);
    $('login-status').textContent = 'Đang vào thế giới...';
    $('login-form').querySelector('button[type=submit]').disabled = true;
    this.onJoin(this.selected.id, passcode, name, char);
  }

  // Chọn nhân vật (chỉ khác hình dáng), nhớ lựa chọn lần trước.
  renderChars() {
    const saved = store.get('ds-char');
    const pick = Object.hasOwn(CHARACTERS, saved) ? saved : 'default';
    $('char-pick').innerHTML = Object.entries(CHARACTERS).map(([id, c]) => `<label>
      <input type="radio" name="char" value="${id}"${id === pick ? ' checked' : ''} />
      <img src="${import.meta.env.BASE_URL}${c.img}" alt="" /><span>${esc(c.name)}</span></label>`).join('');
  }

  get char() { return document.querySelector('#char-pick input:checked')?.value ?? 'default'; }

  // Vào thành công: nhớ passcode để lần sau khỏi nhập
  joined() {
    if (this.selected) store.set(`ds-pass:${this.selected.id}`, $('passcode').value);
    clearInterval(this.timer);
  }

  error(message) {
    $('login-status').textContent = message;
    $('login-form').querySelector('button[type=submit]').disabled = false;
    if (this.selected && /passcode/i.test(message)) store.del(`ds-pass:${this.selected.id}`);
  }

  // Vào thẳng bằng link ?server=...&pass=...&name=...
  autoJoin(serverId, passcode, name) {
    this.selected = { id: serverId, name: serverId };
    $('pick').hidden = true;
    $('login-form').hidden = false;
    $('pick-name').textContent = serverId;
    $('passcode').value = passcode;
    $('name').value = name;
    this.submit();
  }

  // ---------- Admin ----------

  async api(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.adminToken}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && url !== '/api/admin/login') this.adminLogout();
    if (!res.ok) throw new Error(data.error || 'Có lỗi xảy ra.');
    return data;
  }

  adminStatus(text, ok = false) {
    const el = $('admin-status');
    el.textContent = text;
    el.className = ok ? 'ok' : 'no';
  }

  openAdmin() {
    $('admin').hidden = false;
    this.adminStatus('');
    if (this.adminToken) this.adminShow();
    else {
      $('admin-login').hidden = false;
      $('admin-main').hidden = true;
      $('admin-user').focus();
    }
  }

  async adminLogin() {
    try {
      const { token } = await this.api('POST', '/api/admin/login', { username: $('admin-user').value, password: $('admin-pass').value });
      this.adminToken = token;
      sessionStorage.setItem('ds-admin', token);
      $('admin-pass').value = '';
      this.adminStatus('');
      this.adminShow();
    } catch (err) {
      this.adminStatus(err.message);
    }
  }

  adminLogout() {
    this.adminToken = null;
    sessionStorage.removeItem('ds-admin');
    $('admin-login').hidden = false;
    $('admin-main').hidden = true;
  }

  async adminShow() {
    $('admin-login').hidden = true;
    $('admin-main').hidden = false;
    try {
      this.adminRender(await this.api('GET', '/api/admin/servers'));
    } catch (err) {
      this.adminStatus(err.message);
    }
  }

  adminRender(list) {
    const table = $('admin-servers');
    table.innerHTML = '<tr><th>Server</th><th>Ngày</th><th>Online</th><th>Thông số</th><th>Đổi passcode</th><th></th></tr>';
    if (!list.length) table.insertAdjacentHTML('beforeend', '<tr><td colspan="6" class="muted">Chưa có server nào.</td></tr>');
    for (const s of list) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><b>${esc(s.name)}</b><br><small class="muted">${esc(s.id)}</small></td><td>${s.day}</td><td>${s.online}</td>
        <td>${presetLabel(s.preset)}<br><button type="button" class="link small">Xem</button></td>
        <td><div class="row"><input maxlength="32" placeholder="Passcode mới"><button type="button" class="small">Lưu</button></div></td>
        <td><button type="button" class="small danger">Xóa</button></td>`;
      const [view, save, del] = tr.querySelectorAll('button');
      const input = tr.querySelector('input');
      // Xem thông số (chỉ đọc): mở một dòng ngay bên dưới.
      const info = document.createElement('tr');
      info.className = 'ws-info';
      info.hidden = true;
      info.innerHTML = `<td colspan="6">${settingsHtml(s.settings)}</td>`;
      view.addEventListener('click', () => {
        info.hidden = !info.hidden;
        view.textContent = info.hidden ? 'Xem' : 'Ẩn';
      });
      save.addEventListener('click', async () => {
        try {
          await this.api('PATCH', `/api/admin/servers/${encodeURIComponent(s.id)}`, { passcode: input.value });
          input.value = '';
          this.adminStatus(`Đã đổi passcode của "${s.name}".`, true);
        } catch (err) {
          this.adminStatus(err.message);
        }
      });
      // Xóa cần bấm 2 lần để tránh lỡ tay
      del.addEventListener('click', async () => {
        if (!del.dataset.confirm) {
          del.dataset.confirm = '1';
          del.textContent = 'Chắc chắn?';
          setTimeout(() => { delete del.dataset.confirm; del.textContent = 'Xóa'; }, 3000);
          return;
        }
        try {
          await this.api('DELETE', `/api/admin/servers/${encodeURIComponent(s.id)}`);
          this.adminStatus(`Đã xóa "${s.name}".`, true);
          this.adminShow();
        } catch (err) {
          this.adminStatus(err.message);
        }
      });
      table.append(tr, info);
    }
  }

  async adminCreate() {
    try {
      const s = await this.api('POST', '/api/admin/servers', {
        name: $('new-name').value, passcode: $('new-pass').value, settings: this.readSettings(),
      });
      $('new-name').value = '';
      $('new-pass').value = '';
      this.applyPreset('normal');
      $('ws').open = false;
      this.adminStatus(`Đã tạo "${s.name}".`, true);
      this.adminShow();
    } catch (err) {
      this.adminStatus(err.message);
    }
  }

  // ---------- Thông số thế giới (form tạo server) ----------

  // Vẽ form từ bảng SETTINGS: mỗi nhóm một khung, mỗi thông số một ô.
  buildSettingsForm() {
    $('ws-presets').innerHTML = Object.entries(PRESETS)
      .map(([id, p]) => `<button type="button" class="small" data-preset="${id}">${p.icon} ${p.name}</button>`).join('');
    for (const btn of $('ws-presets').querySelectorAll('button')) {
      btn.addEventListener('click', () => this.applyPreset(btn.dataset.preset));
    }
    const field = (s) => {
      const input = s.type === 'bool' ? `<input type="checkbox" name="${s.key}">`
        : s.type === 'select' ? `<select name="${s.key}">${Object.entries(s.options).map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select>`
        : `<input type="number" name="${s.key}" min="${s.min}" max="${s.max}" step="${s.step}"><small class="ws-val"></small>`;
      return `<label class="ws-f ws-${s.type}" data-key="${s.key}"${s.desc ? ` title="${s.desc}"` : ''}>
        <span>${s.label}${s.desc ? ' ⓘ' : ''}</span><span class="ws-in">${input}</span></label>`;
    };
    $('ws-fields').innerHTML = SETTING_GROUPS.map((g) =>
      `<fieldset><legend>${g.icon} ${g.name}</legend>${SETTINGS.filter((s) => s.group === g.id).map(field).join('')}</fieldset>`).join('');
    $('ws-fields').addEventListener('input', () => this.syncSettings());
    // Rời ô số thì kẹp lại vào khoảng hợp lệ cho người nhập thấy giá trị thật sẽ được dùng.
    $('ws-fields').addEventListener('change', (e) => {
      if (e.target.type !== 'number') return;
      e.target.value = this.readSettings()[e.target.name];
      this.syncSettings();
    });
    this.applyPreset('normal');
  }

  input(key) { return $('ws-fields').querySelector(`[name="${key}"]`); }

  readSettings() {
    const raw = {};
    for (const s of SETTINGS) {
      const el = this.input(s.key);
      raw[s.key] = s.type === 'bool' ? el.checked : el.value;
    }
    return sanitizeSettings(raw);
  }

  applyPreset(id) {
    this.wsBase = id;
    const values = presetSettings(id);
    for (const s of SETTINGS) {
      const el = this.input(s.key);
      if (s.type === 'bool') el.checked = values[s.key];
      else el.value = values[s.key];
    }
    this.syncSettings();
  }

  // Tô vàng ô khác gói đang chọn, làm mờ ô phụ thuộc thông số đang tắt, ghi tên gói ở tiêu đề.
  syncSettings() {
    const cur = this.readSettings();
    const base = presetSettings(this.wsBase);
    for (const s of SETTINGS) {
      const label = $('ws-fields').querySelector(`[data-key="${s.key}"]`);
      label.classList.toggle('changed', cur[s.key] !== base[s.key]);
      const off = !!s.needs && !cur[s.needs];
      label.classList.toggle('off', off);
      this.input(s.key).disabled = off;
      const val = label.querySelector('.ws-val');
      if (val) val.textContent = s.zero && cur[s.key] === 0 ? s.zero : s.unit; // đơn vị, hoặc nghĩa của số 0
    }
    for (const b of $('ws-presets').querySelectorAll('button')) b.classList.toggle('on', b.dataset.preset === this.wsBase);
    const match = presetOf(cur);
    $('ws-current').textContent = match ? PRESETS[match].name : `Tùy chỉnh (từ gói ${PRESETS[this.wsBase].name})`;
  }
}

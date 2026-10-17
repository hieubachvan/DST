// Màn hình sảnh: chọn server, nhập passcode + tên, và bảng quản trị cho admin.
const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export class Lobby {
  // onJoin(serverId, passcode, name) được gọi khi người chơi bấm "Vào thế giới"
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

    $('admin-open').addEventListener('click', () => this.openAdmin());
    $('admin-close').addEventListener('click', () => { $('admin').hidden = true; this.refresh(); });
    $('admin-login').addEventListener('submit', (e) => { e.preventDefault(); this.adminLogin(); });
    $('admin-logout').addEventListener('click', () => this.adminLogout());
    $('admin-create').addEventListener('submit', (e) => { e.preventDefault(); this.adminCreate(); });

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
      btn.innerHTML = `<b>${esc(s.name)}</b><span>Ngày ${s.day} · ${s.online} người online</span>`;
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
    $('login-status').textContent = 'Đang vào thế giới...';
    $('login-form').querySelector('button[type=submit]').disabled = true;
    this.onJoin(this.selected.id, passcode, name);
  }

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
    table.innerHTML = '<tr><th>Server</th><th>Ngày</th><th>Online</th><th>Đổi passcode</th><th></th></tr>';
    if (!list.length) table.insertAdjacentHTML('beforeend', '<tr><td colspan="5" class="muted">Chưa có server nào.</td></tr>');
    for (const s of list) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><b>${esc(s.name)}</b><br><small class="muted">${esc(s.id)}</small></td><td>${s.day}</td><td>${s.online}</td>
        <td><div class="row"><input maxlength="32" placeholder="Passcode mới"><button type="button" class="small">Lưu</button></div></td>
        <td><button type="button" class="small danger">Xóa</button></td>`;
      const [save, del] = tr.querySelectorAll('button');
      const input = tr.querySelector('input');
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
      table.appendChild(tr);
    }
  }

  async adminCreate() {
    try {
      const s = await this.api('POST', '/api/admin/servers', { name: $('new-name').value, passcode: $('new-pass').value });
      $('new-name').value = '';
      $('new-pass').value = '';
      this.adminStatus(`Đã tạo "${s.name}".`, true);
      this.adminShow();
    } catch (err) {
      this.adminStatus(err.message);
    }
  }
}

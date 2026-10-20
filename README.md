# Đừng Chết Đói — Cùng Nhau

Game sinh tồn 2D nhiều người chơi chạy trên trình duyệt, lấy cảm hứng từ *Don't Starve Together*.

## Công nghệ

| Phần | Công nghệ |
|---|---|
| Client | [Phaser 3](https://phaser.io) để vẽ game, Vite để build, HUD bằng HTML/CSS |
| Server | Node.js, Express, Socket.IO. Server giữ toàn bộ logic game |
| Cơ sở dữ liệu | SQLite có sẵn trong Node (`node:sqlite`), file `data/game.db` |
| Dữ liệu dùng chung | `shared/data.js` chứa vật phẩm, công thức chế tạo và chu kỳ ngày–đêm |

## Chạy trên máy

```bash
npm install
npm run dev
```

Lệnh `dev` chạy cùng lúc server (cổng 3000) và Vite dev server (cổng 5173). Mở http://localhost:5173. Muốn thử nhiều người chơi thì mở thêm tab khác. Cần Node 22.13 trở lên.

Lần đầu chạy chưa có server nào: bấm **Quản trị server** ở màn hình đầu, đăng nhập `admin` / `admin@123`, tạo server kèm passcode, rồi chọn server đó để vào chơi.

Mẹo: `http://localhost:5173/?server=<id>&pass=<passcode>&name=<tên>` sẽ vào thẳng game.

Chạy bản production:

```bash
npm run build
npm start        # http://localhost:3000
```

Thử nhanh ban đêm: `START_TIME=170 npm start` (PowerShell: `$env:START_TIME=170; npm start`).

Chế độ thử nghiệm: chạy `npm run dev:test` (bản dev có sẵn `DEV=1`, dùng được trên mọi hệ điều hành), sau đó gõ vào ô chat:
- `/give <mã đồ> <số lượng>`, ví dụ `/give gold 5` hoặc `/give log 40`. Mã đồ xem trong `shared/data.js`.
- `/hounds`: gọi đàn chó săn tới sau khoảng 12 giây (gọi được cả khi Deerclops đang ở đây).
- `/boss`: gọi boss Deerclops tới sau khoảng 12 giây (thử nhanh: `/give boomerang 1`).
- `/boss bearger`: gọi boss Bearger tới sau khoảng 12 giây. Bearger mê đồ ăn: thả vài quả mọng (`/give berries 20`) để dụ nó.

 **Không bật `DEV=1` khi deploy thật.**

## Cách chơi

- **WASD / phím mũi tên**: di chuyển
- **Click chuột**: đi tới vị trí, hoặc tương tác với vật thể / quái
- **Giữ Space**: tự thu thập vật gần nhất
- **Giữ F**: tấn công quái gần nhất
- **Túi đồ**: chuột trái để ăn, trang bị hoặc thêm củi vào lửa. Chuột phải để nướng (khi đứng gần lửa) hoặc vứt. Phím **1–0** để dùng nhanh
- **Enter**: chat
- **Ba lô** đeo ở ô Giáp, thêm 8 ô đồ. **Xẻng** đào bụi cỏ / cây non / bụi quả mọng để đem trồng (chuột trái vào cây đã đào). **Lều**: bấm vào lúc chạng vạng hoặc ban đêm để ngủ an toàn. **Giàn phơi**: đứng gần, chuột phải vào thịt sống để phơi. Chuột phải vào Gỗ khi gần lửa để đốt thành Than.
- **Lợn** (rừng) và **bò lông** (vùng đất đá) hiền, chỉ đánh lại khi bị đánh; đánh một con bò là cả đàn lao vào. Giết chúng để lấy Thịt.

**Trên điện thoại / máy tính bảng** (tự nhận ra khi chạm vào màn hình): chạm vào mặt đất để đi, chạm vào vật / quái để tương tác. Muốn có cần điều khiển và nút giữ ✋ thu thập, ⚔️ tấn công thì bấm nút 🕹️. Chạm vào ô đồ để dùng, giữ lâu để mở menu nướng / phơi / vứt. Các nút 🛠️ 💬 ❓ ⛶ ở góc trái trên mở bảng chế tạo, chat, hướng dẫn, toàn màn hình. Thử giao diện điện thoại trên máy tính bằng cách thêm `?touch=1` vào địa chỉ. Điện thoại cùng mạng wifi vào bằng `http://<IP-máy-tính>:5173` (bản dev) hoặc `:3000`.

**Búa** (không cần Máy Khoa Học) đập bỏ công trình, lấy lại một nửa nguyên liệu. Công trình không có ai tới gần trong nhiều ngày (mặc định 5) sẽ tự mục nát. Bảng **Hướng dẫn** mở được cả ở màn hình chờ, có ô tìm kiếm (gõ không dấu cũng được) và lọc theo nhóm.

Mặc định một ngày dài 4 phút (mỗi server có thể khác, xem *Thông số thế giới*). Ban đêm, nếu đứng ngoài vùng sáng của lửa trại hoặc đuốc, bạn sẽ bị bóng tối tấn công. Chết thì rơi toàn bộ đồ, thành hồn ma và hồi sinh sau 12 giây.

## Cấu trúc thư mục

```
shared/data.js        vật phẩm, công thức, hằng số, ngày–đêm, vùng đất
shared/settings.js    thông số thế giới chọn lúc tạo server, 3 gói Dễ / Mặc định / Khó
server/index.js       HTTP + Socket.IO, API admin, nhận lệnh từ client
server/db.js          SQLite, hash mật khẩu, tài khoản admin
server/worlds.js      quản lý nhiều server: tạo/xóa, passcode, nạp/gỡ thế giới
server/game.js        một thế giới: người chơi, quái, vòng lặp 20 tick/giây
client/index.html     khung HUD và các màn hình phủ
client/src/main.js    kết nối, khởi tạo Phaser
client/src/lobby.js   chọn server, nhập passcode, bảng quản trị
client/src/GameScene.js  vẽ thế giới, điều khiển, đồng bộ mạng, ánh sáng
client/src/hud.js     túi đồ, chế tạo, chỉ số, chat
client/src/textures.js   hình ảnh vẽ bằng code (thay bằng sprite thật sau)
```

## Deploy lên web

Game cần một server Node chạy liên tục có hỗ trợ WebSocket. **Không** dùng được Vercel hoặc Netlify (chỉ hỗ trợ serverless). Các lựa chọn phù hợp:

**Render.com** (có gói miễn phí):
1. Đẩy code lên GitHub.
2. Tạo *New → Web Service* và chọn repo.
3. Build command: `npm install && npm run build`. Start command: `npm start`.

**Railway / Fly.io / VPS**: dùng `Dockerfile` có sẵn.

```bash
docker build -t dont-starve-web .
docker run -p 3000:3000 dont-starve-web
```

Biến môi trường:

| Biến | Ý nghĩa |
|---|---|
| `PORT` | Cổng HTTP (mặc định 3000) |
| `ADMIN_USER`, `ADMIN_PASSWORD` | Tài khoản admin. **Bắt buộc đặt khi deploy**, nếu không sẽ dùng `admin` / `admin@123` |
| `DATA_DIR` | Thư mục chứa `game.db` (mặc định `./data`) |
| `PAUSE_WHEN_EMPTY` | `0` để thời gian thế giới chạy tiếp khi không ai online |
| `DEV` | `1` để bật lệnh thử nghiệm. Không bật khi deploy |

Endpoint `/health` dùng cho health check.

## Hình ảnh (sprite)

Các tấm sprite sheet gốc nằm trong `assets/sheets/`, đặt tên chữ thường nối bằng gạch ngang theo nội dung (`characters-mobs-structures.png`, `resources-plants.png`, `player-animations.png`…). Lệnh dưới đây cắt từng hình, xóa nền và lưu PNG trong suốt vào `client/public/sprites/`:

```bash
npm run sprites
```

Muốn thêm hình mới: mở `tools/extract-sprites.mjs`, thêm một dòng vào bảng `SPRITES` dạng `ten: ['s1', x, y, rộng, cao]` (khung chứa hình trên ảnh gốc), rồi chạy lại lệnh trên. Nếu tên trùng mã vật phẩm trong `shared/data.js` (ví dụ `silk`, `logsuit`), giao diện và game sẽ tự dùng hình đó thay cho emoji. Chiều cao hiển thị trong thế giới chỉnh ở `ART_HEIGHT` trong `client/src/GameScene.js`.

Món nào chưa có hình thì game tự dùng emoji hoặc hình vẽ bằng code.

Quy ước tên sprite xuất ra: chữ thường nối bằng `_`. Vật phẩm dùng đúng mã trong `shared/data.js` (`log`, `cutgrass`…). Khung hoạt ảnh dùng dạng `<đối_tượng>_<tư_thế>_<hướng>`, ví dụ `player_walk_down_right`, hoặc `<đối_tượng>_<tên>_<số khung>`, ví dụ `campfire_anim_3`. Hướng đặt theo hướng nhân vật **thật sự quay mặt trên màn hình**, vì nhãn chữ trên `player-animations.png` bị sai. Nhân vật chỉ cần 5 hướng (`down`, `down_right`, `right`, `up_right`, `up`), 3 hướng bên trái do game lật ngang hình bên phải.

## Server, passcode và lưu dữ liệu

- Mỗi **server** là một thế giới riêng: ngày, công trình, quái và nhân vật đều tách biệt.
- Chỉ **admin** tạo, đổi passcode và xóa server được, qua nút **Quản trị server** ở màn hình đầu. Người chơi chỉ cần chọn server và nhập passcode. Trình duyệt nhớ passcode cho lần sau.
- Mật khẩu admin và passcode đều được hash (scrypt) trước khi lưu vào DB. Nhập sai passcode 5 lần thì phải chờ 1 phút; đăng nhập admin sai 5 lần cũng vậy.
- Tất cả lưu trong `data/game.db`: tự lưu mỗi 30 giây, khi người cuối cùng thoát khỏi server, và khi tắt server (Ctrl+C hoặc tín hiệu dừng).
- Server không ai chơi quá 1 phút sẽ được lưu và gỡ khỏi bộ nhớ, có người vào thì nạp lại. Khi không ai online, thời gian của server đó tạm dừng.
- Nhân vật gắn với **mã bí mật** do trình duyệt tạo và lưu trong máy, không gắn với tên, và tách riêng theo từng server. Vào lại từ cùng trình duyệt là còn nguyên đồ và vị trí. Mở cùng nhân vật ở tab thứ hai thì tab cũ bị đẩy ra.
- Nếu có file `data/world.json` từ phiên bản trước, lần chạy đầu sẽ tự chuyển thành server **"Thế giới đầu tiên"**, passcode `1234` (đổi bằng biến `DEFAULT_PASSCODE` trước khi chạy, hoặc đổi trong bảng quản trị).

### Thông số thế giới

Khi tạo server, admin mở mục **⚙️ Thông số thế giới** để chọn gói **Dễ / Mặc định / Khó**, rồi chỉnh tiếp từng ô nếu muốn: độ dài ngày và tỉ lệ ngày/đêm, tốc độ đói, đồ ăn hư, tài nguyên mọc lại, công trình bỏ hoang, số nhện và thú, chó săn (bật/tắt, ngày đầu, số lượng), từng boss (bật/tắt, ngày đầu, máu), lịch boss quay lại, mức boss mạnh lên sau mỗi lần bị hạ, và boss với chó săn có được ra cùng lúc không. Không mở mục này thì server dùng gói Mặc định.

Thông số **chỉ đặt được lúc tạo**, sau đó admin chỉ xem được (nút *Xem* trong bảng quản trị). Người chơi thấy tên gói trên thẻ server và toàn bộ thông số trong bảng Hướng dẫn khi đã vào game. Server tạo trước khi có tính năng này dùng gói Mặc định. Thêm thông số mới: thêm một dòng vào `SETTINGS` trong `shared/settings.js` rồi đọc `this.cfg.<tên>` trong `server/game.js`.

**Khi deploy:** server phải có ổ đĩa lưu lâu dài, nếu không mỗi lần deploy lại là mất hết server. Render gói miễn phí **không** giữ file; cần thêm Persistent Disk (gói trả phí) và trỏ `DATA_DIR` vào đó. Với Docker: `docker run -v ds-data:/app/data -e ADMIN_PASSWORD=... -p 3000:3000 dont-starve-web`.

## Thế giới vô hạn

Thế giới chia thành các chunk 1000×1000. Server chỉ tạo chunk khi có người chơi đi tới gần, và mỗi người chơi chỉ nhận dữ liệu các chunk quanh mình (lưới 3×3, bỏ đi khi ra xa hơn 2 chunk). Vùng đất (đồng cỏ / rừng / đất đá) được tính bằng công thức từ một seed, nên server và client luôn ra cùng kết quả. Muốn tạo lại đúng một thế giới thì đặt `SEED=12345` khi chạy server.

## Giới hạn hiện tại

- Chunk đã tạo được giữ lại mãi, nên nếu đi khám phá rất xa thì dữ liệu của server sẽ lớn dần.
- Chỉ có một tài khoản admin.
- Âm thanh mới có nhạc nền và nhạc chuyển buổi (sáng, chạng vạng) trong `client/public/sounds/`, chưa có tiếng động khi chặt, đánh, ăn…

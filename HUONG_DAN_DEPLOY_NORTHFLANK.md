# HƯỚNG DẪN TỪNG BƯỚC DEPLOY APP LÊN NORTHFLANK

Tài liệu này hướng dẫn chi tiết cách đưa ứng dụng lên hosting **Northflank** (sử dụng Dockerfile hoặc Buildpack tiêu chuẩn).

---

## 1. Tổng quan cấu hình hệ thống
- **Công nghệ**: React (Vite SPA) + Express Server (Node.js 20+).
- **Cổng nội bộ (Container Port)**: `3000`.
- **Health Check Endpoint**: `/health` hoặc `/api/health` (trả về HTTP 200 OK).
- **Cơ sở dữ liệu**: MongoDB (Khuyên dùng Addon MongoDB của Northflank hoặc MongoDB Atlas miễn phí). Ứng dụng cũng có sẵn chế độ In-Memory dự phòng nếu chưa kết nối MongoDB.

---

## 2. Các bước triển khai trên Northflank

### Bước 1: Đẩy mã nguồn lên GitHub / GitLab
1. Tạo một repository mới trên GitHub (ví dụ: `tam-an-journal` hoặc `my-app`).
2. Commit toàn bộ mã nguồn của dự án (đã bao gồm file `Dockerfile`, `.dockerignore`, `package.json`, v.v.) và đẩy lên repository.

### Bước 2: Tạo Project trên Northflank
1. Đăng nhập vào [Northflank Dashboard](https://app.northflank.com/).
2. Nhấn **Create Project** -> Đặt tên dự án (ví dụ: `TamAn-App`).

### Bước 3: Tạo MongoDB Addon (Tùy chọn nhưng khuyên dùng để lưu trữ lâu dài)
1. Trong Project vừa tạo, chọn tab **Addons** -> Nhấn **Create Addon**.
2. Chọn **MongoDB**.
3. Chọn gói (gói Free hoặc Micro theo nhu cầu).
4. Sau khi khởi tạo xong, vào mục **Connection Details**, sao chép chuỗi kết nối (`Connection string` hoặc URI).

*(Ghi chú: Bạn cũng có thể dùng MongoDB Atlas hoặc để trống để chạy chế độ In-Memory).*

### Bước 4: Tạo Service để chạy ứng dụng
1. Vào tab **Services** -> Chọn **Create Service** -> Chọn **Combined Service** (vừa Build vừa Run) hoặc **Deployment Service**.
2. Đặt tên Service (ví dụ: `tam-an-web`).
3. Tại mục **Source**:
   - Chọn **Build from Git repository**.
   - Kết nối với tài khoản GitHub / GitLab của bạn và chọn Repository đã đẩy mã nguồn ở Bước 1.
   - Branch: `main` (hoặc nhánh bạn muốn deploy).
4. Tại mục **Build Type**:
   - Khuyên dùng: **Dockerfile** (Northflank sẽ tự động nhận diện file `Dockerfile` đã được tối ưu sẵn trong dự án).
   - *Cách 2 (Buildpack)*: Nếu chọn Buildpack, chọn Node.js runtime, hệ thống sẽ tự chạy `npm run build` và `npm run start`.

### Bước 5: Cấu hình Ports & Networking (Rất quan trọng)
1. Trong cấu hình Service, tìm mục **Ports**:
   - **Port number**: `3000`
   - **Protocol**: `HTTP`
   - **Public**: Bật **ON** (Public port) để người dùng bên ngoài có thể truy cập qua Internet.
2. Tìm mục **Health Checks**:
   - **Type**: `HTTP`
   - **Path**: `/health`
   - **Port**: `3000`
   - Thao tác này giúp Northflank tự động kiểm tra xem ứng dụng đã sẵn sàng nhận request hay chưa.

### Bước 6: Cấu hình Biến môi trường (Environment Variables)
Trong mục **Environment** của Service, thêm các biến sau:

| Tên biến | Giá trị gợi ý | Ghi chú |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Bắt buộc để tối ưu hiệu năng và bảo mật |
| `PORT` | `3000` | Cổng ứng dụng lắng nghe |
| `JWT_SECRET` | *(Một chuỗi ngẫu nhiên dài từ 32 ký tự)* | Dùng để mã hóa token xác thực người dùng |
| `MONGODB_URI` | *(Chuỗi kết nối lấy từ Bước 3)* | Kết nối CSDL MongoDB |
| `GEMINI_API_KEY` | *(Khóa Gemini API của bạn nếu có)* | Dành cho tính năng AI phân tích cảm xúc |
| `APP_URL` | `https://<ten-service>.code.northflank.app` | URL domain được cấp sau khi deploy |

### Bước 7: Bấm Deploy
1. Nhấn **Create Service** (hoặc **Deploy**).
2. Northflank sẽ tự động pull code, build container qua `Dockerfile`, khởi chạy server và cấp phát chứng chỉ SSL/TLS (HTTPS) miễn phí.
3. Khi status chuyển sang màu xanh lá cây (`Running`), bạn nhấn vào đường link domain của Northflank (dạng `https://...code.northflank.app`) để trải nghiệm ứng dụng.

---

## 3. Các tệp cấu hình đã được thiết lập sẵn trong mã nguồn
- `Dockerfile`: Multi-stage build (Node 20 Alpine), tối ưu dung lượng nhỏ gọn, bảo mật và tốc độ khởi động nhanh.
- `.dockerignore`: Loại bỏ `node_modules`, `.env`, tránh nặng context khi upload lên Northflank.
- `package.json`: Khai báo `"engines": { "node": ">=20.0.0" }`, scripts `build` và `start`.
- `server.ts`:
  - Hỗ trợ biến môi trường `PORT` linh hoạt.
  - Endpoint `/health` phục vụ Liveness & Readiness probe của Kubernetes/Northflank.
  - `trust proxy` kích hoạt sẵn để xử lý HTTPS đằng sau reverse proxy của Northflank.
  - Cơ chế fallback thông minh tự nhận diện build tĩnh khi `NODE_ENV=production`.

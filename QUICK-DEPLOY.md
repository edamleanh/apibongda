# 🚀 DEPLOY NGAY - Hướng dẫn 5 phút

## ⚡ Quick Start (Windows)

### Bước 1: Chạy script tự động
```cmd
cd "c:\Users\edaml\OneDrive\Desktop\New folder\New folder (4)"
setup-deploy.bat
```

### Bước 2: Tạo GitHub Repository
1. Mở https://github.com/new
2. Repository name: `xaycon-scraper-api` 
3. Chọn **Public**
4. **KHÔNG** tick "Add README"
5. Click **Create repository**

### Bước 3: Upload code
```cmd
git remote add origin https://github.com/YOUR_USERNAME/xaycon-scraper-api.git
git push -u origin main
```
*Thay YOUR_USERNAME bằng username GitHub của bạn*

### Bước 4: Deploy trên Render
1. Mở https://render.com
2. **Sign up with GitHub**
3. Click **New +** → **Web Service**
4. Click **Connect repository** → Chọn `xaycon-scraper-api`

### Bước 5: Cấu hình (chỉ điền những field này)
```
Name: xaycon-scraper-api
Runtime: Node
Build Command: npm install
Start Command: npm start
Instance Type: Free
```

### Bước 6: Environment Variables
Click **Advanced** → **Environment Variables**:
```
NODE_ENV = production
```

### Bước 7: Deploy
Click **Create Web Service** → Chờ 5-10 phút

## ✅ Kết quả
Bạn sẽ có URL: `https://xaycon-scraper-api.onrender.com`

## 🧪 Test ngay
```
https://your-app.onrender.com/api/matches
https://your-app.onrender.com/api/status
https://your-app.onrender.com/api/matches/live
```

## 🔄 Keep-Alive (Tùy chọn)
File `.github/workflows/keep-alive.yml` đã có sẵn để tự động ping API.

**Lưu ý**: Nhớ cập nhật URL trong file `keep-alive.yml` sau khi có URL thực từ Render.

---
**Thời gian tổng**: ~10 phút (5 phút setup + 5 phút đợi deploy)
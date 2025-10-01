# 🚀 Hướng dẫn Deploy lên Render.com - Chi tiết từng bước

## Bước 1: Chuẩn bị dự án và tạo Git Repository

### 1.1 Khởi tạo Git trong dự án
```bash
cd "c:\Users\edaml\OneDrive\Desktop\New folder\New folder (4)"
git init
git add .
git commit -m "Initial commit - Xaycon Scraper API"
```

### 1.2 Tạo GitHub Repository
1. Đi tới [github.com](https://github.com)
2. Click **"New repository"**
3. Đặt tên: `xaycon-scraper-api`
4. Chọn **Public** (để dùng free tier)
5. **KHÔNG** check "Add README" (vì đã có sẵn)
6. Click **"Create repository"**

### 1.3 Upload code lên GitHub
```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/xaycon-scraper-api.git
git push -u origin main
```
*Thay `YOUR_USERNAME` bằng username GitHub của bạn*

## Bước 2: Tạo tài khoản và setup Render.com

### 2.1 Đăng ký Render.com
1. Đi tới [render.com](https://render.com)
2. Click **"Get Started"**
3. Chọn **"Sign up with GitHub"** (khuyến khích)
4. Authorize Render để truy cập GitHub

### 2.2 Connect GitHub Repository
1. Sau khi đăng nhập, click **"New +"**
2. Chọn **"Web Service"**
3. Click **"Build and deploy from a Git repository"**
4. Click **"Connect account"** nếu chưa connect GitHub
5. Tìm và chọn repository `xaycon-scraper-api`

## Bước 3: Cấu hình Web Service

### 3.1 Basic Settings
```
Name: xaycon-scraper-api
Region: Oregon (US West) hoặc gần nhất
Branch: main
Root Directory: (để trống)
```

### 3.2 Build & Deploy Settings
```
Runtime: Node
Build Command: npm install
Start Command: npm start
```

### 3.3 Instance Type
```
Instance Type: Free ($0/month)
```

### 3.4 Environment Variables
Click **"Advanced"** và thêm:
```
NODE_ENV = production
```

### 3.5 Auto-Deploy
```
Auto-Deploy: Yes ✅
```

## Bước 4: Deploy

### 4.1 Tạo Service
1. Review tất cả settings
2. Click **"Create Web Service"**
3. Render sẽ bắt đầu build và deploy (5-10 phút)

### 4.2 Theo dõi Deploy Log
- Xem **"Logs"** tab để theo dõi quá trình build
- Chờ thấy message: "🚀 Server is running on port 3000"

## Bước 5: Kiểm tra và Test

### 5.1 Lấy URL
Sau khi deploy thành công, bạn sẽ có URL:
```
https://xaycon-scraper-api.onrender.com
```

### 5.2 Test API Endpoints
```bash
# Kiểm tra trang chủ
https://xaycon-scraper-api.onrender.com/

# Test matches
https://xaycon-scraper-api.onrender.com/api/matches

# Test status
https://xaycon-scraper-api.onrender.com/api/status

# Test live matches
https://xaycon-scraper-api.onrender.com/api/matches/live
```

## 🔧 Troubleshooting

### Lỗi thường gặp:

**1. Build failed - Dependencies**
```bash
# Solution: Kiểm tra package.json có đúng dependencies
npm install  # test local trước
```

**2. Puppeteer không chạy được**
- Đã có sẵn config cho production trong code
- Nếu vẫn lỗi, check logs trong Render dashboard

**3. Memory limit exceeded**
- Free tier có giới hạn 512MB RAM
- API đã tối ưu cho free tier

**4. Cold start (lần đầu chậm)**
- Free tier sleep sau 15 phút không dùng
- Lần đầu wake up mất 30-60 giây (bình thường)

## 🎯 Tối ưu hóa cho Free Tier

### Keep-alive Solutions:

**Option 1: UptimeRobot (Khuyến khích)**
1. Đăng ký [uptimerobot.com](https://uptimerobot.com) (free)
2. Tạo HTTP monitor:
   ```
   URL: https://your-app.onrender.com/api/status
   Interval: 5 minutes
   ```

**Option 2: GitHub Actions Cron**
Tạo file `.github/workflows/keep-alive.yml`:
```yaml
name: Keep Alive
on:
  schedule:
    - cron: '*/14 * * * *'  # Every 14 minutes
jobs:
  keep-alive:
    runs-on: ubuntu-latest
    steps:
      - name: Ping API
        run: curl https://your-app.onrender.com/api/status
```

## 📊 Monitoring

### Render Dashboard
- **Metrics**: CPU, Memory, Network usage
- **Logs**: Real-time application logs
- **Events**: Deploy history

### Custom Monitoring
API có sẵn endpoint `/api/status` để monitor:
```json
{
  "status": "success",
  "uptime": 3600,
  "totalMatches": 19,
  "lastUpdated": "2025-10-02T..."
}
```

## 🔄 Cập nhật Code

### Deploy updates:
```bash
git add .
git commit -m "Update: description of changes"
git push origin main
```
Render sẽ tự động deploy lại (Auto-Deploy enabled)

## 📞 Support

- **Render Docs**: https://render.com/docs
- **API Docs**: Xem trong `/api` endpoint của bạn
- **GitHub Issues**: Tạo issue trong repository

## 🎉 Kết quả

Sau khi hoàn thành, bạn sẽ có:
- ✅ API chạy 24/7 miễn phí
- ✅ Auto-refresh data mỗi phút
- ✅ HTTPS SSL tự động
- ✅ Custom domain support (optional)
- ✅ Monitoring và logs

**URL cuối cùng**: `https://your-app-name.onrender.com`
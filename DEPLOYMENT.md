# 🚀 Hướng dẫn Deploy lên Render.com

## Bước 1: Chuẩn bị Repository

1. Tạo repository trên GitHub
2. Upload toàn bộ code vào repository:

```bash
git init
git add .
git commit -m "Initial commit - Xaycon scraper API"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/xaycon-scraper-api.git
git push -u origin main
```

## Bước 2: Deploy trên Render.com

1. **Đăng ký tài khoản** tại [render.com](https://render.com)

2. **Tạo Web Service mới:**
   - Click "New +" → "Web Service"
   - Chọn "Build and deploy from a Git repository"
   - Connect GitHub và chọn repository của bạn

3. **Cấu hình service:**
   - **Name:** `xaycon-scraper-api`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** `Free` (0$/month)

4. **Environment Variables:**
   ```
   NODE_ENV = production
   ```

5. **Advanced Settings:**
   - **Auto-Deploy:** Yes
   - **Health Check Path:** `/api/status`

6. Click **"Create Web Service"**

## Bước 3: Verify Deployment

Sau khi deploy thành công (khoảng 5-10 phút), bạn sẽ có:

- **API URL:** `https://your-service-name.onrender.com`
- **Status:** `https://your-service-name.onrender.com/api/status`
- **Matches:** `https://your-service-name.onrender.com/api/matches`

## 🔍 Kiểm tra API

### Test endpoints:

1. **Trang chủ:**
```
GET https://your-service-name.onrender.com/
```

2. **Lấy dữ liệu trận đấu:**
```
GET https://your-service-name.onrender.com/api/matches
```

3. **Kiểm tra trạng thái:**
```
GET https://your-service-name.onrender.com/api/status
```

4. **Refresh dữ liệu:**
```
POST https://your-service-name.onrender.com/api/refresh
```

## ⚡ Tính năng

✅ **Tự động cập nhật:** Mỗi 60 giây  
✅ **Free tier:** Hoàn toàn miễn phí  
✅ **24/7 uptime:** Render.com free tier  
✅ **CORS enabled:** Có thể gọi từ frontend  
✅ **Error handling:** Xử lý lỗi tốt  
✅ **Health check:** Monitoring tự động  

## 🚨 Lưu ý quan trọng

### Render.com Free Tier limitations:
- **Sleep mode:** Service sẽ "ngủ" sau 15 phút không có request
- **Cold start:** Lần đầu wake up mất 30-60 giây
- **750 giờ/tháng:** Đủ cho usage thông thường

### Giải pháp keep-alive:
Để API không bị sleep, bạn có thể:

1. **Sử dụng UptimeRobot** (miễn phí):
   - Ping API mỗi 5 phút: `https://your-service-name.onrender.com/api/status`

2. **Cron job external** (miễn phí):
   - GitHub Actions
   - Vercel Functions
   - Netlify Functions

## 🔧 Troubleshooting

### Nếu deployment fail:
1. Check build logs trên Render dashboard
2. Verify `package.json` có đúng start script
3. Ensure Node.js version >= 18

### Nếu scraping không hoạt động:
1. Check service logs
2. Verify xaycon.live accessibility
3. Adjust selectors nếu cần

## 📞 Support

- **Documentation:** https://chatgpt.com/share/68dd6ac7-edd4-800e-9394-5581a80ca0f4
- **Render docs:** https://render.com/docs
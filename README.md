# Xaycon.live Scraper API

API miễn phí để lấy thông tin các cặp trận đấu từ xaycon.live với tính năng tự động cập nhật mỗi phút.

## 🚀 Tính năng

- ⚽ Scrape dữ liệu các trận đấu từ xaycon.live
- 🔄 Tự động cập nhật dữ liệu mỗi phút
- ⏱️ Chờ 5 giây để trang web load đầy đủ
- 🌐 Deploy trên Render.com free tier
- 📊 API RESTful với JSON response

## 📡 API Endpoints

### GET /
Thông tin cơ bản về API

### GET /api/matches
Lấy tất cả thông tin các trận đấu với parsing chi tiết

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "homeTeam": "Saint Gilloise",
      "awayTeam": "Newcastle United", 
      "time": "01/10 23:45",
      "date": "01/10",
      "timeOnly": "23:45",
      "league": "UEFA Champions League",
      "status": "Live",
      "link": "https://www.xaycon.live/truc-tiep/saint-gilloise-vs-newcastle-united-23-45-01-10-2025",
      "rawText": "Saint Gilloise vs Newcastle United 01/10 23:45 UEFA Champions League Live",
      "timestamp": "2025-10-02T..."
    }
  ],
  "lastUpdated": "2025-10-02T...",
  "totalMatches": 10,
  "status": "success",
  "summary": {
    "withTime": 8,
    "withDate": 9,
    "withTimeOnly": 7,
    "withLeague": 6,
    "withStatus": 4,
    "liveMatches": 2
  }
}
```

### GET /api/match/{slug}
Lấy thông tin chi tiết trận đấu theo slug (partial match)

### GET /api/match-by-url?url={fullUrl}
Lấy thông tin chi tiết trận đấu theo URL đầy đủ

**Examples:**
- `/api/match/saint-gilloise-vs-newcastle-united`
- `/api/match-by-url?url=https://www.xaycon.live/truc-tiep/saint-gilloise-vs-newcastle-united-23-45-01-10-2025`

### GET /api/matches/live
Lấy chỉ các trận đấu đang diễn ra

### GET /api/matches/today
Lấy các trận đấu diễn ra hôm nay

### GET /api/matches/date/{date}
Lấy các trận đấu theo ngày cụ thể

**Examples:**
- `/api/matches/date/02/10` - Trận đấu ngày 02/10
- `/api/matches/date/02/10/2025` - Trận đấu ngày 02/10/2025

### GET /api/matches/by-league/{league}
Lấy các trận đấu theo tên giải đấu

**Examples:**
- `/api/matches/by-league/premier` - Premier League
- `/api/matches/by-league/champions` - Champions League

### GET /api/search/{team}
Tìm kiếm trận đấu theo tên đội

**Examples:**
- `/api/search/barcelona` - Tìm trận của Barcelona
- `/api/search/real` - Tìm trận của Real Madrid

### GET /api/status
Kiểm tra trạng thái API

**Response:**
```json
{
  "status": "success",
  "lastUpdated": "2025-10-02T...",
  "totalMatches": 10,
  "uptime": 3600
}
```

### POST /api/refresh
Cập nhật dữ liệu ngay lập tức

## 🛠️ Cài đặt Local

1. Clone repository
2. Cài đặt dependencies:
```bash
npm install
```

3. Chạy development server:
```bash
npm run dev
```

4. Chạy production server:
```bash
npm start
```

## 🌐 Deploy lên Render.com

1. Tạo tài khoản tại [render.com](https://render.com)
2. Kết nối với GitHub repository
3. Chọn "Web Service"
4. Cấu hình:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node.js
   - **Plan:** Free

## 📋 Yêu cầu hệ thống

- Node.js >= 18.0.0
- RAM: 512MB (phù hợp với Render.com free tier)

## 🔧 Cấu hình

API sẽ tự động cập nhật dữ liệu mỗi 60 giây. Bạn có thể thay đổi thời gian này trong file `server.js`:

```javascript
setInterval(updateData, 60000); // 60000ms = 1 phút
```

## 📝 Ghi chú

- API sử dụng Puppeteer để scrape dữ liệu
- Tối ưu hóa cho Render.com free tier
- Cache dữ liệu để giảm tải server
- Xử lý lỗi và fallback khi scraping thất bại

## 🤝 Đóng góp

Vui lòng tạo issue hoặc pull request để đóng góp cải thiện API.

## 📞 Hỗ trợ

Tham khảo thêm: https://chatgpt.com/share/68dd6ac7-edd4-800e-9394-5581a80ca0f4
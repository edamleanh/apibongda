const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Cache để lưu dữ liệu
let cachedData = {
  matches: [],
  lastUpdated: null,
  status: 'initializing'
};

// Cấu hình Puppeteer cho Render.com
const getBrowserConfig = () => {
  if (process.env.NODE_ENV === 'production') {
    return {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    };
  }
  return { headless: 'new' };
};

// Hàm scrape dữ liệu từ xaycon.live
async function scrapeMatches() {
  let browser;
  try {
    console.log('Starting browser...');
    browser = await puppeteer.launch(getBrowserConfig());
    
    const page = await browser.newPage();
    
    // Thiết lập User-Agent để tránh bị block
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    console.log('Navigating to xaycon.live...');
    await page.goto('https://xaycon.live', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // Chờ 5 giây để trang load đầy đủ
    console.log('Waiting 5 seconds for page to fully load...');
    await page.waitForTimeout(5000);
    
    // Chờ thêm để đảm bảo JavaScript render xong
    try {
      await page.waitForSelector('div[class*="bg-match-card"], [class*="match"]', { timeout: 10000 });
      console.log('Match elements detected, waiting 2 more seconds...');
      await page.waitForTimeout(2000);
    } catch (e) {
      console.log('No specific match elements found, proceeding with general scraping...');
    }
    
    // Scrape dữ liệu các trận đấu với parsing chi tiết
    const matches = await page.evaluate(() => {
      const matchElements = [];
      
      // Helper function để tạo link slug từ thông tin trận đấu
      function generateMatchLink(homeTeam, awayTeam, timeOnly, date) {
        try {
          // Chuẩn hóa tên đội
          const normalizeTeam = (team) => {
            if (!team) return '';
            return team
              .toLowerCase()
              .replace(/[^\w\s-]/g, '') // Loại bỏ ký tự đặc biệt
              .replace(/\s+/g, '-')     // Thay space bằng dấu gạch ngang
              .replace(/-+/g, '-')      // Gộp nhiều dấu gạch ngang thành 1
              .replace(/^-|-$/g, '');   // Loại bỏ dấu gạch ngang đầu cuối
          };
          
          const homeSlug = normalizeTeam(homeTeam);
          const awaySlug = normalizeTeam(awayTeam);
          
          // Chuẩn hóa thời gian (HH-MM)
          let timeSlug = '';
          if (timeOnly) {
            timeSlug = timeOnly.replace(':', '-');
          }
          
          // Chuẩn hóa ngày (DD-MM-YYYY)
          let dateSlug = '';
          if (date) {
            // Nếu date có dạng DD/MM, thêm năm hiện tại
            if (date.match(/^\d{1,2}\/\d{1,2}$/)) {
              const currentYear = new Date().getFullYear();
              dateSlug = date.replace('/', '-') + '-' + currentYear;
            } 
            // Nếu date có dạng DD/MM/YYYY
            else if (date.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
              dateSlug = date.replace(/\//g, '-');
            }
            // Các format khác
            else {
              dateSlug = date.replace(/[\/\s]/g, '-');
            }
          }
          
          // Tạo slug theo format: team1-vs-team2-HH-MM-DD-MM-YYYY
          const parts = [homeSlug, 'vs', awaySlug];
          if (timeSlug) parts.push(timeSlug);
          if (dateSlug) parts.push(dateSlug);
          
          const slug = parts.filter(p => p).join('-');
          
          // Tạo URL đầy đủ với domain xaycon.live
          return `https://www.xaycon.live/truc-tiep/${slug}`;
          
        } catch (e) {
          console.log('Error generating match link:', e);
          return '';
        }
      }

      // Helper function để parse thông tin trận đấu từ xaycon.live
      function parseXayconMatch(container) {
        const match = {
          homeTeam: '',
          awayTeam: '',
          time: '',
          date: '',
          timeOnly: '',
          league: '',
          status: '',
          rawText: container.innerText || container.textContent || ''
        };
        
        try {
          // Parse time và date từ cấu trúc xaycon.live: "23:45" và "01/10"
          const timeElements = container.querySelectorAll('.text-primary.font-bold');
          timeElements.forEach(el => {
            const text = el.textContent || '';
            
            // Tìm thời gian (HH:MM)
            const timeMatch = text.match(/(\d{1,2}:\d{2})/);
            if (timeMatch && !match.timeOnly) {
              match.timeOnly = timeMatch[0];
            }
            
            // Tìm ngày (DD/MM)
            const dateMatch = text.match(/(\d{1,2}\/\d{1,2})/);
            if (dateMatch && !match.date) {
              match.date = dateMatch[0];
            }
          });
          
          // Kết hợp time và date
          if (match.timeOnly && match.date) {
            match.time = `${match.date} ${match.timeOnly}`;
          } else if (match.timeOnly) {
            match.time = match.timeOnly;
          } else if (match.date) {
            match.time = match.date;
          }
          
          // Parse league name
          const leagueElements = container.querySelectorAll('.text-primary.font-bold');
          leagueElements.forEach(el => {
            const text = el.textContent || '';
            if (text.length > 10 && !text.match(/\d{1,2}:\d{2}/) && !text.match(/\d{1,2}\/\d{1,2}/)) {
              if (!match.league || text.length > match.league.length) {
                match.league = text.trim();
              }
            }
          });
          
          // Parse team names từ alt attributes của images
          const teamImages = container.querySelectorAll('img[alt]');
          const teamNames = [];
          teamImages.forEach(img => {
            const alt = img.getAttribute('alt');
            if (alt && alt !== 'live' && alt !== 'xay-con-avatar' && !alt.includes('ic_')) {
              teamNames.push(alt.trim());
            }
          });
          
          if (teamNames.length >= 2) {
            match.homeTeam = teamNames[0];
            match.awayTeam = teamNames[1];
          }
          
          // Fallback: parse team names từ text
          if (!match.homeTeam || !match.awayTeam) {
            const allText = match.rawText;
            const teamPatterns = [
              /(.+?)\s+vs\s+(.+)/i,
              /(.+?)\s+VS\s+(.+)/,
              /(.+?)\s+-\s+(.+)/,
              /(.+?)\s+v\s+(.+)/i
            ];
            
            for (const pattern of teamPatterns) {
              const teamMatch = allText.match(pattern);
              if (teamMatch) {
                match.homeTeam = teamMatch[1].trim();
                match.awayTeam = teamMatch[2].trim();
                break;
              }
            }
          }
          
          // Parse status (LIVE, etc.)
          const statusElements = container.querySelectorAll('.text-status-red, [class*="status"]');
          statusElements.forEach(el => {
            const text = el.textContent || '';
            if (text.includes('LIVE') || text.includes('Đang diễn ra')) {
              match.status = 'LIVE';
            }
          });
          
          // Fallback status detection
          if (!match.status && match.rawText.toLowerCase().includes('live')) {
            match.status = 'LIVE';
          }
          
        } catch (e) {
          console.log('Error parsing xaycon match:', e);
        }
        
        // Tạo link slug
        match.link = generateMatchLink(match.homeTeam, match.awayTeam, match.timeOnly, match.date);
        
        return match;
      }
      
      // Helper function để parse thông tin trận đấu generic
      function parseMatchInfo(text) {
        const match = {
          homeTeam: '',
          awayTeam: '',
          time: '',           // Thời gian đầy đủ (ngày + giờ)
          date: '',           // Chỉ ngày
          timeOnly: '',       // Chỉ giờ
          league: '',
          status: '',
          rawText: text.trim()
        };
        
        // Regex patterns để tìm ngày tháng và thời gian
        const dateTimePatterns = [
          // Ngày đầy đủ với thời gian
          /(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2})/g,     // 02/10/2025 19:30
          /(\d{1,2}-\d{1,2}-\d{4}\s+\d{1,2}:\d{2})/g,       // 02-10-2025 19:30
          /(\d{4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2})/g,       // 2025-10-02 19:30
          
          // Ngày không có năm với thời gian
          /(\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2})/g,            // 02/10 19:30
          /(\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2})/g,             // 02-10 19:30
          
          // Chỉ ngày
          /(\d{1,2}\/\d{1,2}\/\d{4})/g,                      // 02/10/2025
          /(\d{1,2}-\d{1,2}-\d{4})/g,                        // 02-10-2025
          /(\d{4}-\d{1,2}-\d{1,2})/g,                        // 2025-10-02
          /(\d{1,2}\/\d{1,2})/g,                             // 02/10
          /(\d{1,2}-\d{1,2})/g,                              // 02-10
          
          // Ngày bằng từ
          /(Today|Tomorrow|Hôm nay|Ngày mai|Hôm qua|Yesterday)/gi,
          /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/gi,
          /(Thứ hai|Thứ ba|Thứ tư|Thứ năm|Thứ sáu|Thứ bảy|Chủ nhật)/gi,
          
          // Chỉ thời gian
          /(\d{1,2}:\d{2})/g                                 // 19:30
        ];
        
        // Tìm ngày giờ (ưu tiên pattern đầy đủ nhất)
        for (const pattern of dateTimePatterns) {
          const timeMatch = text.match(pattern);
          if (timeMatch) {
            match.time = timeMatch[0];
            break;
          }
        }
        
        // Tách riêng ngày và giờ nếu có thể
        if (match.time) {
          const fullDateTime = match.time;
          
          // Tách ngày
          const datePatterns = [
            /(\d{1,2}\/\d{1,2}\/\d{4})/,
            /(\d{1,2}-\d{1,2}-\d{4})/,
            /(\d{4}-\d{1,2}-\d{1,2})/,
            /(\d{1,2}\/\d{1,2})/,
            /(\d{1,2}-\d{1,2})/,
            /(Today|Tomorrow|Hôm nay|Ngày mai|Hôm qua|Yesterday)/i,
            /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i,
            /(Thứ hai|Thứ ba|Thứ tư|Thứ năm|Thứ sáu|Thứ bảy|Chủ nhật)/i
          ];
          
          // Tách giờ
          const timeOnlyPattern = /(\d{1,2}:\d{2})/;
          
          for (const datePattern of datePatterns) {
            const dateMatch = fullDateTime.match(datePattern);
            if (dateMatch) {
              match.date = dateMatch[0];
              break;
            }
          }
          
          const timeMatch = fullDateTime.match(timeOnlyPattern);
          if (timeMatch) {
            match.timeOnly = timeMatch[0];
          }
        }
        
        // Tìm các đội (patterns khác nhau cho vs, VS, -)
        const teamPatterns = [
          /(.+?)\s+vs\s+(.+)/i,
          /(.+?)\s+VS\s+(.+)/,
          /(.+?)\s+-\s+(.+)/,
          /(.+?)\s+v\s+(.+)/i
        ];
        
        for (const pattern of teamPatterns) {
          const teamMatch = text.match(pattern);
          if (teamMatch) {
            match.homeTeam = teamMatch[1].trim();
            match.awayTeam = teamMatch[2].trim();
            break;
          }
        }
        
        // Tìm tên giải (thường là các từ viết hoa hoặc có pattern đặc biệt)
        const leaguePatterns = [
          /(Premier League|La Liga|Serie A|Bundesliga|Ligue 1)/gi,
          /(Champions League|Europa League|Conference League)/gi,
          /(World Cup|Euro|Nations League)/gi,
          /(V-League|V\.League|V League)/gi,
          /(Copa|Cup|Championship)/gi,
          /([A-Z]{2,}\s+[A-Z]{2,})/g
        ];
        
        for (const pattern of leaguePatterns) {
          const leagueMatch = text.match(pattern);
          if (leagueMatch) {
            match.league = leagueMatch[0];
            break;
          }
        }
        
        // Tìm trạng thái (Live, FT, HT, etc.)
        const statusPatterns = [
          /(LIVE|Live|live)/,
          /(FT|Full Time|Kết thúc)/i,
          /(HT|Half Time|Hiệp 1)/i,
          /(\d+'\s*)/,  // 45'
          /(Chưa bắt đầu|Not started)/i
        ];
        
        for (const pattern of statusPatterns) {
          const statusMatch = text.match(pattern);
          if (statusMatch) {
            match.status = statusMatch[0];
            break;
          }
        }
        
        // Tạo link slug
        match.link = generateMatchLink(match.homeTeam, match.awayTeam, match.timeOnly, match.date);
        
        return match;
      }
      
      // Tìm các element chứa thông tin trận đấu với selectors cụ thể cho xaycon.live
      const selectors = [
        // Selector chính cho match cards xaycon.live
        'div.bg-match-card',
        'div[class*="bg-match-card"]',
        'div[class*="border-bd-match"]',
        
        // Fallback selectors
        '[class*="match"]',
        '[class*="game"]', 
        '[class*="fixture"]',
        '[class*="event"]',
        '.row',
        '.item',
        'tr',
        'div[data-*]'
      ];
      
      selectors.forEach(selector => {
        try {
          const containers = document.querySelectorAll(selector);
          containers.forEach((container, index) => {
            try {
              const text = container.innerText || container.textContent || '';
              
              // Sử dụng parser chuyên biệt cho xaycon.live
              let parsedMatch;
              if (selector.includes('bg-match-card') || selector.includes('border-bd-match')) {
                parsedMatch = parseXayconMatch(container);
              } else {
                // Fallback to generic parser
                parsedMatch = parseMatchInfo(text);
              }
              
              // Lọc các container có thông tin trận đấu hợp lệ
              const hasValidMatch = (parsedMatch.homeTeam && parsedMatch.awayTeam) || 
                                  (text.length > 10 && (text.includes('vs') || text.includes('VS') || text.includes(' - ') || text.includes(' v ')));
              
              if (hasValidMatch) {
                // Nếu chưa có team names từ xaycon parser, thử generic parser
                if (!parsedMatch.homeTeam || !parsedMatch.awayTeam) {
                  const genericMatch = parseMatchInfo(text);
                  if (genericMatch.homeTeam) parsedMatch.homeTeam = genericMatch.homeTeam;
                  if (genericMatch.awayTeam) parsedMatch.awayTeam = genericMatch.awayTeam;
                  if (!parsedMatch.time && genericMatch.time) parsedMatch.time = genericMatch.time;
                  if (!parsedMatch.league && genericMatch.league) parsedMatch.league = genericMatch.league;
                  if (!parsedMatch.status && genericMatch.status) parsedMatch.status = genericMatch.status;
                }
                
                // Chỉ thêm nếu có ít nhất đội nhà và đội khách
                if (parsedMatch.homeTeam && parsedMatch.awayTeam) {
                  matchElements.push({
                    id: matchElements.length + 1,
                    homeTeam: parsedMatch.homeTeam,
                    awayTeam: parsedMatch.awayTeam,
                    time: parsedMatch.time,           // Thời gian đầy đủ
                    date: parsedMatch.date,           // Chỉ ngày
                    timeOnly: parsedMatch.timeOnly,   // Chỉ giờ
                    league: parsedMatch.league,
                    status: parsedMatch.status,
                    link: parsedMatch.link,           // Link slug
                    rawText: parsedMatch.rawText,
                    html: container.innerHTML,
                    timestamp: new Date().toISOString(),
                    source: selector.includes('bg-match-card') ? 'xaycon-specific' : 'generic'
                  });
                }
              }
            } catch (e) {
              console.log('Error processing container:', e);
            }
          });
        } catch (e) {
          console.log('Error with selector:', selector, e);
        }
      });
      
      // Fallback: parse toàn bộ text của trang
      if (matchElements.length === 0) {
        const allText = document.body.innerText || '';
        const lines = allText.split('\n');
        
        lines.forEach((line, index) => {
          const trimmedLine = line.trim();
          if (trimmedLine.length > 10 && (trimmedLine.includes('vs') || trimmedLine.includes('VS') || trimmedLine.includes(' - '))) {
            const parsedMatch = parseMatchInfo(trimmedLine);
            
            if (parsedMatch.homeTeam && parsedMatch.awayTeam) {
              matchElements.push({
                id: matchElements.length + 1,
                homeTeam: parsedMatch.homeTeam,
                awayTeam: parsedMatch.awayTeam,
                time: parsedMatch.time,
                date: parsedMatch.date,
                timeOnly: parsedMatch.timeOnly,
                league: parsedMatch.league,
                status: parsedMatch.status,
                link: parsedMatch.link,
                rawText: parsedMatch.rawText,
                timestamp: new Date().toISOString()
              });
            }
          }
        });
      }
      
      // Loại bỏ duplicates dựa trên homeTeam + awayTeam
      const uniqueMatches = [];
      const seen = new Set();
      
      matchElements.forEach(match => {
        const key = `${match.homeTeam}_${match.awayTeam}`.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          uniqueMatches.push(match);
        }
      });
      
      return uniqueMatches;
    });
    
    console.log(`Found ${matches.length} matches`);
    
    return {
      success: true,
      matches: matches,
      scrapedAt: new Date().toISOString(),
      totalMatches: matches.length
    };
    
  } catch (error) {
    console.error('Error scraping matches:', error);
    return {
      success: false,
      error: error.message,
      matches: [],
      scrapedAt: new Date().toISOString()
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Hàm cập nhật dữ liệu
async function updateData() {
  console.log('Updating match data...');
  cachedData.status = 'updating';
  
  const result = await scrapeMatches();
  
  if (result.success) {
    cachedData.matches = result.matches;
    cachedData.lastUpdated = result.scrapedAt;
    cachedData.status = 'success';
    cachedData.totalMatches = result.totalMatches;
    console.log(`Data updated successfully. Found ${result.totalMatches} matches.`);
  } else {
    cachedData.status = 'error';
    cachedData.error = result.error;
    console.error('Failed to update data:', result.error);
  }
}

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Xaycon.live Scraper API - Enhanced Version',
    version: '1.1.0',
    features: [
      'Detailed match parsing (home/away teams, time, league, status)',
      'Auto-refresh every 60 seconds',
      'Advanced filtering and search'
    ],
    endpoints: {
      '/api/matches': 'Get all match data with detailed parsing',
      '/api/matches/live': 'Get live matches only',
      '/api/matches/today': 'Get today\'s matches',
      '/api/matches/by-league/{league}': 'Get matches by league name',
      '/api/matches/date/{date}': 'Get matches by date (format: DD/MM or DD/MM/YYYY)',
      '/api/search/{team}': 'Search matches by team name',
      '/api/match/{slug}': 'Get specific match by slug (partial match)',
      '/api/match-by-url?url={fullUrl}': 'Get specific match by full URL',
      '/api/status': 'Get API status and statistics',
      '/api/refresh': 'Force refresh data',
      '/api/debug': 'Debug information and parsing sources'
    },
    examples: {
      'All matches': '/api/matches',
      'Live matches': '/api/matches/live',
      'Today matches': '/api/matches/today',
      'Premier League': '/api/matches/by-league/premier',
      'Date 02/10': '/api/matches/date/02/10',
      'Search Barcelona': '/api/search/barcelona',
      'Match by slug': '/api/match/saint-gilloise-vs-newcastle-united',
      'Match by full URL': '/api/match-by-url?url=https://www.xaycon.live/truc-tiep/saint-gilloise-vs-newcastle-united-23-45-01-10-2025'
    },
    documentation: 'https://chatgpt.com/share/68dd6ac7-edd4-800e-9394-5581a80ca0f4'
  });
});

app.get('/api/matches', (req, res) => {
  res.json({
    success: true,
    data: cachedData.matches,
    lastUpdated: cachedData.lastUpdated,
    totalMatches: cachedData.totalMatches || 0,
    status: cachedData.status,
    summary: {
      withTime: cachedData.matches.filter(m => m.time).length,
      withDate: cachedData.matches.filter(m => m.date).length,
      withTimeOnly: cachedData.matches.filter(m => m.timeOnly).length,
      withLeague: cachedData.matches.filter(m => m.league).length,
      withStatus: cachedData.matches.filter(m => m.status).length,
      liveMatches: cachedData.matches.filter(m => m.status && m.status.toLowerCase().includes('live')).length
    }
  });
});

// Endpoint mới để lấy matches theo giải đấu
app.get('/api/matches/by-league/:league', (req, res) => {
  const league = req.params.league.toLowerCase();
  const filteredMatches = cachedData.matches.filter(match => 
    match.league && match.league.toLowerCase().includes(league)
  );
  
  res.json({
    success: true,
    league: req.params.league,
    data: filteredMatches,
    totalMatches: filteredMatches.length,
    lastUpdated: cachedData.lastUpdated
  });
});

// Endpoint để lấy matches đang diễn ra
app.get('/api/matches/live', (req, res) => {
  const liveMatches = cachedData.matches.filter(match => 
    match.status && match.status.toLowerCase().includes('live')
  );
  
  res.json({
    success: true,
    data: liveMatches,
    totalMatches: liveMatches.length,
    lastUpdated: cachedData.lastUpdated
  });
});

// Endpoint để search đội bóng
app.get('/api/search/:team', (req, res) => {
  const teamName = req.params.team.toLowerCase();
  const foundMatches = cachedData.matches.filter(match => 
    (match.homeTeam && match.homeTeam.toLowerCase().includes(teamName)) ||
    (match.awayTeam && match.awayTeam.toLowerCase().includes(teamName))
  );
  
  res.json({
    success: true,
    searchTerm: req.params.team,
    data: foundMatches,
    totalMatches: foundMatches.length,
    lastUpdated: cachedData.lastUpdated
  });
});

// Endpoint debug để xem raw data và source parsing
app.get('/api/debug', (req, res) => {
  const debugData = cachedData.matches.map(match => ({
    id: match.id,
    teams: `${match.homeTeam} vs ${match.awayTeam}`,
    time: match.time,
    date: match.date,
    timeOnly: match.timeOnly,
    league: match.league,
    status: match.status,
    link: match.link,
    source: match.source || 'unknown',
    rawTextLength: match.rawText ? match.rawText.length : 0,
    rawTextPreview: match.rawText ? match.rawText.substring(0, 100) + '...' : 'No raw text'
  }));
  
  const sourceCounts = {};
  cachedData.matches.forEach(match => {
    const source = match.source || 'unknown';
    sourceCounts[source] = (sourceCounts[source] || 0) + 1;
  });
  
  res.json({
    success: true,
    totalMatches: cachedData.matches.length,
    sourceCounts,
    lastUpdated: cachedData.lastUpdated,
    sampleMatches: debugData.slice(0, 10),
    allMatches: debugData
  });
});

// Endpoint để lấy matches theo ngày
app.get('/api/matches/date/:date', (req, res) => {
  const targetDate = req.params.date;
  const foundMatches = cachedData.matches.filter(match => 
    match.date && match.date.includes(targetDate)
  );
  
  res.json({
    success: true,
    date: targetDate,
    data: foundMatches,
    totalMatches: foundMatches.length,
    lastUpdated: cachedData.lastUpdated
  });
});

// Endpoint để lấy matches hôm nay
app.get('/api/matches/today', (req, res) => {
  const today = new Date();
  const todayStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}`;
  
  const todayMatches = cachedData.matches.filter(match => 
    (match.date && match.date.includes(todayStr)) ||
    (match.date && (match.date.toLowerCase().includes('today') || match.date.toLowerCase().includes('hôm nay')))
  );
  
  res.json({
    success: true,
    date: 'Today',
    data: todayMatches,
    totalMatches: todayMatches.length,
    lastUpdated: cachedData.lastUpdated
  });
});

// Endpoint để lấy match theo link slug (chỉ slug, không cần domain)
app.get('/api/match/:link', (req, res) => {
  const slug = req.params.link;
  // Tìm match có link chứa slug này
  const foundMatch = cachedData.matches.find(match => 
    match.link && match.link.includes(slug)
  );
  
  if (foundMatch) {
    res.json({
      success: true,
      data: foundMatch,
      lastUpdated: cachedData.lastUpdated
    });
  } else {
    res.status(404).json({
      success: false,
      error: 'Match not found',
      slug: slug,
      availableLinks: cachedData.matches.map(m => m.link).filter(Boolean).slice(0, 5)
    });
  }
});

// Endpoint mới để lấy match theo full URL
app.get('/api/match-by-url', (req, res) => {
  const fullUrl = req.query.url;
  if (!fullUrl) {
    return res.status(400).json({
      success: false,
      error: 'URL parameter is required',
      example: '/api/match-by-url?url=https://www.xaycon.live/truc-tiep/saint-gilloise-vs-newcastle-united-23-45-01-10-2025'
    });
  }
  
  const foundMatch = cachedData.matches.find(match => match.link === fullUrl);
  
  if (foundMatch) {
    res.json({
      success: true,
      data: foundMatch,
      lastUpdated: cachedData.lastUpdated
    });
  } else {
    res.status(404).json({
      success: false,
      error: 'Match not found',
      url: fullUrl
    });
  }
});

app.get('/api/status', (req, res) => {
  res.json({
    status: cachedData.status,
    lastUpdated: cachedData.lastUpdated,
    totalMatches: cachedData.totalMatches || 0,
    uptime: process.uptime(),
    error: cachedData.error || null
  });
});

app.post('/api/refresh', async (req, res) => {
  await updateData();
  res.json({
    success: true,
    message: 'Data refresh initiated',
    status: cachedData.status,
    lastUpdated: cachedData.lastUpdated
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Khởi tạo server
async function startServer() {
  try {
    // Cập nhật dữ liệu lần đầu
    await updateData();
    
    // Thiết lập cập nhật tự động mỗi phút
    setInterval(updateData, 60000); // 60 giây = 1 phút
    
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📊 API Status: http://localhost:${PORT}/api/status`);
      console.log(`⚽ Matches: http://localhost:${PORT}/api/matches`);
      console.log(`🔄 Auto-refresh every 60 seconds`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
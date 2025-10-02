require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const helmet = require('helmet');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ THÊM HELPER FUNCTION NÀY
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ✅ Function to ensure Chrome is installed
async function ensureChromeInstalled() {
  try {
    // Check if Chrome already exists
    const chromePath = puppeteer.executablePath();
    if (fs.existsSync(chromePath)) {
      console.log('✅ Chrome already installed at:', chromePath);
      return true;
    }
  } catch (error) {
    console.log('⚠️ Chrome not found, installing...');
  }


  // Install Chrome if not found
  try {
    console.log('📦 Installing Chrome via Puppeteer...');
    execSync('npx puppeteer browsers install chrome', { 
      stdio: 'inherit',
      timeout: 120000 // 2 minutes timeout
    });
    console.log('✅ Chrome installation complete!');
    return true;
  } catch (error) {
    console.error('❌ Failed to install Chrome:', error.message);
    return false;
  }
}

// ✅ THÊM: Browser Pool - Biến global để lưu browser instance
let globalBrowser = null;

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

// ✅ Hàm lấy hoặc tạo browser (reuse thay vì tạo mới mỗi lần)
async function getBrowser() {
  if (!globalBrowser || !globalBrowser.isConnected()) {
    console.log('Creating new browser instance...');
    globalBrowser = await puppeteer.launch(getBrowserConfig());
  }
  return globalBrowser;
}

// Hàm scrape dữ liệu từ ThapcamTV
async function scrapeMatches() {
  let page;
  try {
    console.log('Starting scrape...');
    
    // ✅ REUSE browser thay vì tạo mới
    const browser = await getBrowser();
    page = await browser.newPage();
    
    // Thiết lập User-Agent để tránh bị block
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // ===== BƯỚC 1: Truy cập bit.ly/tiengruoi =====
    console.log('Step 1: Navigating to bit.ly/tiengruoi...');
    await page.goto('https://bit.ly/tiengruoi', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // Chờ page load
    await wait(3000);
    
    // ===== BƯỚC 2: Tìm link ThapcamTV =====
    console.log('Step 2: Finding ThapcamTV link...');
    await page.waitForSelector('.group-link', { timeout: 10000 });
    
    const thapcamLink = await page.evaluate(() => {
      const groupLinks = document.querySelectorAll('.group-link');
      for (let group of groupLinks) {
        const textSpan = group.querySelector('span.text');
        if (textSpan && textSpan.textContent.includes('ThapcamTV')) {
          const link = group.querySelector('a.ref-link');
          if (link && link.href) {
            return link.href;
          }
        }
      }
      return null;
    });
    
    if (!thapcamLink) {
      throw new Error('ThapcamTV link not found on page');
    }
    
    console.log('Found ThapcamTV link:', thapcamLink);
    
    // ===== BƯỚC 3: Thêm /football vào URL =====
    const footballUrl = thapcamLink.endsWith('/') 
      ? thapcamLink + 'football' 
      : thapcamLink + '/football';
    
    console.log('Step 3: Navigating to football page:', footballUrl);
    
    // ===== BƯỚC 4: Truy cập trang football =====
    await page.goto(footballUrl, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // Chờ trang load đầy đủ
    console.log('Step 4: Waiting for football page to load...');
    await wait(5000);
    
    console.log('Step 5: Extracting LIVE match data...');
    
    // Chờ thêm để đảm bảo JavaScript render xong
    try {
      await page.waitForSelector('[class*="match"], [class*="live"], [class*="game"]', { timeout: 10000 });
      console.log('Match elements detected, waiting 2 more seconds...');
      await wait(2000);
    } catch (e) {
      console.log('No specific match elements found, proceeding with general scraping...');
    }
    
    // ===== BƯỚC 5: Scrape LIVE matches từ football page =====
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
          homeTeamLogo: '',
          awayTeamLogo: '',
          time: '',
          date: '',
          timeOnly: '',
          league: '',
          status: '',
          blv: '',
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
          const teamLogos = [];
          
          teamImages.forEach(img => {
            const alt = img.getAttribute('alt');
            if (alt && alt !== 'live' && alt !== 'xay-con-avatar' && !alt.includes('ic_')) {
              teamNames.push(alt.trim());
              
              // ✅ Extract logo URL
              let logoUrl = '';
              
              // Try srcset first (better quality)
              const srcset = img.getAttribute('srcset');
              if (srcset) {
                // srcset format: "/_next/image?url=https%3A%2F%2F...&w=32&q=75 1x, /_next/image?url=...&w=64&q=75 2x"
                const srcsetMatch = srcset.match(/url=([^&\s]+)/);
                if (srcsetMatch) {
                  logoUrl = decodeURIComponent(srcsetMatch[1]);
                }
              }
              
              // Fallback to src
              if (!logoUrl) {
                const src = img.getAttribute('src');
                if (src) {
                  // Extract from Next.js image optimization URL
                  const srcMatch = src.match(/url=([^&\s]+)/);
                  if (srcMatch) {
                    logoUrl = decodeURIComponent(srcMatch[1]);
                  } else {
                    logoUrl = src; // Direct URL
                  }
                }
              }
              
              teamLogos.push(logoUrl);
            }
          });
          
          if (teamNames.length >= 2) {
            match.homeTeam = teamNames[0];
            match.awayTeam = teamNames[1];
            match.homeTeamLogo = teamLogos[0] || '';
            match.awayTeamLogo = teamLogos[1] || '';
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
              match.status = 'live';
            }
          });
          
          // Fallback status detection
          if (!match.status && match.rawText.toLowerCase().includes('live')) {
            match.status = 'live';
          }
          
          // ✅ Parse BLV (Bình Luận Viên) - Tên xuất hiện cạnh avatar "xay-con-avatar"
          const blvElements = container.querySelectorAll('.text-primary.font-bold');
          blvElements.forEach(el => {
            const text = el.textContent?.trim() || '';
            // BLV thường là text ngắn, viết hoa, không chứa số hay ký tự đặc biệt giải đấu
            if (text.length > 2 && text.length < 30 && 
                !text.match(/\d{1,2}:\d{2}/) && 
                !text.match(/\d{1,2}\/\d{1,2}/) &&
                text !== match.homeTeam && 
                text !== match.awayTeam && 
                text !== match.league &&
                text !== 'LIVE' &&
                !text.includes('Nhận Km') &&
                !text.includes('Đang diễn ra')) {
              // Check nếu element này ở gần avatar image
              const parent = el.closest('.bg-brand');
              if (parent) {
                const hasAvatar = parent.querySelector('img[alt="xay-con-avatar"]');
                if (hasAvatar) {
                  match.blv = text;
                }
              }
            }
          });
          
          // Fallback: Tìm BLV từ rawText (thường là dòng cuối)
          if (!match.blv && match.rawText) {
            const lines = match.rawText.split('\n').map(l => l.trim()).filter(l => l);
            const lastLine = lines[lines.length - 1];
            // BLV thường là dòng cuối, viết hoa, không chứa số
            if (lastLine && lastLine.length < 30 && 
                !lastLine.match(/\d/) && 
                lastLine !== 'Nhận Km' &&
                lastLine !== 'Đang diễn ra' &&
                lastLine !== match.homeTeam &&
                lastLine !== match.awayTeam) {
              match.blv = lastLine;
            }
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
          homeTeamLogo: '',
          awayTeamLogo: '',
          time: '',           // Thời gian đầy đủ (ngày + giờ)
          date: '',           // Chỉ ngày
          timeOnly: '',       // Chỉ giờ
          league: '',
          status: '',
          blv: '',            // ✅ Bình Luận Viên
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
                    homeTeamLogo: parsedMatch.homeTeamLogo || '',
                    awayTeamLogo: parsedMatch.awayTeamLogo || '',
                    time: parsedMatch.time,           // Thời gian đầy đủ
                    date: parsedMatch.date,           // Chỉ ngày
                    timeOnly: parsedMatch.timeOnly,   // Chỉ giờ
                    league: parsedMatch.league,
                    status: parsedMatch.status,
                    blv: parsedMatch.blv || '',       // ✅ Bình Luận Viên
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
                homeTeamLogo: parsedMatch.homeTeamLogo || '',
                awayTeamLogo: parsedMatch.awayTeamLogo || '',
                time: parsedMatch.time,
                date: parsedMatch.date,
                timeOnly: parsedMatch.timeOnly,
                league: parsedMatch.league,
                status: parsedMatch.status,
                blv: parsedMatch.blv || '',       // ✅ Bình Luận Viên
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
      
      // ✅ CHỈ LẤY LIVE MATCHES
      const liveMatches = uniqueMatches.filter(match => 
        match.status && match.status.toLowerCase().includes('live')
      );
      
      return liveMatches;
    });
    
    console.log(`Found ${matches.length} LIVE matches`);
    
    return {
      success: true,
      matches: matches,
      scrapedAt: new Date().toISOString(),
      totalMatches: matches.length,
      source: 'ThapcamTV'
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
    // ✅ CHỈ ĐÓNG PAGE, KHÔNG ĐÓNG BROWSER (để reuse)
    if (page) {
      await page.close();
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
  
  // ✅ FORCE GARBAGE COLLECTION để giải phóng RAM
  if (global.gc) {
    console.log('Running garbage collection...');
    global.gc();
  }
  
  // ✅ Log RAM usage để monitor
  const memUsage = process.memoryUsage();
  console.log(`Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
}

// ✅ Hàm check memory và restart nếu cần
function checkMemoryAndRestart() {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  
  console.log(`Memory check: ${heapUsedMB}MB / ${heapTotalMB}MB`);
  
  // ✅ Nếu dùng trên 400MB RAM, restart process
  if (heapUsedMB > 400) {
    console.log('⚠️ HIGH MEMORY USAGE! Restarting process...');
    process.exit(1); // Railway/Render sẽ tự động restart
  }
}

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'ThapcamTV Football Scraper API - LIVE Matches Only',
    version: '3.0.0',
    source: 'ThapcamTV via bit.ly/tiengruoi',
    features: [
      '🔴 LIVE matches only (filtered)',
      'Detailed match parsing (home/away teams, time, league, status, BLV, logos)',
      'Auto-refresh every 2 minutes (optimized for RAM)',
      'Browser pooling to prevent memory leaks',
      'Auto memory check every 5 minutes',
      'Browser restart every 4 hours',
      'Advanced filtering and search'
    ],
    endpoints: {
      '/api/matches': 'Get all LIVE match data',
      '/api/matches/live': 'Get live matches (same as /api/matches)',
      '/api/matches/by-league/{league}': 'Get LIVE matches by league name',
      '/api/search/{team}': 'Search LIVE matches by team name',
      '/api/status': 'Get API status and statistics',
      '/api/refresh': 'Force refresh data',
      '/api/debug': 'Debug information and parsing sources'
    },
    examples: {
      'All LIVE matches': '/api/matches',
      'Live matches': '/api/matches/live',
      'Premier League LIVE': '/api/matches/by-league/premier',
      'Search Barcelona': '/api/search/barcelona'
    },
    documentation: 'https://github.com/edamleanh/apibongda'
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
    // ✅ Ensure Chrome is installed before starting
    console.log('🔍 Checking Chrome installation...');
    const chromeInstalled = await ensureChromeInstalled();
    if (!chromeInstalled) {
      console.error('❌ Cannot start server: Chrome installation failed');
      process.exit(1);
    }
    
    // Cập nhật dữ liệu lần đầu
    await updateData();
    
    // ✅ THAY ĐỔI: Scrape mỗi 2 PHÚT thay vì 1 phút (giảm RAM pressure)
    setInterval(updateData, 120000); // 120 giây = 2 phút
    
    // ✅ Check memory mỗi 5 phút
    setInterval(checkMemoryAndRestart, 300000); // 5 phút
    
    // ✅ Đóng và tạo lại browser mỗi 4 giờ để tránh memory leak
    setInterval(async () => {
      console.log('♻️  Restarting browser to free memory...');
      if (globalBrowser) {
        await globalBrowser.close();
        globalBrowser = null;
      }
    }, 14400000); // 4 giờ = 14400000ms
    
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📊 API Status: http://localhost:${PORT}/api/status`);
      console.log(`⚽ Matches: http://localhost:${PORT}/api/matches`);
      console.log(`🔄 Auto-refresh every 2 minutes (optimized for RAM)`);
      console.log(`💾 Memory check every 5 minutes (auto-restart if > 400MB)`);
      console.log(`♻️  Browser restart every 4 hours (prevent memory leak)`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// ✅ Graceful shutdown - Đóng browser khi process terminate
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing browser...');
  if (globalBrowser) {
    await globalBrowser.close();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing browser...');
  if (globalBrowser) {
    await globalBrowser.close();
  }
  process.exit(0);
});

startServer();
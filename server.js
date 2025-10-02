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

// Helper function
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to ensure Chrome is installed
async function ensureChromeInstalled() {
  try {
    const chromePath = puppeteer.executablePath();
    if (fs.existsSync(chromePath)) {
      console.log('✅ Chrome already installed at:', chromePath);
      return true;
    }
  } catch (error) {
    console.log('⚠️ Chrome not found, installing...');
  }

  try {
    console.log('📦 Installing Chrome via Puppeteer...');
    execSync('npx puppeteer browsers install chrome', { 
      stdio: 'inherit',
      timeout: 120000
    });
    console.log('✅ Chrome installation complete!');
    return true;
  } catch (error) {
    console.error('❌ Failed to install Chrome:', error.message);
    return false;
  }
}

// Browser Pool - Global browser instance
let globalBrowser = null;

// ✅ Cache ThapcamTV link để tránh navigate qua bit.ly mỗi lần
let cachedThapcamLink = null;
let linkLastUpdated = null;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Cache
let cachedData = {
  matches: [],
  lastUpdated: null,
  status: 'initializing'
};

// Puppeteer config
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

// Get or create browser
async function getBrowser() {
  if (!globalBrowser || !globalBrowser.isConnected()) {
    console.log('Creating new browser instance...');
    globalBrowser = await puppeteer.launch(getBrowserConfig());
  }
  return globalBrowser;
}

// ✅ Hàm lấy link ThapcamTV từ bit.ly (gọi riêng, không gọi mỗi lần scrape)
async function getThapcamLink() {
  let page;
  try {
    console.log('🔗 Fetching ThapcamTV link from bit.ly/tiengruoi...');
    
    const browser = await getBrowser();
    page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Navigate to bit.ly
    await page.goto('https://bit.ly/tiengruoi', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    await wait(3000);
    
    // Find ThapcamTV link
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
    
    console.log('✅ Found ThapcamTV link:', thapcamLink);
    
    // Cache link và timestamp
    cachedThapcamLink = thapcamLink;
    linkLastUpdated = Date.now();
    
    return thapcamLink;
    
  } catch (error) {
    console.error('❌ Error fetching ThapcamTV link:', error);
    // Nếu lỗi, vẫn dùng link cũ nếu có
    return cachedThapcamLink;
  } finally {
    if (page) {
      await page.close();
    }
  }
}

// Main scraping function for ThapcamTV (chỉ scrape data, không lấy link nữa)
// Main scraping function for ThapcamTV (chỉ scrape data, không lấy link nữa)
async function scrapeMatches() {
  let page;
  try {
    console.log('Starting ThapcamTV scrape...');
    
    // ✅ Kiểm tra xem đã có link chưa
    if (!cachedThapcamLink) {
      console.log('⚠️ No cached link, fetching from bit.ly...');
      await getThapcamLink();
    }
    
    if (!cachedThapcamLink) {
      throw new Error('Could not get ThapcamTV link');
    }
    
    const browser = await getBrowser();
    page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // ✅ Bỏ qua Step 1 & 2 (đã có link rồi), đi thẳng vào football page
    const footballUrl = cachedThapcamLink.endsWith('/') 
      ? cachedThapcamLink + 'football' 
      : cachedThapcamLink + '/football';
    
    console.log('🏈 Navigating directly to football page:', footballUrl);
    
    // Navigate to football page
    await page.goto(footballUrl, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    console.log('⏳ Waiting for football page to load...');
    await wait(5000);
    
    console.log('⏳ Waiting for football page to load...');
    await wait(5000);
    
    // Wait for match elements
    try {
      await page.waitForSelector('ul.tourz', { timeout: 10000 });
      console.log('✅ Match list detected, waiting 2 more seconds...');
      await wait(2000);
    } catch (e) {
      console.log('⚠️ No match list found, page might be empty');
    }
    
    console.log('📊 Extracting LIVE match data from ThapcamTV...');
    
    // ===== STEP 5: Scrape LIVE matches =====
    const matches = await page.evaluate(() => {
      const matchElements = [];
      
      // Helper function to parse ThapcamTV match HTML
      function parseThapcamMatch(matchLi) {
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
          link: '',
          rawText: matchLi.innerText || matchLi.textContent || ''
        };
        
        try {
          // 1. Extract link from <a href="/truc-tiep/...">
          const linkTag = matchLi.querySelector('a.match');
          if (linkTag && linkTag.href) {
            match.link = linkTag.href;
          }
          
          // 2. Extract time and date from .match__time
          const timeDiv = matchLi.querySelector('.match__time');
          if (timeDiv) {
            // Time: "14:45"
            const timeSpan = timeDiv.querySelector('.grid-match__date');
            if (timeSpan) {
              const timeText = timeSpan.childNodes[0]?.textContent?.trim();
              if (timeText) {
                match.timeOnly = timeText;
              }
              
              // Date: "02/10" (in span.date)
              const dateSpan = timeSpan.querySelector('span.date');
              if (dateSpan) {
                match.date = dateSpan.textContent.trim();
              }
            }
            
            // Status: "• Live" from .badge-live
            const liveBadge = timeDiv.querySelector('.badge-live');
            if (liveBadge) {
              match.status = liveBadge.textContent.trim();
            }
          }
          
          // 3. Combine time and date
          if (match.timeOnly && match.date) {
            match.time = `${match.date} ${match.timeOnly}`;
          } else if (match.timeOnly) {
            match.time = match.timeOnly;
          }
          
          // 4. Extract team names and logos
          const homeTeamDiv = matchLi.querySelector('.match__team--home');
          const awayTeamDiv = matchLi.querySelector('.match__team--away');
          
          if (homeTeamDiv) {
            const homeImg = homeTeamDiv.querySelector('.match__team--logo');
            const homeName = homeTeamDiv.querySelector('.match__team--name');
            
            if (homeImg) {
              match.homeTeam = homeImg.getAttribute('alt') || '';
              match.homeTeamLogo = homeImg.getAttribute('data-src') || homeImg.getAttribute('src') || '';
            }
            if (homeName) {
              match.homeTeam = homeName.textContent.trim();
            }
          }
          
          if (awayTeamDiv) {
            const awayImg = awayTeamDiv.querySelector('.match__team--logo');
            const awayName = awayTeamDiv.querySelector('.match__team--name');
            
            if (awayImg) {
              match.awayTeam = awayImg.getAttribute('alt') || '';
              match.awayTeamLogo = awayImg.getAttribute('data-src') || awayImg.getAttribute('src') || '';
            }
            if (awayName) {
              match.awayTeam = awayName.textContent.trim();
            }
          }
          
          // 5. Extract BLV (commentator) from .match__commentator
          const commentatorDiv = matchLi.querySelector('.match__commentator');
          if (commentatorDiv) {
            // Get text before the <img> tag
            const textNode = commentatorDiv.childNodes[0];
            if (textNode && textNode.nodeType === Node.TEXT_NODE) {
              match.blv = textNode.textContent.trim();
            }
          }
          
        } catch (e) {
          console.log('Error parsing ThapcamTV match:', e);
        }
        
        return match;
      }
      
      // Main scraping logic
      const tournamentUls = document.querySelectorAll('ul.tourz');
      
      tournamentUls.forEach(ul => {
        // Get league name from <li class="league_title">
        let leagueName = '';
        const leagueLi = ul.querySelector('li.league_title');
        if (leagueLi) {
          // Extract text (skip the img tag)
          const leagueTextNodes = Array.from(leagueLi.childNodes)
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .map(node => node.textContent.trim())
            .filter(text => text.length > 0);
          
          leagueName = leagueTextNodes.join(' ').trim();
        }
        
        // Get all match items
        const matchLis = ul.querySelectorAll('li.matches__item');
        
        matchLis.forEach(matchLi => {
          const match = parseThapcamMatch(matchLi);
          match.league = leagueName;
          
          // Only add matches with both teams
          if (match.homeTeam && match.awayTeam) {
            matchElements.push(match);
          }
        });
      });
      
      return matchElements;
    });

    console.log(`Found ${matches.length} total matches from ThapcamTV`);
    
    // Add timestamp and source
    const timestamp = new Date().toISOString();
    const matchesWithMeta = matches.map(m => ({
      ...m,
      timestamp,
      source: 'ThapcamTV'
    }));
    
    // Remove duplicates
    const uniqueMatches = [];
    const seen = new Set();
    
    for (const match of matchesWithMeta) {
      const key = `${match.homeTeam}-${match.awayTeam}-${match.time}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueMatches.push(match);
      }
    }
    
    // ✅ ONLY LIVE MATCHES
    const liveMatches = uniqueMatches.filter(match => {
      const status = (match.status || '').toLowerCase();
      return status.includes('live');
    });
    
    console.log(`Filtered to ${liveMatches.length} LIVE matches`);
    
    return { 
      success: true,
      matches: liveMatches, 
      scrapedAt: timestamp,
      totalMatches: liveMatches.length,
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
    if (page) {
      await page.close();
    }
  }
}

// Update data function
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
  
  // Force garbage collection
  if (global.gc) {
    console.log('Running garbage collection...');
    global.gc();
  }
  
  // Log memory usage
  const memUsage = process.memoryUsage();
  console.log(`Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
}

// Check memory and restart if needed
function checkMemoryAndRestart() {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  
  console.log(`Memory check: ${heapUsedMB}MB / ${heapTotalMB}MB`);
  
  if (heapUsedMB > 400) {
    console.log('⚠️ HIGH MEMORY USAGE! Restarting process...');
    process.exit(1);
  }
}

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'ThapcamTV Football Scraper API - LIVE Matches Only',
    version: '3.0.0',
    status: cachedData.status,
    lastUpdated: cachedData.lastUpdated,
    totalMatches: cachedData.totalMatches || 0,
    endpoints: {
      matches: '/api/matches - Get all LIVE matches',
      live: '/api/matches/live - Get all LIVE matches (same as above)',
      health: '/health - Health check'
    },
    source: 'ThapcamTV'
  });
});

app.get('/api/matches', (req, res) => {
  res.json({
    success: true,
    data: cachedData.matches,
    lastUpdated: cachedData.lastUpdated,
    totalMatches: cachedData.totalMatches || cachedData.matches.length,
    source: 'ThapcamTV'
  });
});

app.get('/api/matches/live', (req, res) => {
  res.json({
    success: true,
    data: cachedData.matches,
    lastUpdated: cachedData.lastUpdated,
    totalMatches: cachedData.totalMatches || cachedData.matches.length,
    source: 'ThapcamTV'
  });
});

app.get('/health', (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    memory: {
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
    },
    cachedMatches: cachedData.matches.length,
    lastUpdated: cachedData.lastUpdated
  });
});

// Start server
async function startServer() {
  try {
    console.log('🚀 Starting server...');
    
    await ensureChromeInstalled();
    
    console.log('� Fetching initial ThapcamTV link...');
    await getThapcamLink();
    
    console.log('�📊 Initial data fetch...');
    await updateData();
    
    // ✅ TÁCH RIÊNG 2 INTERVAL ĐỂ TỐI ƯU
    
    // 1. Cập nhật dữ liệu matches: Mỗi 2 phút (chỉ scrape, không lấy link)
    setInterval(updateData, 2 * 60 * 1000);
    console.log('⏱️ Match data will update every 2 minutes');
    
    // 2. Refresh link ThapcamTV: Mỗi 30 phút (chỉ lấy link mới từ bit.ly)
    setInterval(getThapcamLink, 30 * 60 * 1000);
    console.log('🔗 ThapcamTV link will refresh every 30 minutes');
    
    // 3. Memory check: Mỗi 5 phút
    setInterval(checkMemoryAndRestart, 5 * 60 * 1000);
    console.log('💾 Memory check every 5 minutes');
    
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📍 http://localhost:${PORT}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

@echo off
echo ========================================
echo    XAYCON SCRAPER API - DEPLOY SETUP
echo ========================================
echo.

echo [1/5] Checking Git status...
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Git not found! Please install Git first.
    pause
    exit /b 1
)
echo ✅ Git is installed

echo.
echo [2/5] Initializing Git repository...
git init
if %errorlevel% neq 0 (
    echo ❌ Failed to initialize Git
    pause
    exit /b 1
)

echo.
echo [3/5] Adding all files...
git add .
if %errorlevel% neq 0 (
    echo ❌ Failed to add files
    pause
    exit /b 1
)

echo.
echo [4/5] Creating initial commit...
git commit -m "Initial commit - Xaycon Scraper API for Render deployment"
if %errorlevel% neq 0 (
    echo ❌ Failed to create commit
    pause
    exit /b 1
)

echo.
echo [5/5] Setting main branch...
git branch -M main
if %errorlevel% neq 0 (
    echo ❌ Failed to set main branch
    pause
    exit /b 1
)

echo.
echo ✅ Git setup completed successfully!
echo.
echo ========================================
echo           NEXT STEPS
echo ========================================
echo.
echo 1. Create GitHub repository:
echo    - Go to https://github.com/new
echo    - Name: xaycon-scraper-api
echo    - Make it PUBLIC (for free tier)
echo    - DON'T add README (already exists)
echo.
echo 2. Connect to GitHub (replace YOUR_USERNAME):
echo    git remote add origin https://github.com/YOUR_USERNAME/xaycon-scraper-api.git
echo    git push -u origin main
echo.
echo 3. Deploy on Render:
echo    - Go to https://render.com
echo    - Sign up with GitHub
echo    - Create Web Service
echo    - Connect your repository
echo.
echo 4. Use these settings:
echo    Runtime: Node
echo    Build Command: npm install
echo    Start Command: npm start
echo    Environment: NODE_ENV=production
echo.
echo ========================================
echo See DEPLOY-GUIDE.md for detailed steps!
echo ========================================
pause
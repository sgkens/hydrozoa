# Check for Node.js and npm
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js is not installed. Please install Node.js v20 or later." -ForegroundColor Red
    exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "npm is not installed. Please install npm." -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "Installing Hydrozoa dependencies..." -ForegroundColor Cyan
npm install

# Build the application
Write-Host "Building Hydrozoa frontend..." -ForegroundColor Cyan
npm run build

# Instructions to start
Write-Host "Hydrozoa is ready to be started." -ForegroundColor Green
Write-Host "To start the application, run: npm start" -ForegroundColor Green
Write-Host "The application will be available at http://localhost:3000" -ForegroundColor Green

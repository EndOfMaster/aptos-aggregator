# PowerShell deployment script for Cetus Aptos Aggregator

param(
    [string]$Network = "testnet",
    [string]$Profile = "default", 
    [int]$FeeRate = 30,
    [string]$FeeCollector = "",
    [switch]$Help
)

if ($Help) {
    Write-Host "Usage: .\deploy.ps1 [OPTIONS]"
    Write-Host "Options:"
    Write-Host "  -Network NETWORK        Network to deploy to (default: testnet)"
    Write-Host "  -Profile PROFILE        Aptos CLI profile to use (default: default)"
    Write-Host "  -FeeRate RATE          Fee rate in basis points (default: 30)"
    Write-Host "  -FeeCollector ADDR     Fee collector address"
    Write-Host "  -Help                  Show this help message"
    exit 0
}

Write-Host "🚀 Deploying Cetus Aptos Aggregator..." -ForegroundColor Green

# Check if Aptos CLI is installed
if (!(Get-Command "aptos" -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Aptos CLI is not installed. Please install it first." -ForegroundColor Red
    Write-Host "Visit: https://aptos.dev/cli-tools/aptos-cli-tool/install-aptos-cli"
    exit 1
}

# Get deployer address
try {
    $configOutput = aptos config show-profiles --profile $Profile
    $deployerAddress = ($configOutput | Select-String "account").ToString().Split()[1]
} catch {
    Write-Host "❌ Could not get deployer address from profile: $Profile" -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrEmpty($FeeCollector)) {
    $FeeCollector = $deployerAddress
}

Write-Host "📋 Deployment Configuration:" -ForegroundColor Cyan
Write-Host "  Network: $Network"
Write-Host "  Profile: $Profile"
Write-Host "  Deployer: $deployerAddress"
Write-Host "  Fee Rate: $FeeRate basis points"
Write-Host "  Fee Collector: $FeeCollector"
Write-Host ""

# Compile the Move modules
Write-Host "🔨 Compiling Move modules..." -ForegroundColor Yellow
$compileResult = aptos move compile --named-addresses aggregator=$deployerAddress

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Compilation failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Compilation successful!" -ForegroundColor Green
Write-Host ""

# Deploy the modules
Write-Host "📦 Publishing modules to $Network..." -ForegroundColor Yellow
$publishResult = aptos move publish --profile $Profile --named-addresses aggregator=$deployerAddress --assume-yes

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Publishing failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Modules published successfully!" -ForegroundColor Green
Write-Host ""

# Initialize the aggregator
Write-Host "⚙️  Initializing aggregator..." -ForegroundColor Yellow
$initResult = aptos move run --profile $Profile --function-id "${deployerAddress}::router::initialize" --args "u64:$FeeRate" "address:$FeeCollector" --assume-yes

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Initialization failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Aggregator initialized successfully!" -ForegroundColor Green
Write-Host ""

Write-Host "🎉 Deployment completed!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Summary:" -ForegroundColor Cyan
Write-Host "  Aggregator Address: $deployerAddress"
Write-Host "  Network: $Network"
$feePercentage = [math]::Round($FeeRate / 100, 2)
Write-Host "  Fee Rate: $FeeRate basis points ($feePercentage%)"
Write-Host "  Fee Collector: $FeeCollector"
Write-Host ""
Write-Host "🔗 You can now interact with the aggregator using:" -ForegroundColor Cyan
Write-Host "  Module: ${deployerAddress}::router"
Write-Host "  Functions: swap_exact_input, swap_exact_input_multihop"
Write-Host ""
Write-Host "📖 For more information, check the README.md file." -ForegroundColor Cyan

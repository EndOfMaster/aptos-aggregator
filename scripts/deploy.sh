#!/bin/bash

# Deployment script for Cetus Aptos Aggregator

echo "🚀 Deploying Cetus Aptos Aggregator..."

# Check if Aptos CLI is installed
if ! command -v aptos &> /dev/null; then
    echo "❌ Aptos CLI is not installed. Please install it first."
    echo "Visit: https://aptos.dev/cli-tools/aptos-cli-tool/install-aptos-cli"
    exit 1
fi

# Default values
NETWORK="devnet"
PROFILE="default"
FEE_RATE=30  # 0.3% in basis points
FEE_COLLECTOR=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --network)
            NETWORK="$2"
            shift 2
            ;;
        --profile)
            PROFILE="$2"
            shift 2
            ;;
        --fee-rate)
            FEE_RATE="$2"
            shift 2
            ;;
        --fee-collector)
            FEE_COLLECTOR="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --network NETWORK       Network to deploy to (default: testnet)"
            echo "  --profile PROFILE       Aptos CLI profile to use (default: default)"
            echo "  --fee-rate RATE         Fee rate in basis points (default: 30)"
            echo "  --fee-collector ADDR    Fee collector address"
            echo "  -h, --help              Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option $1"
            exit 1
            ;;
    esac
done

# Get deployer address
DEPLOYER_ADDRESS=$(aptos config show-profiles --profile $PROFILE | grep "account" | awk '{print $2}')

if [ -z "$DEPLOYER_ADDRESS" ]; then
    echo "❌ Could not get deployer address from profile: $PROFILE"
    exit 1
fi

echo "📋 Deployment Configuration:"
echo "  Network: $NETWORK"
echo "  Profile: $PROFILE"
echo "  Deployer: $DEPLOYER_ADDRESS"
echo "  Fee Rate: $FEE_RATE basis points"

if [ -z "$FEE_COLLECTOR" ]; then
    FEE_COLLECTOR=$DEPLOYER_ADDRESS
    echo "  Fee Collector: $FEE_COLLECTOR (using deployer address)"
else
    echo "  Fee Collector: $FEE_COLLECTOR"
fi

echo ""

# Compile the Move modules
echo "🔨 Compiling Move modules..."
aptos move compile --named-addresses aggregator=$DEPLOYER_ADDRESS

if [ $? -ne 0 ]; then
    echo "❌ Compilation failed!"
    exit 1
fi

echo "✅ Compilation successful!"
echo ""

# Deploy the modules
echo "📦 Publishing modules to $NETWORK..."
aptos move publish \
    --profile $PROFILE \
    --named-addresses aggregator=$DEPLOYER_ADDRESS \
    --assume-yes

if [ $? -ne 0 ]; then
    echo "❌ Publishing failed!"
    exit 1
fi

echo "✅ Modules published successfully!"
echo ""

# Initialize the aggregator
echo "⚙️  Initializing aggregator..."
aptos move run \
    --profile $PROFILE \
    --function-id ${DEPLOYER_ADDRESS}::router::initialize \
    --args u64:$FEE_RATE address:$FEE_COLLECTOR \
    --assume-yes

if [ $? -ne 0 ]; then
    echo "❌ Initialization failed!"
    exit 1
fi

echo "✅ Aggregator initialized successfully!"
echo ""

echo "🎉 Deployment completed!"
echo ""
echo "📝 Summary:"
echo "  Aggregator Address: $DEPLOYER_ADDRESS"
echo "  Network: $NETWORK"
echo "  Fee Rate: $FEE_RATE basis points ($(echo "scale=2; $FEE_RATE/100" | bc)%)"
echo "  Fee Collector: $FEE_COLLECTOR"
echo ""
echo "🔗 You can now interact with the aggregator using:"
echo "  Module: ${DEPLOYER_ADDRESS}::router"
echo "  Functions: swap_exact_input, swap_exact_input_multihop"
echo ""
echo "📖 For more information, check the README.md file."

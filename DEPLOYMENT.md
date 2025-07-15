# Deployment Guide

Complete deployment guide for the Cetus Aptos Aggregator project.

## Prerequisites

- [Aptos CLI](https://aptos.dev/cli-tools/aptos-cli-tool/install-aptos-cli) installed
- Node.js 18+ for backend and SDK
- Sufficient APT tokens for deployment and testing
- Access to an Aptos node (testnet/mainnet)

## 1. Smart Contract Deployment

### Step 1: Prepare Account

```bash
# Initialize Aptos CLI profile
aptos init --profile mainnet
# or
aptos init --profile testnet

# Check account balance
aptos account list --profile testnet
```

### Step 2: Compile Contracts

```bash
cd aptos-aggregator

# Get your account address
ACCOUNT=$(aptos config show-profiles --profile testnet | grep "account" | awk '{print $2}')

# Compile with your address
aptos move compile --named-addresses aggregator=$ACCOUNT
```

### Step 3: Deploy Contracts

```bash
# Deploy using PowerShell script (Windows)
.\scripts\deploy.ps1 -Network testnet -FeeRate 30 -Profile testnet

# Or deploy using bash script (Linux/Mac)
./scripts/deploy.sh --network testnet --fee-rate 30 --profile testnet

# Or deploy manually
aptos move publish --profile testnet --named-addresses aggregator=$ACCOUNT --assume-yes
```

### Step 4: Initialize Aggregator

After deployment, initialize the aggregator:

```bash
# Initialize with 0.3% fee and your address as fee collector
aptos move run \
  --profile testnet \
  --function-id ${ACCOUNT}::router::initialize \
  --args u64:30 address:${ACCOUNT} \
  --assume-yes
```

### Step 5: Verify Deployment

```bash
# Check aggregator configuration
aptos move view \
  --function-id ${ACCOUNT}::router::get_config \
  --profile testnet
```

## 2. Backend Service Deployment

### Step 1: Setup Environment

```bash
cd backend

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env
```

### Step 2: Configure Environment

Edit `.env` file:

```bash
# Server configuration
PORT=3000
NODE_ENV=production

# Aptos configuration
APTOS_NETWORK=testnet
APTOS_NODE_URL=https://fullnode.testnet.aptoslabs.com/v1
AGGREGATOR_ADDRESS=0x1  # Replace with your deployed address

# Pool refresh configuration
POOL_REFRESH_INTERVAL_SECONDS=30

# Rate limiting
RATE_LIMIT_MAX_REQUESTS=1000
RATE_LIMIT_WINDOW_MS=900000
```

### Step 3: Build and Start

```bash
# Build for production
npm run build

# Start production server
npm start

# Or start with PM2 for production
npm install -g pm2
pm2 start dist/index.js --name "aptos-aggregator-api"
```

### Step 4: Verify Backend

```bash
# Health check
curl http://localhost:3000/v1/health

# Test quote endpoint
curl -X POST http://localhost:3000/v1/router/quote \
  -H "Content-Type: application/json" \
  -d '{
    "coin_in": "0x1::aptos_coin::AptosCoin",
    "coin_out": "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC",
    "amount_in": "1000000000"
  }'
```

## 3. SDK Setup

### Step 1: Build SDK

```bash
cd sdk

# Install dependencies
npm install

# Build the SDK
npm run build

# Optionally, publish to npm
npm publish
```

### Step 2: Test SDK Integration

Create a test file `test-sdk.js`:

```javascript
const { AptosAggregatorClient, AptosNetwork } = require('./dist/index.js')

async function testSDK() {
  const client = new AptosAggregatorClient(
    AptosNetwork.TESTNET,
    '0x1', // Your deployed aggregator address
    'http://localhost:3000/v1'
  )

  try {
    // Test quote
    const quote = await client.getQuote({
      coinIn: '0x1::aptos_coin::AptosCoin',
      coinOut: '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC',
      amountIn: '1000000000',
    })
    
    console.log('Quote result:', quote)
  } catch (error) {
    console.error('SDK test failed:', error)
  }
}

testSDK()
```

## 4. Production Deployment

### Using Docker

#### Step 1: Create Dockerfile for Backend

```dockerfile
# backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/v1/health || exit 1

# Start application
CMD ["npm", "start"]
```

#### Step 2: Build and Run Docker Container

```bash
# Build image
docker build -t aptos-aggregator-backend ./backend

# Run container
docker run -d \
  --name aptos-aggregator-api \
  -p 3000:3000 \
  --env-file backend/.env \
  aptos-aggregator-backend
```

### Using Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  api:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - APTOS_NETWORK=testnet
      - AGGREGATOR_ADDRESS=${AGGREGATOR_ADDRESS}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    restart: unless-stopped
```

Deploy with:
```bash
docker-compose up -d
```

### Using Kubernetes

#### Step 1: Create Kubernetes Manifests

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aptos-aggregator-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: aptos-aggregator-api
  template:
    metadata:
      labels:
        app: aptos-aggregator-api
    spec:
      containers:
      - name: api
        image: aptos-aggregator-backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: PORT
          value: "3000"
        - name: AGGREGATOR_ADDRESS
          valueFrom:
            configMapKeyRef:
              name: aptos-config
              key: aggregator-address
        livenessProbe:
          httpGet:
            path: /v1/health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /v1/health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"

---
apiVersion: v1
kind: Service
metadata:
  name: aptos-aggregator-api-service
spec:
  selector:
    app: aptos-aggregator-api
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

#### Step 2: Deploy to Kubernetes

```bash
# Create namespace
kubectl create namespace aptos-aggregator

# Create ConfigMap
kubectl create configmap aptos-config \
  --from-literal=aggregator-address=0x1 \
  -n aptos-aggregator

# Deploy application
kubectl apply -f k8s/ -n aptos-aggregator

# Check deployment status
kubectl get pods -n aptos-aggregator
kubectl logs -f deployment/aptos-aggregator-api -n aptos-aggregator
```

## 5. Monitoring and Observability

### Health Monitoring

```bash
# Check contract deployment
aptos move view --function-id ${ACCOUNT}::router::get_config

# Check API health
curl http://your-domain.com/v1/health

# Check pool data freshness
curl http://your-domain.com/v1/pools/stats
```

### Logging

Set up centralized logging for production:

```yaml
# docker-compose.yml (add logging driver)
services:
  api:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Metrics (Optional)

Add Prometheus metrics:

```bash
# Add to backend package.json
npm install prom-client express-prometheus-middleware
```

## 6. Post-Deployment Tasks

### Step 1: Test End-to-End Functionality

```bash
# Test quote generation
curl -X POST http://your-domain.com/v1/router/quote \
  -H "Content-Type: application/json" \
  -d '{
    "coin_in": "0x1::aptos_coin::AptosCoin",
    "coin_out": "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC",
    "amount_in": "1000000000"
  }'

# Test actual swap (with small amount)
# Use SDK or direct contract calls
```

### Step 2: Set up Monitoring Alerts

- API uptime monitoring
- Pool data freshness alerts
- Error rate thresholds
- Performance degradation alerts

### Step 3: Security Checklist

- [ ] Contract ownership properly set
- [ ] Admin functions restricted
- [ ] API rate limiting configured
- [ ] HTTPS enabled for production
- [ ] Environment variables secured
- [ ] Database/Redis access restricted

### Step 4: Documentation

- Update API documentation with actual endpoints
- Create user guides for SDK integration
- Document operational procedures

## 7. Maintenance

### Regular Tasks

- Monitor pool data quality
- Update supported DEX list
- Optimize routing algorithms
- Security updates and patches

### Upgrades

When deploying contract updates:

1. Deploy new contract to new address
2. Update backend configuration
3. Migrate admin controls if needed
4. Update SDK references
5. Communicate changes to users

## Troubleshooting

### Common Issues

1. **Contract deployment fails**
   - Check account balance
   - Verify address format
   - Check Move.toml dependencies

2. **Backend fails to start**
   - Verify environment variables
   - Check Aptos node connectivity
   - Review logs for errors

3. **Pool data not updating**
   - Check DEX API connectivity
   - Verify pool contract addresses
   - Review refresh scheduler logs

4. **SDK integration issues**
   - Verify contract address
   - Check network configuration
   - Validate coin type formats

For additional support, refer to the project documentation or create an issue in the GitHub repository.

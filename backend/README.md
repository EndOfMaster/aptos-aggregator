# Aptos Aggregator Backend

Backend service for the Cetus Aptos DEX Aggregator, providing routing APIs and pool data management.

## Features

- **🔄 Route Finding**: Optimal routing across multiple DEXes
- **📊 Pool Management**: Real-time pool data aggregation and caching
- **🚀 High Performance**: Fast quote generation and route optimization
- **📈 Analytics**: Trading volume and liquidity metrics
- **🔍 Multi-hop Support**: Up to 3-hop routes for better prices
- **⚡ Real-time Updates**: Automatic pool data refresh every 30 seconds

## Supported DEXes

- ✅ Cetus AMM
- 🚧 PancakeSwap (Aptos)
- 🚧 LiquidSwap
- 🚧 Thala Labs

## API Endpoints

### Router APIs

#### `POST /v1/router/quote`
Get the best route and quote for a swap.

**Request:**
```json
{
  "coin_in": "0x1::aptos_coin::AptosCoin",
  "coin_out": "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC",
  "amount_in": "1000000000",
  "slippage_tolerance": 50,
  "exclude_dexes": [],
  "max_hops": 3
}
```

**Response:**
```json
{
  "route": {
    "steps": [
      {
        "dex_type": "CETUS",
        "coin_in": "0x1::aptos_coin::AptosCoin",
        "coin_out": "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC",
        "pool_address": "0x...",
        "amount_in": "1000000000",
        "amount_out": "9950000",
        "fee_rate": 30,
        "price_impact": 15
      }
    ],
    "amount_in": "1000000000",
    "amount_out": "9950000",
    "price_impact": 15,
    "fee": "3000000",
    "estimated_gas": 5000
  },
  "routes": []
}
```

#### `GET /v1/router/info`
Get router information and statistics.

#### `GET /v1/router/tokens`
Get all supported tokens.

#### `GET /v1/router/dexes`
Get supported DEXes information.

### Pool APIs

#### `GET /v1/pools`
Get all available pools with optional filtering.

**Query Parameters:**
- `dex_type`: Filter by DEX type (CETUS, PANCAKE, LIQUIDSWAP)
- `coin_a`: Filter by first coin type
- `coin_b`: Filter by second coin type

#### `GET /v1/pools/:poolAddress`
Get specific pool information.

#### `GET /v1/pools/stats`
Get pool statistics and metrics.

#### `POST /v1/pools/refresh`
Manually trigger pool data refresh (admin only).

### Health APIs

#### `GET /v1/health`
Comprehensive health check.

#### `GET /v1/health/ready`
Readiness check for Kubernetes.

#### `GET /v1/health/live`
Liveness check for Kubernetes.

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Aptos CLI (for testing)

### Installation

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit configuration
vim .env
```

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Environment Variables

Key environment variables to configure:

```bash
# Server
PORT=3000
NODE_ENV=development

# Aptos
APTOS_NETWORK=testnet
APTOS_NODE_URL=https://fullnode.testnet.aptoslabs.com/v1
AGGREGATOR_ADDRESS=0x1  # Your deployed aggregator address

# Pool refresh
POOL_REFRESH_INTERVAL_SECONDS=30
```

## Architecture

### Services

1. **PoolService**: Manages pool data aggregation and caching
   - Fetches pool data from multiple DEXes
   - Maintains in-memory cache for fast access
   - Scheduled refresh every 30 seconds

2. **RouterService**: Handles route finding and optimization
   - Implements Dijkstra-like algorithm for pathfinding
   - Supports single-hop and multi-hop routes
   - Price impact and slippage calculations

### Data Flow

```
External DEXes → PoolService → In-Memory Cache → RouterService → API Response
     ↓              ↓              ↓               ↓
   Pool Data    Aggregation    Fast Access    Route Finding
```

## Development Guide

### Adding New DEX Support

1. **Implement Pool Fetching**:
   ```typescript
   // In PoolService
   async fetchNewDexPools(): Promise<Pool[]> {
     // Implement DEX-specific pool fetching logic
   }
   ```

2. **Add DEX Configuration**:
   ```typescript
   // Add to constants
   export enum DexType {
     NEW_DEX = 'NEW_DEX'
   }
   ```

3. **Update Route Building**:
   ```typescript
   // RouterService handles new DEX automatically
   // if pools are properly formatted
   ```

### Testing

```bash
# Run tests
npm test

# Test specific endpoint
curl -X POST http://localhost:3000/v1/router/quote \
  -H "Content-Type: application/json" \
  -d '{
    "coin_in": "0x1::aptos_coin::AptosCoin",
    "coin_out": "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC",
    "amount_in": "1000000000"
  }'
```

## Deployment

### Docker

```bash
# Build image
docker build -t aptos-aggregator-backend .

# Run container
docker run -p 3000:3000 --env-file .env aptos-aggregator-backend
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aptos-aggregator-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: aptos-aggregator-backend
  template:
    metadata:
      labels:
        app: aptos-aggregator-backend
    spec:
      containers:
      - name: backend
        image: aptos-aggregator-backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: PORT
          value: "3000"
        livenessProbe:
          httpGet:
            path: /v1/health/live
            port: 3000
        readinessProbe:
          httpGet:
            path: /v1/health/ready
            port: 3000
```

## Performance Optimization

### Caching Strategy

- **In-Memory Cache**: Pool data cached in memory for sub-millisecond access
- **Scheduled Updates**: Background refresh every 30 seconds
- **Lazy Loading**: Routes calculated on-demand for optimal performance

### Rate Limiting

- **1000 requests per 15 minutes** per IP by default
- **Burst handling**: Short bursts allowed with token bucket algorithm
- **Admin bypass**: Special endpoints for admin operations

### Monitoring

- **Health Checks**: Comprehensive health monitoring
- **Metrics**: Pool count, response times, error rates
- **Logging**: Structured JSON logging with Winston

## Security

- **Input Validation**: Joi schema validation for all inputs
- **Rate Limiting**: Protection against DDoS attacks
- **Error Handling**: Sanitized error responses
- **CORS**: Configurable cross-origin resource sharing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- Documentation: [docs.cetus.zone](https://docs.cetus.zone)
- Discord: [Cetus Community](https://discord.gg/cetus)
- Issues: [GitHub Issues](https://github.com/CetusProtocol/aptos-aggregator/issues)

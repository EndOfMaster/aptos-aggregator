import { Aptos, AptosConfig } from '@aptos-labs/ts-sdk'
import Decimal from 'decimal.js'
import cron from 'node-cron'
import { logger } from '../utils/logger'

export interface Pool {
  poolAddress: string
  coinA: {
    type: string
    name: string
    symbol: string
    decimals: number
    logoUrl?: string
  }
  coinB: {
    type: string
    name: string
    symbol: string
    decimals: number
    logoUrl?: string
  }
  dexType: string
  reserveA: string
  reserveB: string
  feeRate: number
  tvl?: string
  volume24h?: string
  lastUpdated: number
}

export interface PoolPair {
  coinA: string
  coinB: string
}

export class PoolService {
  private static instance: PoolService
  private aptos: Aptos
  private pools: Map<string, Pool> = new Map()
  private poolsByPair: Map<string, Pool[]> = new Map()
  private lastUpdateTime: number = 0

  private constructor() {
    const config = new AptosConfig({
      network: (process.env.APTOS_NETWORK as any) || 'testnet',
      fullnode: process.env.APTOS_NODE_URL || 'https://fullnode.testnet.aptoslabs.com/v1',
    })
    this.aptos = new Aptos(config)
  }

  public static getInstance(): PoolService {
    if (!PoolService.instance) {
      PoolService.instance = new PoolService()
    }
    return PoolService.instance
  }

  async initialize(): Promise<void> {
    logger.info('Initializing PoolService...')
    await this.refreshAllPools()
    logger.info(`Loaded ${this.pools.size} pools`)
  }

  async refreshAllPools(): Promise<void> {
    try {
      logger.info('Refreshing pool data...')
      const startTime = Date.now()

      // Fetch pools from different DEXes
      const cetusPools = await this.fetchCetusPools()
      const pancakePools = await this.fetchPancakePools()
      const liquidSwapPools = await this.fetchLiquidSwapPools()

      // Combine all pools
      const allPools = [...cetusPools, ...pancakePools, ...liquidSwapPools]

      // Update internal storage
      this.pools.clear()
      this.poolsByPair.clear()

      for (const pool of allPools) {
        this.pools.set(pool.poolAddress, pool)
        
        // Index by pair
        const pairKey = this.getPairKey(pool.coinA.type, pool.coinB.type)
        if (!this.poolsByPair.has(pairKey)) {
          this.poolsByPair.set(pairKey, [])
        }
        this.poolsByPair.get(pairKey)!.push(pool)
      }

      this.lastUpdateTime = Date.now()
      const duration = Date.now() - startTime

      logger.info(`Pool refresh completed in ${duration}ms. Total pools: ${allPools.length}`)
    } catch (error) {
      logger.error('Failed to refresh pools:', error)
      throw error
    }
  }

  async fetchCetusPools(): Promise<Pool[]> {
    try {
      // TODO: Implement actual Cetus pool fetching
      // This would involve calling Cetus AMM view functions to get pool data
      logger.info('Fetching Cetus pools...')
      
      // Mock data for now
      const mockPools: Pool[] = [
        {
          poolAddress: '0x1::mock::pool_apt_usdc',
          coinA: {
            type: '0x1::aptos_coin::AptosCoin',
            name: 'Aptos Coin',
            symbol: 'APT',
            decimals: 8,
          },
          coinB: {
            type: '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC',
            name: 'USD Coin',
            symbol: 'USDC',
            decimals: 6,
          },
          dexType: 'CETUS',
          reserveA: '1000000000000', // 10,000 APT
          reserveB: '100000000000', // 100,000 USDC
          feeRate: 30, // 0.3%
          tvl: '200000000000', // $200,000
          volume24h: '50000000000', // $50,000
          lastUpdated: Date.now(),
        }
      ]

      return mockPools
    } catch (error) {
      logger.error('Failed to fetch Cetus pools:', error)
      return []
    }
  }

  async fetchPancakePools(): Promise<Pool[]> {
    try {
      // TODO: Implement actual PancakeSwap pool fetching
      logger.info('Fetching PancakeSwap pools...')
      return []
    } catch (error) {
      logger.error('Failed to fetch PancakeSwap pools:', error)
      return []
    }
  }

  async fetchLiquidSwapPools(): Promise<Pool[]> {
    try {
      // TODO: Implement actual LiquidSwap pool fetching
      logger.info('Fetching LiquidSwap pools...')
      return []
    } catch (error) {
      logger.error('Failed to fetch LiquidSwap pools:', error)
      return []
    }
  }

  getAllPools(): Pool[] {
    return Array.from(this.pools.values())
  }

  getPoolsForPair(coinA: string, coinB: string): Pool[] {
    const pairKey = this.getPairKey(coinA, coinB)
    return this.poolsByPair.get(pairKey) || []
  }

  getPool(poolAddress: string): Pool | undefined {
    return this.pools.get(poolAddress)
  }

  getPoolsByDex(dexType: string): Pool[] {
    return Array.from(this.pools.values()).filter(pool => pool.dexType === dexType)
  }

  getBestPoolForPair(coinA: string, coinB: string, amountIn: string): Pool | null {
    const pools = this.getPoolsForPair(coinA, coinB)
    if (pools.length === 0) return null

    let bestPool: Pool | null = null
    let bestOutput = new Decimal(0)

    for (const pool of pools) {
      try {
        const output = this.calculateOutput(pool, coinA, amountIn)
        if (output.gt(bestOutput)) {
          bestOutput = output
          bestPool = pool
        }
      } catch (error) {
        // Skip pools with insufficient liquidity or other issues
        continue
      }
    }

    return bestPool
  }

  calculateOutput(pool: Pool, coinIn: string, amountIn: string): Decimal {
    const amountInDecimal = new Decimal(amountIn)
    const isA2B = pool.coinA.type === coinIn

    const reserveIn = new Decimal(isA2B ? pool.reserveA : pool.reserveB)
    const reserveOut = new Decimal(isA2B ? pool.reserveB : pool.reserveA)

    if (amountInDecimal.lte(0) || reserveIn.lte(0) || reserveOut.lte(0)) {
      throw new Error('Invalid amounts or reserves')
    }

    // Apply fee
    const feeRate = new Decimal(pool.feeRate).div(10000) // Convert basis points to decimal
    const amountInWithFee = amountInDecimal.mul(new Decimal(1).sub(feeRate))

    // Constant product formula: (x + Δx) * (y - Δy) = x * y
    // Δy = y * Δx / (x + Δx)
    const numerator = amountInWithFee.mul(reserveOut)
    const denominator = reserveIn.add(amountInWithFee)

    return numerator.div(denominator)
  }

  calculatePriceImpact(pool: Pool, coinIn: string, amountIn: string): number {
    const amountInDecimal = new Decimal(amountIn)
    const isA2B = pool.coinA.type === coinIn

    const reserveIn = new Decimal(isA2B ? pool.reserveA : pool.reserveB)
    const reserveOut = new Decimal(isA2B ? pool.reserveB : pool.reserveA)

    if (reserveIn.lte(0) || reserveOut.lte(0)) return 10000 // 100% impact

    const spotPrice = reserveOut.div(reserveIn)
    const amountOut = this.calculateOutput(pool, coinIn, amountIn)
    const executionPrice = amountOut.div(amountInDecimal)

    if (executionPrice.gte(spotPrice)) return 0

    const priceDiff = spotPrice.sub(executionPrice)
    const priceImpact = priceDiff.div(spotPrice).mul(10000) // Convert to basis points

    return Math.floor(priceImpact.toNumber())
  }

  private getPairKey(coinA: string, coinB: string): string {
    // Always use lexicographic order for consistent pairing
    return coinA < coinB ? `${coinA}:${coinB}` : `${coinB}:${coinA}`
  }

  startScheduler(): void {
    // Refresh pools every 30 seconds
    cron.schedule('*/30 * * * * *', async () => {
      try {
        await this.refreshAllPools()
      } catch (error) {
        logger.error('Scheduled pool refresh failed:', error)
      }
    })

    logger.info('Pool refresh scheduler started (30s interval)')
  }

  getLastUpdateTime(): number {
    return this.lastUpdateTime
  }

  getPoolCount(): number {
    return this.pools.size
  }

  getHealthStatus(): {
    status: string
    poolCount: number
    lastUpdate: number
    timeSinceUpdate: number
  } {
    const now = Date.now()
    const timeSinceUpdate = now - this.lastUpdateTime
    const isHealthy = timeSinceUpdate < 60000 // Less than 1 minute

    return {
      status: isHealthy ? 'healthy' : 'stale',
      poolCount: this.pools.size,
      lastUpdate: this.lastUpdateTime,
      timeSinceUpdate,
    }
  }
}

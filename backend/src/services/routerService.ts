import Decimal from 'decimal.js'
import { logger } from '../utils/logger'
import { PoolService, Pool } from './poolService'

export interface Route {
  steps: RouteStep[]
  amountIn: string
  amountOut: string
  priceImpact: number
  fee: string
  estimatedGas: number
}

export interface RouteStep {
  dexType: string
  coinIn: string
  coinOut: string
  poolAddress: string
  amountIn: string
  amountOut: string
  feeRate: number
  priceImpact: number
}

export interface QuoteRequest {
  coinIn: string
  coinOut: string
  amountIn: string
  slippageTolerance?: number
  excludeDexes?: string[]
  maxHops?: number
}

export interface QuoteResponse {
  route: Route
  routes?: Route[]
}

export class RouterService {
  private static instance: RouterService
  private poolService: PoolService
  private maxHops: number = 3

  private constructor() {
    this.poolService = PoolService.getInstance()
  }

  public static getInstance(): RouterService {
    if (!RouterService.instance) {
      RouterService.instance = new RouterService()
    }
    return RouterService.instance
  }

  async initialize(): Promise<void> {
    logger.info('Initializing RouterService...')
    // Any additional initialization if needed
  }

  async findBestRoute(request: QuoteRequest): Promise<QuoteResponse | null> {
    const { coinIn, coinOut, amountIn, excludeDexes = [], maxHops = this.maxHops } = request

    logger.info(`Finding route: ${coinIn} -> ${coinOut}, amount: ${amountIn}`)

    try {
      // Find all possible routes
      const allRoutes = this.findAllRoutes(coinIn, coinOut, amountIn, maxHops, excludeDexes)
      
      if (allRoutes.length === 0) {
        logger.warn(`No routes found for ${coinIn} -> ${coinOut}`)
        return null
      }

      // Sort routes by amount out (descending) and price impact (ascending)
      const sortedRoutes = allRoutes.sort((a, b) => {
        const amountDiff = new Decimal(b.amountOut).sub(new Decimal(a.amountOut))
        if (amountDiff.abs().gt(0.001)) {
          return amountDiff.gt(0) ? 1 : -1
        }
        return a.priceImpact - b.priceImpact
      })

      const bestRoute = sortedRoutes[0]
      const alternativeRoutes = sortedRoutes.slice(1, 5) // Top 5 alternatives

      logger.info(`Found ${allRoutes.length} routes, best output: ${bestRoute.amountOut}`)

      return {
        route: bestRoute,
        routes: alternativeRoutes,
      }
    } catch (error) {
      logger.error('Failed to find route:', error)
      return null
    }
  }

  private findAllRoutes(
    coinIn: string,
    coinOut: string,
    amountIn: string,
    maxHops: number,
    excludeDexes: string[]
  ): Route[] {
    const routes: Route[] = []

    // Direct routes (single hop)
    const directPools = this.poolService.getPoolsForPair(coinIn, coinOut)
    for (const pool of directPools) {
      if (excludeDexes.includes(pool.dexType)) continue

      try {
        const route = this.buildSingleHopRoute(pool, coinIn, coinOut, amountIn)
        if (route) routes.push(route)
      } catch (error) {
        // Skip invalid routes
        continue
      }
    }

    // Multi-hop routes (if maxHops > 1)
    if (maxHops > 1) {
      const multiHopRoutes = this.findMultiHopRoutes(coinIn, coinOut, amountIn, maxHops, excludeDexes)
      routes.push(...multiHopRoutes)
    }

    return routes
  }

  private buildSingleHopRoute(pool: Pool, coinIn: string, coinOut: string, amountIn: string): Route | null {
    try {
      const amountOut = this.poolService.calculateOutput(pool, coinIn, amountIn)
      const priceImpact = this.poolService.calculatePriceImpact(pool, coinIn, amountIn)
      const fee = this.calculateFee(amountIn, pool.feeRate)

      const step: RouteStep = {
        dexType: pool.dexType,
        coinIn,
        coinOut,
        poolAddress: pool.poolAddress,
        amountIn,
        amountOut: amountOut.toString(),
        feeRate: pool.feeRate,
        priceImpact,
      }

      return {
        steps: [step],
        amountIn,
        amountOut: amountOut.toString(),
        priceImpact,
        fee: fee.toString(),
        estimatedGas: 5000, // Base gas estimate
      }
    } catch (error) {
      return null
    }
  }

  private findMultiHopRoutes(
    coinIn: string,
    coinOut: string,
    amountIn: string,
    maxHops: number,
    excludeDexes: string[]
  ): Route[] {
    const routes: Route[] = []
    
    // Get all unique intermediate tokens
    const allPools = this.poolService.getAllPools()
    const intermediateTokens = new Set<string>()

    for (const pool of allPools) {
      if (excludeDexes.includes(pool.dexType)) continue
      
      // Check if pool connects to coinIn
      if (pool.coinA.type === coinIn || pool.coinB.type === coinIn) {
        const otherCoin = pool.coinA.type === coinIn ? pool.coinB.type : pool.coinA.type
        if (otherCoin !== coinOut) {
          intermediateTokens.add(otherCoin)
        }
      }
    }

    // Try 2-hop routes
    for (const intermediateCoin of intermediateTokens) {
      try {
        const route = this.build2HopRoute(coinIn, intermediateCoin, coinOut, amountIn, excludeDexes)
        if (route) routes.push(route)
      } catch (error) {
        continue
      }
    }

    // TODO: Implement 3+ hop routes if needed
    
    return routes
  }

  private build2HopRoute(
    coinIn: string,
    intermediate: string,
    coinOut: string,
    amountIn: string,
    excludeDexes: string[]
  ): Route | null {
    // Find best pool for first hop
    const firstHopPools = this.poolService.getPoolsForPair(coinIn, intermediate)
      .filter(pool => !excludeDexes.includes(pool.dexType))
    
    if (firstHopPools.length === 0) return null

    const bestFirstPool = this.poolService.getBestPoolForPair(coinIn, intermediate, amountIn)
    if (!bestFirstPool) return null

    // Calculate output from first hop
    const firstOutput = this.poolService.calculateOutput(bestFirstPool, coinIn, amountIn)

    // Find best pool for second hop
    const secondHopPools = this.poolService.getPoolsForPair(intermediate, coinOut)
      .filter(pool => !excludeDexes.includes(pool.dexType))
    
    if (secondHopPools.length === 0) return null

    const bestSecondPool = this.poolService.getBestPoolForPair(intermediate, coinOut, firstOutput.toString())
    if (!bestSecondPool) return null

    // Calculate final output
    const finalOutput = this.poolService.calculateOutput(bestSecondPool, intermediate, firstOutput.toString())

    // Build route steps
    const firstPriceImpact = this.poolService.calculatePriceImpact(bestFirstPool, coinIn, amountIn)
    const secondPriceImpact = this.poolService.calculatePriceImpact(bestSecondPool, intermediate, firstOutput.toString())

    const steps: RouteStep[] = [
      {
        dexType: bestFirstPool.dexType,
        coinIn,
        coinOut: intermediate,
        poolAddress: bestFirstPool.poolAddress,
        amountIn,
        amountOut: firstOutput.toString(),
        feeRate: bestFirstPool.feeRate,
        priceImpact: firstPriceImpact,
      },
      {
        dexType: bestSecondPool.dexType,
        coinIn: intermediate,
        coinOut,
        poolAddress: bestSecondPool.poolAddress,
        amountIn: firstOutput.toString(),
        amountOut: finalOutput.toString(),
        feeRate: bestSecondPool.feeRate,
        priceImpact: secondPriceImpact,
      },
    ]

    const totalPriceImpact = firstPriceImpact + secondPriceImpact
    const totalFee = this.calculateFee(amountIn, bestFirstPool.feeRate)
      .add(this.calculateFee(firstOutput.toString(), bestSecondPool.feeRate))

    return {
      steps,
      amountIn,
      amountOut: finalOutput.toString(),
      priceImpact: totalPriceImpact,
      fee: totalFee.toString(),
      estimatedGas: 8000, // Higher gas for multi-hop
    }
  }

  private calculateFee(amount: string, feeRateBp: number): Decimal {
    const amountDecimal = new Decimal(amount)
    const feeRate = new Decimal(feeRateBp).div(10000)
    return amountDecimal.mul(feeRate)
  }

  async getPoolsInfo(): Promise<{
    totalPools: number
    poolsByDex: Record<string, number>
    lastUpdate: number
  }> {
    const allPools = this.poolService.getAllPools()
    const poolsByDex: Record<string, number> = {}

    for (const pool of allPools) {
      poolsByDex[pool.dexType] = (poolsByDex[pool.dexType] || 0) + 1
    }

    return {
      totalPools: allPools.length,
      poolsByDex,
      lastUpdate: this.poolService.getLastUpdateTime(),
    }
  }

  async getSupportedTokens(): Promise<{
    tokens: Array<{
      type: string
      name: string
      symbol: string
      decimals: number
    }>
  }> {
    const allPools = this.poolService.getAllPools()
    const tokenMap = new Map<string, any>()

    for (const pool of allPools) {
      tokenMap.set(pool.coinA.type, {
        type: pool.coinA.type,
        name: pool.coinA.name,
        symbol: pool.coinA.symbol,
        decimals: pool.coinA.decimals,
      })
      tokenMap.set(pool.coinB.type, {
        type: pool.coinB.type,
        name: pool.coinB.name,
        symbol: pool.coinB.symbol,
        decimals: pool.coinB.decimals,
      })
    }

    return {
      tokens: Array.from(tokenMap.values()),
    }
  }
}

import axios, { AxiosInstance } from 'axios'
import { 
  QuoteParams, 
  QuoteResult, 
  RouterQuoteRequest, 
  RouterQuoteResponse, 
  PoolsResponse,
  SwapRoute,
  SwapStep,
  DexInfo,
  AggregatorError,
  RouteNotFoundError,
  InsufficientLiquidityError
} from './types'
import { 
  DexType, 
  DEX_IDS, 
  DEFAULT_API_ENDPOINT, 
  API_TIMEOUT,
  DEFAULT_SLIPPAGE_TOLERANCE,
  MAX_ROUTE_HOPS
} from './constants'
import { MathUtils } from './math'

export class AptosRouter {
  private apiClient: AxiosInstance
  private dexInfos: Map<DexType, DexInfo> = new Map()

  constructor(
    private apiEndpoint: string = DEFAULT_API_ENDPOINT,
    timeout: number = API_TIMEOUT
  ) {
    this.apiClient = axios.create({
      baseURL: apiEndpoint,
      timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.initializeDexInfos()
  }

  private initializeDexInfos() {
    // Initialize with default DEX configurations
    this.dexInfos.set(DexType.CETUS, {
      type: DexType.CETUS,
      name: 'Cetus',
      enabled: true,
      feeRate: 30, // 0.3%
      routerAddress: '', // To be set when contract is deployed
    })

    this.dexInfos.set(DexType.PANCAKE, {
      type: DexType.PANCAKE,
      name: 'PancakeSwap',
      enabled: true,
      feeRate: 25, // 0.25%
      routerAddress: '',
    })

    this.dexInfos.set(DexType.LIQUIDSWAP, {
      type: DexType.LIQUIDSWAP,
      name: 'LiquidSwap',
      enabled: true,
      feeRate: 30, // 0.3%
      routerAddress: '',
    })
  }

  /**
   * Get quote for a swap
   */
  async getQuote(params: QuoteParams): Promise<QuoteResult> {
    try {
      const request: RouterQuoteRequest = {
        coin_in: params.coinIn,
        coin_out: params.coinOut,
        amount_in: params.amountIn,
        slippage_tolerance: params.slippageTolerance ?? DEFAULT_SLIPPAGE_TOLERANCE,
        exclude_dexes: params.excludeDexes,
        max_hops: params.maxHops ?? MAX_ROUTE_HOPS,
      }

      const response = await this.apiClient.post<RouterQuoteResponse>('/quote', request)
      
      if (!response.data.route) {
        throw new RouteNotFoundError(params.coinIn, params.coinOut)
      }

      return this.transformQuoteResponse(response.data, params.slippageTolerance ?? DEFAULT_SLIPPAGE_TOLERANCE)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new RouteNotFoundError(params.coinIn, params.coinOut)
        }
        if (error.response?.status === 400) {
          throw new InsufficientLiquidityError(params.coinIn, params.coinOut)
        }
        throw new AggregatorError(`API request failed: ${error.message}`)
      }
      throw error
    }
  }

  /**
   * Get all available pools
   */
  async getPools(): Promise<PoolsResponse> {
    try {
      const response = await this.apiClient.get<PoolsResponse>('/pools')
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new AggregatorError(`Failed to fetch pools: ${error.message}`)
      }
      throw error
    }
  }

  /**
   * Get pools for a specific pair
   */
  async getPoolsForPair(coinA: string, coinB: string): Promise<PoolsResponse> {
    try {
      const response = await this.apiClient.get<PoolsResponse>('/pools', {
        params: { coin_a: coinA, coin_b: coinB }
      })
      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new AggregatorError(`Failed to fetch pools for pair: ${error.message}`)
      }
      throw error
    }
  }

  /**
   * Find optimal route using local computation (fallback when API is unavailable)
   */
  async findOptimalRouteLocal(params: QuoteParams): Promise<QuoteResult | null> {
    try {
      // Get all available pools
      const poolsResponse = await this.getPools()
      
      // Build graph of available pools
      const graph = this.buildPoolGraph(poolsResponse.pools)
      
      // Find all possible routes
      const routes = this.findAllRoutes(
        params.coinIn,
        params.coinOut,
        graph,
        params.maxHops ?? MAX_ROUTE_HOPS
      )

      if (routes.length === 0) {
        return null
      }

      // Calculate output amounts for each route
      const routesWithOutputs = await Promise.all(
        routes.map(async (route) => {
          const output = this.calculateRouteOutput(route, params.amountIn)
          return {
            route: this.transformToSwapRoute(route, params.amountIn, output.amountOut),
            amountOut: output.amountOut,
            priceImpact: output.priceImpact,
          }
        })
      )

      // Find best route
      const bestRoute = MathUtils.findBestRoute(routesWithOutputs, true)
      
      if (!bestRoute) {
        return null
      }

      const slippage = params.slippageTolerance ?? DEFAULT_SLIPPAGE_TOLERANCE
      const minimumAmountOut = MathUtils.calculateMinOutput(bestRoute.amountOut, slippage)

      return {
        route: bestRoute.route,
        priceImpact: bestRoute.priceImpact,
        minimumAmountOut: minimumAmountOut.toString(),
        fee: MathUtils.calculateFee(params.amountIn, 30).toString(), // Default 0.3% fee
        estimatedGas: 5000, // Estimated gas
        routes: routesWithOutputs.map(r => r.route),
      }
    } catch (error) {
      console.error('Local route finding failed:', error)
      return null
    }
  }

  private transformQuoteResponse(response: RouterQuoteResponse, slippageTolerance: number): QuoteResult {
    const route: SwapRoute = {
      steps: response.route.steps.map(step => ({
        dexId: DEX_IDS[step.dex_type as DexType] ?? 0,
        dexType: step.dex_type as DexType,
        coinIn: step.coin_in,
        coinOut: step.coin_out,
        poolAddress: step.pool_address,
        amountIn: step.amount_in,
        amountOut: step.amount_out,
        feeRate: step.fee_rate,
        priceImpact: step.price_impact,
      })),
      amountIn: response.route.amount_in,
      amountOut: response.route.amount_out,
      priceImpact: response.route.price_impact,
      fee: response.route.fee,
      estimatedGas: response.route.estimated_gas,
    }

    const minimumAmountOut = MathUtils.calculateMinOutput(response.route.amount_out, slippageTolerance)

    return {
      route,
      priceImpact: response.route.price_impact,
      minimumAmountOut: minimumAmountOut.toString(),
      fee: response.route.fee,
      estimatedGas: response.route.estimated_gas,
      routes: response.routes?.map(r => ({
        steps: r.steps.map(step => ({
          dexId: DEX_IDS[step.dex_type as DexType] ?? 0,
          dexType: step.dex_type as DexType,
          coinIn: step.coin_in,
          coinOut: step.coin_out,
          poolAddress: step.pool_address,
          amountIn: step.amount_in,
          amountOut: step.amount_out,
          feeRate: step.fee_rate,
          priceImpact: step.price_impact,
        })),
        amountIn: r.amount_in,
        amountOut: r.amount_out,
        priceImpact: r.price_impact,
        fee: r.fee,
        estimatedGas: r.estimated_gas,
      })),
    }
  }

  private buildPoolGraph(pools: any[]): Map<string, any[]> {
    const graph = new Map<string, any[]>()

    for (const pool of pools) {
      const coinA = pool.coin_a.type
      const coinB = pool.coin_b.type

      if (!graph.has(coinA)) {
        graph.set(coinA, [])
      }
      if (!graph.has(coinB)) {
        graph.set(coinB, [])
      }

      graph.get(coinA)!.push({
        coinOut: coinB,
        pool,
      })
      graph.get(coinB)!.push({
        coinOut: coinA,
        pool,
      })
    }

    return graph
  }

  private findAllRoutes(
    coinIn: string,
    coinOut: string,
    graph: Map<string, any[]>,
    maxHops: number,
    currentPath: any[] = [],
    visited: Set<string> = new Set()
  ): any[][] {
    if (currentPath.length >= maxHops) {
      return []
    }

    if (coinIn === coinOut && currentPath.length > 0) {
      return [currentPath]
    }

    if (visited.has(coinIn)) {
      return []
    }

    visited.add(coinIn)
    const routes: any[][] = []

    const neighbors = graph.get(coinIn) ?? []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor.coinOut)) {
        const newPath = [...currentPath, neighbor]
        const subRoutes = this.findAllRoutes(
          neighbor.coinOut,
          coinOut,
          graph,
          maxHops,
          newPath,
          new Set(visited)
        )
        routes.push(...subRoutes)
      }
    }

    return routes
  }

  private calculateRouteOutput(route: any[], amountIn: string): { amountOut: string; priceImpact: number } {
    let currentAmount = amountIn
    let totalPriceImpact = 0

    for (const step of route) {
      const pool = step.pool
      const isA2B = pool.coin_a.type === step.pool.coin_a.type

      const reserveIn = isA2B ? pool.reserve_a : pool.reserve_b
      const reserveOut = isA2B ? pool.reserve_b : pool.reserve_a

      const amountOut = MathUtils.getAmountOut(currentAmount, reserveIn, reserveOut, pool.fee_rate)
      const priceImpact = MathUtils.calculatePriceImpact(currentAmount, amountOut.toString(), reserveIn, reserveOut)

      currentAmount = amountOut.toString()
      totalPriceImpact += priceImpact
    }

    return {
      amountOut: currentAmount,
      priceImpact: totalPriceImpact,
    }
  }

  private transformToSwapRoute(route: any[], amountIn: string, finalAmountOut: string): SwapRoute {
    let currentAmount = amountIn
    const steps: SwapStep[] = []

    for (const step of route) {
      const pool = step.pool
      const isA2B = pool.coin_a.type === step.pool.coin_a.type

      const reserveIn = isA2B ? pool.reserve_a : pool.reserve_b
      const reserveOut = isA2B ? pool.reserve_b : pool.reserve_a

      const amountOut = MathUtils.getAmountOut(currentAmount, reserveIn, reserveOut, pool.fee_rate)
      const priceImpact = MathUtils.calculatePriceImpact(currentAmount, amountOut.toString(), reserveIn, reserveOut)

      steps.push({
        dexId: DEX_IDS[pool.dex_type as DexType] ?? 0,
        dexType: pool.dex_type,
        coinIn: isA2B ? pool.coin_a.type : pool.coin_b.type,
        coinOut: isA2B ? pool.coin_b.type : pool.coin_a.type,
        poolAddress: pool.pool_address,
        amountIn: currentAmount,
        amountOut: amountOut.toString(),
        feeRate: pool.fee_rate,
        priceImpact,
      })

      currentAmount = amountOut.toString()
    }

    return {
      steps,
      amountIn,
      amountOut: finalAmountOut,
      priceImpact: steps.reduce((sum, step) => sum + step.priceImpact, 0),
      fee: MathUtils.calculateFee(amountIn, 30).toString(),
      estimatedGas: 5000 * steps.length,
    }
  }

  /**
   * Update DEX configuration
   */
  updateDexInfo(dexType: DexType, info: Partial<DexInfo>) {
    const existing = this.dexInfos.get(dexType)
    if (existing) {
      this.dexInfos.set(dexType, { ...existing, ...info })
    }
  }

  /**
   * Get DEX information
   */
  getDexInfo(dexType: DexType): DexInfo | undefined {
    return this.dexInfos.get(dexType)
  }

  /**
   * Get all enabled DEXes
   */
  getEnabledDexes(): DexInfo[] {
    return Array.from(this.dexInfos.values()).filter(dex => dex.enabled)
  }
}

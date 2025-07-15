import { DexType } from './constants'

// Basic types
export interface CoinInfo {
  type: string
  name: string
  symbol: string
  decimals: number
  logoUrl?: string
}

export interface PoolInfo {
  poolAddress: string
  coinA: CoinInfo
  coinB: CoinInfo
  dexType: DexType
  reserveA: string
  reserveB: string
  feeRate: number
  tvl?: string
  volume24h?: string
}

export interface SwapStep {
  dexId: number
  dexType: DexType
  coinIn: string
  coinOut: string
  poolAddress: string
  amountIn: string
  amountOut: string
  feeRate: number
  priceImpact: number
}

export interface SwapRoute {
  steps: SwapStep[]
  amountIn: string
  amountOut: string
  priceImpact: number
  fee: string
  estimatedGas: number
}

export interface QuoteParams {
  coinIn: string
  coinOut: string
  amountIn: string
  slippageTolerance?: number
  excludeDexes?: DexType[]
  maxHops?: number
}

export interface QuoteResult {
  route: SwapRoute
  priceImpact: number
  minimumAmountOut: string
  fee: string
  estimatedGas: number
  routes?: SwapRoute[] // Alternative routes
}

export interface SwapParams {
  route: SwapRoute
  slippageTolerance: number
  deadline?: number
  recipient?: string
}

export interface TransactionPayload {
  type: string
  function: string
  arguments: any[]
  type_arguments: string[]
}

// Router API types
export interface RouterQuoteRequest {
  coin_in: string
  coin_out: string
  amount_in: string
  slippage_tolerance?: number
  exclude_dexes?: string[]
  max_hops?: number
}

export interface RouterQuoteResponse {
  route: {
    steps: Array<{
      dex_type: string
      coin_in: string
      coin_out: string
      pool_address: string
      amount_in: string
      amount_out: string
      fee_rate: number
      price_impact: number
    }>
    amount_in: string
    amount_out: string
    price_impact: number
    fee: string
    estimated_gas: number
  }
  routes?: Array<{
    steps: Array<{
      dex_type: string
      coin_in: string
      coin_out: string
      pool_address: string
      amount_in: string
      amount_out: string
      fee_rate: number
      price_impact: number
    }>
    amount_in: string
    amount_out: string
    price_impact: number
    fee: string
    estimated_gas: number
  }>
}

export interface PoolsResponse {
  pools: Array<{
    pool_address: string
    coin_a: {
      type: string
      name: string
      symbol: string
      decimals: number
      logo_url?: string
    }
    coin_b: {
      type: string
      name: string
      symbol: string
      decimals: number
      logo_url?: string
    }
    dex_type: string
    reserve_a: string
    reserve_b: string
    fee_rate: number
    tvl?: string
    volume_24h?: string
  }>
}

export interface DexInfo {
  type: DexType
  name: string
  enabled: boolean
  feeRate: number
  routerAddress: string
  factoryAddress?: string
}

// Error types
export class AggregatorError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'AggregatorError'
  }
}

export class InsufficientLiquidityError extends AggregatorError {
  constructor(coinIn: string, coinOut: string) {
    super(`Insufficient liquidity for ${coinIn} -> ${coinOut}`, 'INSUFFICIENT_LIQUIDITY')
  }
}

export class RouteNotFoundError extends AggregatorError {
  constructor(coinIn: string, coinOut: string) {
    super(`No route found for ${coinIn} -> ${coinOut}`, 'ROUTE_NOT_FOUND')
  }
}

export class SlippageExceededError extends AggregatorError {
  constructor(expected: string, actual: string) {
    super(`Slippage exceeded: expected ${expected}, got ${actual}`, 'SLIPPAGE_EXCEEDED')
  }
}

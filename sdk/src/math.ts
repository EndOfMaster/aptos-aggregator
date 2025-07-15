import Decimal from 'decimal.js'
import { BASIS_POINTS } from './constants'

export class MathUtils {
  /**
   * Calculate fee amount from basis points
   */
  static calculateFee(amount: string | number, feeRateBp: number): Decimal {
    const amountDecimal = new Decimal(amount)
    const feeRate = new Decimal(feeRateBp).div(BASIS_POINTS)
    return amountDecimal.mul(feeRate)
  }

  /**
   * Calculate amount after deducting fee
   */
  static amountAfterFee(amount: string | number, feeRateBp: number): Decimal {
    const amountDecimal = new Decimal(amount)
    const fee = this.calculateFee(amount, feeRateBp)
    return amountDecimal.sub(fee)
  }

  /**
   * Calculate minimum output amount with slippage tolerance
   */
  static calculateMinOutput(amount: string | number, slippageToleranceBp: number): Decimal {
    const amountDecimal = new Decimal(amount)
    const slippageRate = new Decimal(slippageToleranceBp).div(BASIS_POINTS)
    const slippageAmount = amountDecimal.mul(slippageRate)
    return amountDecimal.sub(slippageAmount)
  }

  /**
   * Calculate maximum input amount with slippage tolerance
   */
  static calculateMaxInput(amount: string | number, slippageToleranceBp: number): Decimal {
    const amountDecimal = new Decimal(amount)
    const slippageRate = new Decimal(slippageToleranceBp).div(BASIS_POINTS)
    const slippageAmount = amountDecimal.mul(slippageRate)
    return amountDecimal.add(slippageAmount)
  }

  /**
   * Calculate output amount using constant product formula (x * y = k)
   */
  static getAmountOut(
    amountIn: string | number,
    reserveIn: string | number,
    reserveOut: string | number,
    feeRateBp: number = 30
  ): Decimal {
    const amountInDecimal = new Decimal(amountIn)
    const reserveInDecimal = new Decimal(reserveIn)
    const reserveOutDecimal = new Decimal(reserveOut)

    if (amountInDecimal.lte(0) || reserveInDecimal.lte(0) || reserveOutDecimal.lte(0)) {
      throw new Error('Invalid amounts or reserves')
    }

    const amountInWithFee = this.amountAfterFee(amountInDecimal, feeRateBp)
    const numerator = amountInWithFee.mul(reserveOutDecimal)
    const denominator = reserveInDecimal.add(amountInWithFee)
    
    return numerator.div(denominator)
  }

  /**
   * Calculate input amount needed for desired output (reverse of getAmountOut)
   */
  static getAmountIn(
    amountOut: string | number,
    reserveIn: string | number,
    reserveOut: string | number,
    feeRateBp: number = 30
  ): Decimal {
    const amountOutDecimal = new Decimal(amountOut)
    const reserveInDecimal = new Decimal(reserveIn)
    const reserveOutDecimal = new Decimal(reserveOut)

    if (amountOutDecimal.lte(0) || reserveInDecimal.lte(0) || reserveOutDecimal.lte(0)) {
      throw new Error('Invalid amounts or reserves')
    }

    if (amountOutDecimal.gte(reserveOutDecimal)) {
      throw new Error('Amount out exceeds reserve')
    }

    const numerator = reserveInDecimal.mul(amountOutDecimal)
    const denominator = reserveOutDecimal.sub(amountOutDecimal)
    let amountIn = numerator.div(denominator).add(1) // Add 1 for rounding

    // Account for fee
    const feeMultiplier = new Decimal(BASIS_POINTS)
    const feeDivisor = new Decimal(BASIS_POINTS - feeRateBp)
    amountIn = amountIn.mul(feeMultiplier).div(feeDivisor)

    return amountIn
  }

  /**
   * Calculate price impact in basis points
   */
  static calculatePriceImpact(
    amountIn: string | number,
    amountOut: string | number,
    reserveIn: string | number,
    reserveOut: string | number
  ): number {
    const amountInDecimal = new Decimal(amountIn)
    const amountOutDecimal = new Decimal(amountOut)
    const reserveInDecimal = new Decimal(reserveIn)
    const reserveOutDecimal = new Decimal(reserveOut)

    if (reserveInDecimal.lte(0) || reserveOutDecimal.lte(0)) {
      return BASIS_POINTS // 100% impact if no reserves
    }

    // Spot price = reserveOut / reserveIn
    const spotPrice = reserveOutDecimal.div(reserveInDecimal)
    
    // Execution price = amountOut / amountIn
    const executionPrice = amountOutDecimal.div(amountInDecimal)

    if (executionPrice.gte(spotPrice)) {
      return 0 // No negative impact
    }

    // Price impact = (spotPrice - executionPrice) / spotPrice
    const priceDiff = spotPrice.sub(executionPrice)
    const priceImpact = priceDiff.div(spotPrice).mul(BASIS_POINTS)

    return Math.floor(priceImpact.toNumber())
  }

  /**
   * Compare two amounts with tolerance
   */
  static isWithinTolerance(
    amount1: string | number,
    amount2: string | number,
    toleranceBp: number
  ): boolean {
    const amount1Decimal = new Decimal(amount1)
    const amount2Decimal = new Decimal(amount2)
    
    if (amount1Decimal.eq(amount2Decimal)) return true

    const larger = Decimal.max(amount1Decimal, amount2Decimal)
    const smaller = Decimal.min(amount1Decimal, amount2Decimal)
    const diff = larger.sub(smaller)
    const diffPercentage = diff.div(larger).mul(BASIS_POINTS)

    return diffPercentage.lte(toleranceBp)
  }

  /**
   * Format amount with proper decimals
   */
  static formatAmount(amount: string | number, decimals: number): string {
    const amountDecimal = new Decimal(amount)
    return amountDecimal.div(new Decimal(10).pow(decimals)).toFixed()
  }

  /**
   * Parse amount to raw units
   */
  static parseAmount(amount: string | number, decimals: number): string {
    const amountDecimal = new Decimal(amount)
    return amountDecimal.mul(new Decimal(10).pow(decimals)).floor().toString()
  }

  /**
   * Calculate optimal route among multiple options
   */
  static findBestRoute<T extends { amountOut: string; priceImpact: number }>(
    routes: T[],
    prioritizeAmount: boolean = true
  ): T | null {
    if (routes.length === 0) return null
    if (routes.length === 1) return routes[0]

    // Sort by amount out (descending) and price impact (ascending)
    const sorted = routes.sort((a, b) => {
      if (prioritizeAmount) {
        const amountDiff = new Decimal(b.amountOut).sub(new Decimal(a.amountOut))
        if (amountDiff.abs().gt(0.001)) { // If amounts differ significantly
          return amountDiff.gt(0) ? 1 : -1
        }
      }
      // If amounts are similar, prefer lower price impact
      return a.priceImpact - b.priceImpact
    })

    return sorted[0]
  }

  /**
   * Validate coin type format
   */
  static isValidCoinType(coinType: string): boolean {
    // Basic validation for Aptos coin type format
    const aptosAddressRegex = /^0x[a-fA-F0-9]+::[a-zA-Z_][a-zA-Z0-9_]*::[a-zA-Z_][a-zA-Z0-9_]*$/
    return aptosAddressRegex.test(coinType)
  }

  /**
   * Convert basis points to percentage
   */
  static bpToPercentage(basisPoints: number): string {
    const percentage = new Decimal(basisPoints).div(100).toFixed(2)
    return `${percentage}%`
  }

  /**
   * Convert percentage to basis points
   */
  static percentageToBp(percentage: number): number {
    return Math.round(percentage * 100)
  }
}

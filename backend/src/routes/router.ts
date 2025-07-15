import { Router, Request, Response } from 'express'
import Joi from 'joi'
import { RouterService, QuoteRequest } from '../services/routerService'
import { ValidationError, APIError } from '../middleware/errorHandler'
import { logger } from '../utils/logger'

const router = Router()
const routerService = RouterService.getInstance()

// Validation schemas
const quoteSchema = Joi.object({
  coin_in: Joi.string().required().min(10),
  coin_out: Joi.string().required().min(10),
  amount_in: Joi.string().required().pattern(/^\d+$/),
  slippage_tolerance: Joi.number().optional().min(1).max(10000).default(50),
  exclude_dexes: Joi.array().items(Joi.string()).optional().default([]),
  max_hops: Joi.number().optional().min(1).max(3).default(3),
})

/**
 * POST /quote
 * Get best route and quote for a swap
 */
router.post('/quote', async (req: Request, res: Response) => {
  try {
    // Validate request
    const { error, value } = quoteSchema.validate(req.body)
    if (error) {
      throw new ValidationError(`Validation error: ${error.details[0].message}`)
    }

    const request: QuoteRequest = {
      coinIn: value.coin_in,
      coinOut: value.coin_out,
      amountIn: value.amount_in,
      slippageTolerance: value.slippage_tolerance,
      excludeDexes: value.exclude_dexes,
      maxHops: value.max_hops,
    }

    // Validate coin types
    if (request.coinIn === request.coinOut) {
      throw new ValidationError('Input and output coins cannot be the same')
    }

    if (!/^0x[a-fA-F0-9]+::[a-zA-Z_][a-zA-Z0-9_]*::[a-zA-Z_][a-zA-Z0-9_]*$/.test(request.coinIn)) {
      throw new ValidationError('Invalid coin_in format')
    }

    if (!/^0x[a-fA-F0-9]+::[a-zA-Z_][a-zA-Z0-9_]*::[a-zA-Z_][a-zA-Z0-9_]*$/.test(request.coinOut)) {
      throw new ValidationError('Invalid coin_out format')
    }

    // Find best route
    const result = await routerService.findBestRoute(request)
    
    if (!result) {
      res.status(404).json({
        error: 'No route found',
        message: `No liquidity available for ${request.coinIn} -> ${request.coinOut}`,
      })
      return
    }

    // Transform response to match API format
    const response = {
      route: {
        steps: result.route.steps.map(step => ({
          dex_type: step.dexType,
          coin_in: step.coinIn,
          coin_out: step.coinOut,
          pool_address: step.poolAddress,
          amount_in: step.amountIn,
          amount_out: step.amountOut,
          fee_rate: step.feeRate,
          price_impact: step.priceImpact,
        })),
        amount_in: result.route.amountIn,
        amount_out: result.route.amountOut,
        price_impact: result.route.priceImpact,
        fee: result.route.fee,
        estimated_gas: result.route.estimatedGas,
      },
      routes: result.routes?.map(route => ({
        steps: route.steps.map(step => ({
          dex_type: step.dexType,
          coin_in: step.coinIn,
          coin_out: step.coinOut,
          pool_address: step.poolAddress,
          amount_in: step.amountIn,
          amount_out: step.amountOut,
          fee_rate: step.feeRate,
          price_impact: step.priceImpact,
        })),
        amount_in: route.amountIn,
        amount_out: route.amountOut,
        price_impact: route.priceImpact,
        fee: route.fee,
        estimated_gas: route.estimatedGas,
      })),
    }

    res.json(response)
  } catch (error) {
    if (error instanceof ValidationError || error instanceof APIError) {
      throw error
    }
    logger.error('Quote endpoint error:', error)
    throw new APIError('Internal server error', 500)
  }
})

/**
 * GET /info
 * Get router information and statistics
 */
router.get('/info', async (req: Request, res: Response) => {
  try {
    const poolsInfo = await routerService.getPoolsInfo()
    const supportedTokens = await routerService.getSupportedTokens()

    res.json({
      pools: poolsInfo,
      supported_tokens_count: supportedTokens.tokens.length,
      supported_dexes: ['CETUS', 'PANCAKE', 'LIQUIDSWAP'],
      max_hops: 3,
      default_slippage_tolerance: 50, // 0.5%
    })
  } catch (error) {
    logger.error('Router info endpoint error:', error)
    throw new APIError('Failed to get router information', 500)
  }
})

/**
 * GET /tokens
 * Get all supported tokens
 */
router.get('/tokens', async (req: Request, res: Response) => {
  try {
    const result = await routerService.getSupportedTokens()
    res.json(result)
  } catch (error) {
    logger.error('Tokens endpoint error:', error)
    throw new APIError('Failed to get supported tokens', 500)
  }
})

/**
 * GET /dexes
 * Get supported DEXes information
 */
router.get('/dexes', async (req: Request, res: Response) => {
  try {
    const poolsInfo = await routerService.getPoolsInfo()
    
    const dexes = Object.entries(poolsInfo.poolsByDex).map(([dexType, poolCount]) => ({
      name: dexType,
      pool_count: poolCount,
      enabled: true,
      fee_rate: getDexFeeRate(dexType),
    }))

    res.json({ dexes })
  } catch (error) {
    logger.error('DEXes endpoint error:', error)
    throw new APIError('Failed to get DEX information', 500)
  }
})

function getDexFeeRate(dexType: string): number {
  switch (dexType) {
    case 'CETUS':
      return 30 // 0.3%
    case 'PANCAKE':
      return 25 // 0.25%
    case 'LIQUIDSWAP':
      return 30 // 0.3%
    default:
      return 30 // Default 0.3%
  }
}

export { router as routerRoutes }

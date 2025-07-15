import { Router, Request, Response } from 'express'
import { PoolService } from '../services/poolService'
import { APIError } from '../middleware/errorHandler'
import { logger } from '../utils/logger'

const router = Router()
const poolService = PoolService.getInstance()

/**
 * GET /
 * Get all available pools
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { dex_type, coin_a, coin_b } = req.query

    let pools = poolService.getAllPools()

    // Filter by DEX type
    if (dex_type && typeof dex_type === 'string') {
      pools = pools.filter(pool => pool.dexType === dex_type.toUpperCase())
    }

    // Filter by coin pair
    if (coin_a && coin_b && typeof coin_a === 'string' && typeof coin_b === 'string') {
      pools = poolService.getPoolsForPair(coin_a, coin_b)
    }

    // Transform to API format
    const response = {
      pools: pools.map(pool => ({
        pool_address: pool.poolAddress,
        coin_a: {
          type: pool.coinA.type,
          name: pool.coinA.name,
          symbol: pool.coinA.symbol,
          decimals: pool.coinA.decimals,
          logo_url: pool.coinA.logoUrl,
        },
        coin_b: {
          type: pool.coinB.type,
          name: pool.coinB.name,
          symbol: pool.coinB.symbol,
          decimals: pool.coinB.decimals,
          logo_url: pool.coinB.logoUrl,
        },
        dex_type: pool.dexType,
        reserve_a: pool.reserveA,
        reserve_b: pool.reserveB,
        fee_rate: pool.feeRate,
        tvl: pool.tvl,
        volume_24h: pool.volume24h,
        last_updated: pool.lastUpdated,
      })),
      total_count: pools.length,
      last_update: poolService.getLastUpdateTime(),
    }

    res.json(response)
  } catch (error) {
    logger.error('Pools endpoint error:', error)
    throw new APIError('Failed to get pools', 500)
  }
})

/**
 * GET /:poolAddress
 * Get specific pool information
 */
router.get('/:poolAddress', async (req: Request, res: Response) => {
  try {
    const { poolAddress } = req.params
    const pool = poolService.getPool(poolAddress)

    if (!pool) {
      res.status(404).json({
        error: 'Pool not found',
        pool_address: poolAddress,
      })
      return
    }

    const response = {
      pool_address: pool.poolAddress,
      coin_a: {
        type: pool.coinA.type,
        name: pool.coinA.name,
        symbol: pool.coinA.symbol,
        decimals: pool.coinA.decimals,
        logo_url: pool.coinA.logoUrl,
      },
      coin_b: {
        type: pool.coinB.type,
        name: pool.coinB.name,
        symbol: pool.coinB.symbol,
        decimals: pool.coinB.decimals,
        logo_url: pool.coinB.logoUrl,
      },
      dex_type: pool.dexType,
      reserve_a: pool.reserveA,
      reserve_b: pool.reserveB,
      fee_rate: pool.feeRate,
      tvl: pool.tvl,
      volume_24h: pool.volume24h,
      last_updated: pool.lastUpdated,
    }

    res.json(response)
  } catch (error) {
    logger.error('Pool detail endpoint error:', error)
    throw new APIError('Failed to get pool details', 500)
  }
})

/**
 * GET /stats
 * Get pool statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const allPools = poolService.getAllPools()
    
    // Calculate statistics
    const stats = {
      total_pools: allPools.length,
      pools_by_dex: {} as Record<string, number>,
      total_tvl: '0',
      total_volume_24h: '0',
      last_update: poolService.getLastUpdateTime(),
    }

    let totalTvl = 0
    let totalVolume = 0

    for (const pool of allPools) {
      // Count by DEX
      stats.pools_by_dex[pool.dexType] = (stats.pools_by_dex[pool.dexType] || 0) + 1
      
      // Sum TVL and volume (if available)
      if (pool.tvl) {
        totalTvl += parseFloat(pool.tvl)
      }
      if (pool.volume24h) {
        totalVolume += parseFloat(pool.volume24h)
      }
    }

    stats.total_tvl = totalTvl.toString()
    stats.total_volume_24h = totalVolume.toString()

    res.json(stats)
  } catch (error) {
    logger.error('Pool stats endpoint error:', error)
    throw new APIError('Failed to get pool statistics', 500)
  }
})

/**
 * POST /refresh
 * Manually trigger pool data refresh (admin only)
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin authentication
    const startTime = Date.now()
    
    await poolService.refreshAllPools()
    
    const duration = Date.now() - startTime
    
    res.json({
      message: 'Pools refreshed successfully',
      duration_ms: duration,
      pool_count: poolService.getPoolCount(),
      timestamp: Date.now(),
    })
  } catch (error) {
    logger.error('Pool refresh endpoint error:', error)
    throw new APIError('Failed to refresh pools', 500)
  }
})

export { router as poolRoutes }

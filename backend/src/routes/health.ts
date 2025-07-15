import { Router, Request, Response } from 'express'
import { PoolService } from '../services/poolService'
import { RouterService } from '../services/routerService'

const router = Router()

/**
 * GET /
 * Health check endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  const poolService = PoolService.getInstance()
  const routerService = RouterService.getInstance()

  try {
    // Get service health status
    const poolHealth = poolService.getHealthStatus()
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        pool_service: {
          status: poolHealth.status,
          pool_count: poolHealth.poolCount,
          last_update: poolHealth.lastUpdate,
          time_since_update: poolHealth.timeSinceUpdate,
        },
        router_service: {
          status: 'healthy',
        },
      },
    }

    // Overall health check
    const isHealthy = poolHealth.status === 'healthy'
    
    res.status(isHealthy ? 200 : 503).json(health)
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    })
  }
})

/**
 * GET /ready
 * Readiness check (for k8s)
 */
router.get('/ready', async (req: Request, res: Response) => {
  const poolService = PoolService.getInstance()
  
  try {
    const poolCount = poolService.getPoolCount()
    const lastUpdate = poolService.getLastUpdateTime()
    const timeSinceUpdate = Date.now() - lastUpdate
    
    // Service is ready if we have pools and they're not too stale
    const isReady = poolCount > 0 && timeSinceUpdate < 300000 // 5 minutes
    
    if (isReady) {
      res.json({
        status: 'ready',
        pool_count: poolCount,
        last_update: lastUpdate,
      })
    } else {
      res.status(503).json({
        status: 'not_ready',
        reason: poolCount === 0 ? 'No pools loaded' : 'Pool data is stale',
        pool_count: poolCount,
        time_since_update: timeSinceUpdate,
      })
    }
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      error: 'Readiness check failed',
    })
  }
})

/**
 * GET /live
 * Liveness check (for k8s)
 */
router.get('/live', (req: Request, res: Response) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

export { router as healthRoutes }

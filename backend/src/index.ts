import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import { logger } from './utils/logger'
import { errorHandler } from './middleware/errorHandler'
import { routerRoutes } from './routes/router'
import { poolRoutes } from './routes/pools'
import { healthRoutes } from './routes/health'
import { PoolService } from './services/poolService'
import { RouterService } from './services/routerService'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
})

// Middleware
app.use(helmet())
app.use(cors())
app.use(compression())
app.use(limiter)
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    query: req.query,
  })
  next()
})

// Routes
app.use('/v1/health', healthRoutes)
app.use('/v1/router', routerRoutes)
app.use('/v1/pools', poolRoutes)

// Error handling
app.use(errorHandler)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
  })
})

async function startServer() {
  try {
    // Initialize services
    logger.info('Initializing services...')
    
    const poolService = PoolService.getInstance()
    const routerService = RouterService.getInstance()
    
    await poolService.initialize()
    await routerService.initialize()
    
    // Start pool data refresh scheduler
    poolService.startScheduler()
    
    app.listen(PORT, () => {
      logger.info(`🚀 Aptos Aggregator API server running on port ${PORT}`)
      logger.info(`📊 Health check: http://localhost:${PORT}/v1/health`)
      logger.info(`🔄 Router API: http://localhost:${PORT}/v1/router`)
      logger.info(`🏊 Pools API: http://localhost:${PORT}/v1/pools`)
    })
  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...')
  process.exit(0)
})

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...')
  process.exit(0)
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error)
  process.exit(1)
})

startServer()

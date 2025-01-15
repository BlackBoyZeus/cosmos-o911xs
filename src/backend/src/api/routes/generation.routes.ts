import { Router } from 'express'; // ^4.18.0
import asyncHandler from 'express-async-handler'; // ^1.2.0
import * as prometheus from 'prom-client'; // ^14.0.0

// Internal imports
import { GenerationController } from '../controllers/GenerationController';
import { authenticate, authorizeRole } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimiter';
import { validateGenerationRequestMiddleware, validateStatusRequest } from '../middleware/validator';
import { Logger } from '../../utils/logger';
import { MetricsCollector } from '../../utils/metrics';

// Constants
const ALLOWED_ROLES = ['researcher', 'engineer', 'admin'] as const;
const RATE_LIMIT_TIERS = {
  basic: 60,
  premium: 300,
  enterprise: 1000
} as const;

// Initialize metrics
const requestDurationHistogram = new prometheus.Histogram({
  name: 'cosmos_wfm_generation_request_duration_seconds',
  help: 'Duration of generation requests',
  labelNames: ['endpoint', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600]
});

/**
 * Configures and returns Express router for video generation endpoints
 * Implements comprehensive security, validation, and monitoring
 */
export default function configureGenerationRoutes(controller: GenerationController): Router {
  const router = Router();
  const logger = Logger.getInstance();
  const metrics = MetricsCollector.getInstance();

  // Configure rate limiters for different tiers
  const basicLimiter = createRateLimiter({
    windowMs: 60000,
    max: RATE_LIMIT_TIERS.basic,
    message: 'Rate limit exceeded for basic tier'
  });

  const premiumLimiter = createRateLimiter({
    windowMs: 60000,
    max: RATE_LIMIT_TIERS.premium,
    message: 'Rate limit exceeded for premium tier'
  });

  const enterpriseLimiter = createRateLimiter({
    windowMs: 60000,
    max: RATE_LIMIT_TIERS.enterprise,
    message: 'Rate limit exceeded for enterprise tier'
  });

  // Middleware to track request duration
  const trackDuration = (endpoint: string) => (req: any, res: any, next: any) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      requestDurationHistogram.labels(endpoint, res.statusCode.toString()).observe(duration);
    });
    next();
  };

  // Health check endpoint
  router.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
  });

  // Video generation endpoint
  router.post('/generate',
    authenticate,
    authorizeRole(ALLOWED_ROLES),
    (req, res, next) => {
      const tier = req.user?.tier || 'basic';
      switch (tier) {
        case 'premium': return premiumLimiter(req, res, next);
        case 'enterprise': return enterpriseLimiter(req, res, next);
        default: return basicLimiter(req, res, next);
      }
    },
    validateGenerationRequestMiddleware,
    trackDuration('/generate'),
    asyncHandler(async (req, res) => {
      const startTime = Date.now();
      try {
        const result = await controller.generateVideo(req, res);
        
        // Record metrics
        const duration = Date.now() - startTime;
        metrics.recordGenerationMetrics(duration, {
          userId: req.user?.userId,
          tier: req.user?.tier,
          modelType: req.body.modelType,
          success: true
        });

        return result;
      } catch (error) {
        // Record error metrics
        metrics.recordGenerationMetrics(Date.now() - startTime, {
          userId: req.user?.userId,
          tier: req.user?.tier,
          modelType: req.body.modelType,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    })
  );

  // Generation status endpoint
  router.get('/status/:requestId',
    authenticate,
    authorizeRole(ALLOWED_ROLES),
    validateStatusRequest,
    trackDuration('/status'),
    asyncHandler(async (req, res) => {
      const result = await controller.getGenerationStatus(req, res);
      return result;
    })
  );

  // Cancel generation endpoint
  router.delete('/generate/:requestId',
    authenticate,
    authorizeRole(ALLOWED_ROLES),
    trackDuration('/cancel'),
    asyncHandler(async (req, res) => {
      const result = await controller.cancelGeneration(req, res);
      return result;
    })
  );

  // Error handling middleware
  router.use((err: any, req: any, res: any, next: any) => {
    logger.error('Generation route error', {
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
      userId: req.user?.userId,
      path: req.path
    });

    res.status(err.status || 500).json({
      error: {
        message: err.message || 'Internal server error',
        code: err.code || 'INTERNAL_ERROR',
        correlationId: req.correlationId,
        timestamp: new Date().toISOString()
      }
    });
  });

  return router;
}
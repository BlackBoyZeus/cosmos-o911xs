import { Router } from 'express'; // ^4.18.0
import { ModelController } from '../controllers/ModelController';
import { 
  authenticate, 
  authorizeRole, 
  validateRequest 
} from '../middleware/auth';
import { 
  validateGenerationRequestMiddleware,
  validateModelConfigMiddleware 
} from '../middleware/validator';
import { RateLimiterMemory } from 'rate-limiter-flexible'; // ^4.0.0
import { logger } from '../../utils/logger';
import { ProcessingStatus } from '../../types/common';

// Role-based access control constants
const ROLES = {
  ADMIN: 'admin',
  RESEARCHER: 'researcher',
  ENGINEER: 'engineer',
  VIEWER: 'viewer'
} as const;

// Rate limiting configuration based on technical specifications
const RATE_LIMITS = {
  GENERATE: 100,  // requests per minute
  TRAIN: 10,      // requests per minute
  METRICS: 1000   // requests per minute
} as const;

// Error codes for consistent error handling
const ERROR_CODES = {
  VALIDATION: 400,
  AUTH: 401,
  FORBIDDEN: 403,
  TIMEOUT: 408,
  RATE_LIMIT: 429
} as const;

/**
 * Creates and configures the Express router for model-related endpoints
 * Implements comprehensive middleware chains and error handling
 */
export default function createModelRouter(modelController: ModelController): Router {
  const router = Router();

  // Initialize rate limiters
  const generateLimiter = new RateLimiterMemory({
    points: RATE_LIMITS.GENERATE,
    duration: 60
  });

  const trainLimiter = new RateLimiterMemory({
    points: RATE_LIMITS.TRAIN,
    duration: 60
  });

  const metricsLimiter = new RateLimiterMemory({
    points: RATE_LIMITS.METRICS,
    duration: 60
  });

  /**
   * POST /api/model/generate
   * Generate synthetic video with comprehensive validation and monitoring
   */
  router.post('/generate',
    authenticate,
    authorizeRole([ROLES.RESEARCHER, ROLES.ADMIN]),
    validateGenerationRequestMiddleware,
    async (req, res, next) => {
      try {
        // Apply rate limiting
        await generateLimiter.consume(req.ip);

        // Track request metrics
        const startTime = Date.now();
        const correlationId = req.headers['x-correlation-id'] as string;

        logger.info('Starting video generation request', {
          correlationId,
          userId: req.user?.userId,
          modelType: req.body.modelType
        });

        const result = await modelController.generateVideo(req, res);

        // Log completion metrics
        logger.info('Video generation completed', {
          correlationId,
          duration: Date.now() - startTime,
          status: ProcessingStatus.COMPLETED
        });

        return result;
      } catch (error) {
        if (error.name === 'RateLimiterError') {
          return res.status(ERROR_CODES.RATE_LIMIT).json({
            error: 'Rate limit exceeded',
            retryAfter: error.msBeforeNext / 1000
          });
        }
        next(error);
      }
    }
  );

  /**
   * POST /api/model/train
   * Train model with distributed support and resource management
   */
  router.post('/train',
    authenticate,
    authorizeRole([ROLES.ADMIN]),
    validateModelConfigMiddleware,
    async (req, res, next) => {
      try {
        // Apply rate limiting
        await trainLimiter.consume(req.ip);

        const correlationId = req.headers['x-correlation-id'] as string;

        logger.info('Starting model training', {
          correlationId,
          userId: req.user?.userId,
          modelType: req.body.modelType,
          datasetPath: req.body.datasetPath
        });

        const result = await modelController.trainModel(req, res);

        logger.info('Training completed', {
          correlationId,
          status: ProcessingStatus.COMPLETED
        });

        return result;
      } catch (error) {
        if (error.name === 'RateLimiterError') {
          return res.status(ERROR_CODES.RATE_LIMIT).json({
            error: 'Rate limit exceeded',
            retryAfter: error.msBeforeNext / 1000
          });
        }
        next(error);
      }
    }
  );

  /**
   * GET /api/model/metrics
   * Get detailed model performance metrics with filtering
   */
  router.get('/metrics',
    authenticate,
    authorizeRole([ROLES.RESEARCHER, ROLES.ADMIN, ROLES.ENGINEER]),
    async (req, res, next) => {
      try {
        // Apply rate limiting
        await metricsLimiter.consume(req.ip);

        const correlationId = req.headers['x-correlation-id'] as string;

        logger.info('Retrieving performance metrics', {
          correlationId,
          userId: req.user?.userId,
          filters: req.query
        });

        const result = await modelController.getPerformanceMetrics(req, res);

        logger.info('Metrics retrieved successfully', {
          correlationId
        });

        return result;
      } catch (error) {
        if (error.name === 'RateLimiterError') {
          return res.status(ERROR_CODES.RATE_LIMIT).json({
            error: 'Rate limit exceeded',
            retryAfter: error.msBeforeNext / 1000
          });
        }
        next(error);
      }
    }
  );

  // Error handling middleware
  router.use((error: Error, req: any, res: any, next: any) => {
    logger.error('Model route error', {
      error: error.message,
      stack: error.stack,
      correlationId: req.headers['x-correlation-id'],
      userId: req.user?.userId,
      path: req.path
    });

    res.status(error.name === 'ValidationError' ? ERROR_CODES.VALIDATION : 500).json({
      error: error.name,
      message: error.message,
      correlationId: req.headers['x-correlation-id']
    });
  });

  return router;
}
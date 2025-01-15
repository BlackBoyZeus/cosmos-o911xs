import { Router } from 'express';
import { body, param } from 'express-validator';
import CircuitBreaker from 'opossum';
import pino from 'pino';

import { DatasetController } from '../controllers/DatasetController';
import { authenticate, authorizeRole } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimiter';

// Constants for role-based access control
const ROLES = {
  ADMIN: 'admin',
  RESEARCHER: 'researcher',
  ENGINEER: 'engineer',
  VIEWER: 'viewer'
} as const;

// Rate limiting configurations per endpoint
const RATE_LIMITS = {
  CREATE: {
    windowMs: 60000,
    max: 10,
    keyPrefix: 'dataset:create',
    errorMessage: 'Too many dataset creation requests'
  },
  PROCESS: {
    windowMs: 60000,
    max: 5,
    keyPrefix: 'dataset:process',
    errorMessage: 'Too many dataset processing requests'
  },
  READ: {
    windowMs: 60000,
    max: 100,
    keyPrefix: 'dataset:read',
    errorMessage: 'Too many dataset read requests'
  },
  UPDATE: {
    windowMs: 60000,
    max: 20,
    keyPrefix: 'dataset:update',
    errorMessage: 'Too many dataset update requests'
  },
  DELETE: {
    windowMs: 60000,
    max: 5,
    keyPrefix: 'dataset:delete',
    errorMessage: 'Too many dataset deletion requests'
  }
} as const;

// Circuit breaker configuration
const CIRCUIT_BREAKER_CONFIG = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
};

/**
 * Configures and returns an Express router with secure, monitored dataset endpoints
 */
export function configureDatasetRoutes(datasetController: DatasetController): Router {
  const router = Router();
  const logger = pino({ name: 'dataset-routes' });

  // Apply authentication middleware to all routes
  router.use(authenticate);

  // Initialize rate limiters
  const createLimiter = createRateLimiter(RATE_LIMITS.CREATE);
  const processLimiter = createRateLimiter(RATE_LIMITS.PROCESS);
  const readLimiter = createRateLimiter(RATE_LIMITS.READ);
  const updateLimiter = createRateLimiter(RATE_LIMITS.UPDATE);
  const deleteLimiter = createRateLimiter(RATE_LIMITS.DELETE);

  // Circuit breakers for external service calls
  const createBreaker = new CircuitBreaker(datasetController.createDataset, CIRCUIT_BREAKER_CONFIG);
  const processBreaker = new CircuitBreaker(datasetController.processDataset, CIRCUIT_BREAKER_CONFIG);

  // Create dataset endpoint
  router.post('/',
    createLimiter,
    authorizeRole([ROLES.ADMIN, ROLES.RESEARCHER]),
    [
      body('name').isString().trim().notEmpty(),
      body('description').isString().trim(),
      body('version').matches(/^\d+\.\d+\.\d+$/),
      body('resolution').isObject()
        .custom((value) => value.width >= 480 && value.width <= 3840 &&
                          value.height >= 360 && value.height <= 2160)
    ],
    async (req, res) => {
      try {
        const result = await createBreaker.fire(req, res);
        logger.info({ requestId: req.id }, 'Dataset created successfully');
        return result;
      } catch (error) {
        logger.error({ requestId: req.id, error }, 'Dataset creation failed');
        return res.status(500).json({
          error: 'Dataset creation failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // Process dataset endpoint
  router.post('/:id/process',
    processLimiter,
    authorizeRole([ROLES.ADMIN, ROLES.RESEARCHER]),
    [
      param('id').isUUID(),
      body('batchSize').optional().isInt({ min: 1, max: 100 }),
      body('maxConcurrent').optional().isInt({ min: 1, max: 10 })
    ],
    async (req, res) => {
      try {
        const result = await processBreaker.fire(req, res);
        logger.info({ requestId: req.id }, 'Dataset processing initiated');
        return result;
      } catch (error) {
        logger.error({ requestId: req.id, error }, 'Dataset processing failed');
        return res.status(500).json({
          error: 'Dataset processing failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // Get dataset endpoint
  router.get('/:id',
    readLimiter,
    authorizeRole([ROLES.ADMIN, ROLES.RESEARCHER, ROLES.ENGINEER, ROLES.VIEWER]),
    [
      param('id').isUUID()
    ],
    async (req, res) => {
      try {
        const result = await datasetController.getDataset(req, res);
        logger.info({ requestId: req.id }, 'Dataset retrieved successfully');
        return result;
      } catch (error) {
        logger.error({ requestId: req.id, error }, 'Dataset retrieval failed');
        return res.status(404).json({
          error: 'Dataset not found',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // Update dataset endpoint
  router.put('/:id',
    updateLimiter,
    authorizeRole([ROLES.ADMIN, ROLES.RESEARCHER]),
    [
      param('id').isUUID(),
      body('name').optional().isString().trim(),
      body('description').optional().isString().trim(),
      body('version').optional().matches(/^\d+\.\d+\.\d+$/)
    ],
    async (req, res) => {
      try {
        const result = await datasetController.updateDataset(req, res);
        logger.info({ requestId: req.id }, 'Dataset updated successfully');
        return result;
      } catch (error) {
        logger.error({ requestId: req.id, error }, 'Dataset update failed');
        return res.status(400).json({
          error: 'Dataset update failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // Delete dataset endpoint
  router.delete('/:id',
    deleteLimiter,
    authorizeRole([ROLES.ADMIN]),
    [
      param('id').isUUID()
    ],
    async (req, res) => {
      try {
        const result = await datasetController.deleteDataset(req, res);
        logger.info({ requestId: req.id }, 'Dataset deleted successfully');
        return result;
      } catch (error) {
        logger.error({ requestId: req.id, error }, 'Dataset deletion failed');
        return res.status(400).json({
          error: 'Dataset deletion failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  return router;
}

export default configureDatasetRoutes;
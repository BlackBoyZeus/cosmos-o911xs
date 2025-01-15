// express version: ^4.18.0
// express-validator version: ^6.14.0
// http-errors version: ^2.0.0
// prom-client version: ^14.0.0

import { Router } from 'express';
import { body, param } from 'express-validator';
import createHttpError from 'http-errors';
import { Counter, Histogram } from 'prom-client';

import { TokenizerController } from '../controllers/TokenizerController';
import { authenticate, authorizeRole } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimiter';
import { Logger } from '../../utils/logger';
import { MetricsCollector } from '../../utils/metrics';

// Constants for rate limiting tiers
const RATE_LIMIT_CONFIG = {
  basic: {
    windowMs: 60000, // 1 minute
    max: 60,
    message: 'Rate limit exceeded for basic tier'
  },
  premium: {
    windowMs: 60000,
    max: 300,
    message: 'Rate limit exceeded for premium tier'
  },
  enterprise: {
    windowMs: 60000,
    max: 1000,
    message: 'Rate limit exceeded for enterprise tier'
  }
};

// Allowed roles for tokenizer operations
const ALLOWED_ROLES = ['admin', 'researcher', 'engineer'];

// Initialize metrics
const metricsCollector = MetricsCollector.getInstance();
const tokenizationCounter = new Counter({
  name: 'tokenizer_requests_total',
  help: 'Total number of tokenization requests',
  labelNames: ['operation', 'status']
});

const tokenizationLatency = new Histogram({
  name: 'tokenizer_latency_seconds',
  help: 'Tokenization operation latency',
  labelNames: ['operation'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

/**
 * Configures and returns the tokenizer routes with comprehensive middleware chain
 */
export function initializeTokenizerRoutes(controller: TokenizerController): Router {
  const router = Router();
  const logger = Logger.getInstance();

  // Apply global middleware
  router.use(authenticate);
  router.use((req, res, next) => {
    const startTime = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      metricsCollector.recordTokenizationMetrics(duration, {
        operation: req.path,
        status: res.statusCode
      });
    });
    next();
  });

  // Create tokenizer endpoint
  router.post('/tokenizers',
    authorizeRole(ALLOWED_ROLES),
    createRateLimiter(RATE_LIMIT_CONFIG.enterprise),
    [
      body('type').isIn(['CONTINUOUS', 'DISCRETE']).withMessage('Invalid tokenizer type'),
      body('compressionRatio').isInt({ min: 256, max: 2048 }).withMessage('Invalid compression ratio'),
      body('resolution').isObject().withMessage('Invalid resolution format'),
      body('resolution.width').isInt({ min: 128, max: 1920 }).withMessage('Invalid width'),
      body('resolution.height').isInt({ min: 128, max: 1080 }).withMessage('Invalid height')
    ],
    async (req, res, next) => {
      try {
        const startTime = process.hrtime();
        
        const result = await controller.createTokenizer(req, res);
        
        const [seconds, nanoseconds] = process.hrtime(startTime);
        tokenizationLatency.observe({ operation: 'create' }, seconds + nanoseconds / 1e9);
        tokenizationCounter.inc({ operation: 'create', status: 'success' });

        return result;
      } catch (error) {
        tokenizationCounter.inc({ operation: 'create', status: 'error' });
        logger.error('Tokenizer creation failed', { error });
        next(createHttpError(500, 'Failed to create tokenizer'));
      }
    }
  );

  // Tokenize video endpoint
  router.post('/tokenizers/:id/tokenize',
    authorizeRole(ALLOWED_ROLES),
    createRateLimiter(RATE_LIMIT_CONFIG.premium),
    [
      param('id').isString().notEmpty().withMessage('Invalid tokenizer ID'),
      body('videoData').custom((value) => Buffer.isBuffer(value)).withMessage('Invalid video data'),
      body('options').optional().isObject().withMessage('Invalid options format')
    ],
    async (req, res, next) => {
      try {
        const startTime = process.hrtime();
        
        const result = await controller.tokenize(req, res);
        
        const [seconds, nanoseconds] = process.hrtime(startTime);
        tokenizationLatency.observe({ operation: 'tokenize' }, seconds + nanoseconds / 1e9);
        tokenizationCounter.inc({ operation: 'tokenize', status: 'success' });

        return result;
      } catch (error) {
        tokenizationCounter.inc({ operation: 'tokenize', status: 'error' });
        logger.error('Tokenization failed', { error, tokenizerId: req.params.id });
        next(createHttpError(500, 'Tokenization failed'));
      }
    }
  );

  // Detokenize endpoint
  router.post('/tokenizers/:id/detokenize',
    authorizeRole(ALLOWED_ROLES),
    createRateLimiter(RATE_LIMIT_CONFIG.premium),
    [
      param('id').isString().notEmpty().withMessage('Invalid tokenizer ID'),
      body('tokens').custom((value) => Buffer.isBuffer(value)).withMessage('Invalid token data')
    ],
    async (req, res, next) => {
      try {
        const startTime = process.hrtime();
        
        const result = await controller.detokenize(req, res);
        
        const [seconds, nanoseconds] = process.hrtime(startTime);
        tokenizationLatency.observe({ operation: 'detokenize' }, seconds + nanoseconds / 1e9);
        tokenizationCounter.inc({ operation: 'detokenize', status: 'success' });

        return result;
      } catch (error) {
        tokenizationCounter.inc({ operation: 'detokenize', status: 'error' });
        logger.error('Detokenization failed', { error, tokenizerId: req.params.id });
        next(createHttpError(500, 'Detokenization failed'));
      }
    }
  );

  // Get tokenizer metrics endpoint
  router.get('/tokenizers/:id/metrics',
    authorizeRole(ALLOWED_ROLES),
    createRateLimiter(RATE_LIMIT_CONFIG.basic),
    [
      param('id').isString().notEmpty().withMessage('Invalid tokenizer ID')
    ],
    async (req, res, next) => {
      try {
        const startTime = process.hrtime();
        
        const result = await controller.getMetrics(req, res);
        
        const [seconds, nanoseconds] = process.hrtime(startTime);
        tokenizationLatency.observe({ operation: 'metrics' }, seconds + nanoseconds / 1e9);
        tokenizationCounter.inc({ operation: 'metrics', status: 'success' });

        return result;
      } catch (error) {
        tokenizationCounter.inc({ operation: 'metrics', status: 'error' });
        logger.error('Failed to retrieve metrics', { error, tokenizerId: req.params.id });
        next(createHttpError(500, 'Failed to retrieve metrics'));
      }
    }
  );

  // Error handling middleware
  router.use((error: any, req: any, res: any, next: any) => {
    logger.error('Tokenizer route error', { error });
    res.status(error.status || 500).json({
      error: {
        message: error.message || 'Internal server error',
        status: error.status || 500,
        timestamp: new Date().toISOString()
      }
    });
  });

  return router;
}

export const tokenizerRouter = initializeTokenizerRoutes(new TokenizerController());
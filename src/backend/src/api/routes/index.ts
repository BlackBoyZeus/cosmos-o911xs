import { Router } from 'express'; // ^4.18.0
import morgan from 'morgan'; // ^1.10.0
import helmet from 'helmet'; // ^7.0.0

// Import route configurations
import configureDatasetRoutes from './dataset.routes';
import configureGenerationRoutes from './generation.routes';
import createModelRouter from './model.routes';
import { tokenizerRouter } from './tokenizer.routes';

// Import middleware
import { errorHandler } from '../middleware/errorHandler';
import { rateLimiter } from '../middleware/rateLimiter';
import { authMiddleware } from '../middleware/auth';

// API version constant
const API_VERSION = 'v1';

// Rate limit tiers based on technical specifications
const RATE_LIMIT_TIERS = {
  BASIC: 60,      // 60 requests per minute
  PREMIUM: 300,   // 300 requests per minute
  ENTERPRISE: 1000 // 1000 requests per minute
} as const;

/**
 * Configures and returns the main API router with comprehensive middleware chain
 * and route aggregation for the Cosmos WFM Platform
 */
export function configureApiRoutes(
  datasetController: any,
  generationController: any,
  modelController: any
): Router {
  const router = Router();

  // Apply security headers
  router.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
    dnsPrefetchControl: true,
    frameguard: { action: "deny" },
    hidePoweredBy: true,
    hsts: true,
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xssFilter: true
  }));

  // Configure request logging
  router.use(morgan('combined', {
    skip: (req) => req.path === '/health',
    stream: {
      write: (message: string) => {
        console.log(message.trim());
      }
    }
  }));

  // Apply authentication middleware
  router.use(authMiddleware);

  // Configure rate limiting based on user tier
  router.use((req, res, next) => {
    const userTier = (req as any).user?.tier || 'basic';
    const limit = RATE_LIMIT_TIERS[userTier.toUpperCase()] || RATE_LIMIT_TIERS.BASIC;
    
    rateLimiter({
      windowMs: 60000, // 1 minute
      max: limit,
      message: `Rate limit exceeded for ${userTier} tier`
    })(req, res, next);
  });

  // Health check endpoint
  router.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      version: API_VERSION,
      timestamp: new Date().toISOString()
    });
  });

  // Mount API routes with version prefix
  router.use(`/api/${API_VERSION}/datasets`, configureDatasetRoutes(datasetController));
  router.use(`/api/${API_VERSION}/generation`, configureGenerationRoutes(generationController));
  router.use(`/api/${API_VERSION}/models`, createModelRouter(modelController));
  router.use(`/api/${API_VERSION}/tokenizers`, tokenizerRouter);

  // Apply global error handling
  router.use(errorHandler);

  // Handle 404 errors for unmatched routes
  router.use((req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Requested resource not found',
        path: req.path,
        method: req.method,
        correlationId: req.headers['x-correlation-id'],
        timestamp: new Date().toISOString()
      }
    });
  });

  return router;
}

export default configureApiRoutes;
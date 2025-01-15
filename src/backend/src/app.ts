import express, { Express, Request, Response, NextFunction } from 'express'; // ^4.18.0
import helmet from 'helmet'; // ^6.0.0
import cors from 'cors'; // ^2.8.5
import compression from 'compression'; // ^1.7.4
import morgan from 'morgan'; // ^1.10.0
import { expressjwt } from 'express-jwt'; // ^7.0.0
import * as prometheus from 'prom-client'; // ^14.0.0
import createHttpError from 'http-errors'; // ^2.0.0

// Internal imports
import configureApiRoutes from './api/routes';
import { loadDatabaseConfig } from './config/database';
import { validateGPUConfig, mergeGPUConfig } from './config/gpu';
import { loggerConfig } from './config/logger';
import { Logger } from './utils/logger';
import { MetricsCollector } from './utils/metrics';

// Initialize logger
const logger = Logger.getInstance();
const metrics = MetricsCollector.getInstance();

/**
 * Creates and configures the Express application instance
 */
async function createApp(): Promise<Express> {
  const app = express();

  // Security middleware
  app.use(helmet({
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

  // CORS configuration
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
    credentials: true,
    maxAge: 86400 // 24 hours
  }));

  // Request compression
  app.use(compression());

  // Request logging with correlation ID
  app.use(morgan('combined', {
    skip: (req) => req.path === '/health',
    stream: {
      write: (message: string) => {
        logger.info('HTTP Request', {
          message: message.trim(),
          correlationId: req.headers['x-correlation-id']
        });
      }
    }
  }));

  // Body parsing middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // JWT authentication
  app.use(expressjwt({
    secret: process.env.JWT_SECRET!,
    algorithms: ['HS256'],
    credentialsRequired: false,
    requestProperty: 'user'
  }).unless({ path: ['/health', '/metrics'] }));

  // Correlation ID middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.headers['x-correlation-id'] = req.headers['x-correlation-id'] || 
      `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    next();
  });

  // Configure API routes
  app.use('/api', configureApiRoutes);

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'healthy',
      version: process.env.npm_package_version,
      timestamp: new Date().toISOString()
    });
  });

  // Metrics endpoint
  app.get('/metrics', async (req: Request, res: Response) => {
    try {
      const metrics = await MetricsCollector.getInstance().getMetrics();
      res.set('Content-Type', prometheus.register.contentType);
      res.status(200).send(metrics);
    } catch (error) {
      logger.error('Failed to collect metrics', { error });
      res.status(500).send('Failed to collect metrics');
    }
  });

  // Global error handling
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error', {
      error: err,
      path: req.path,
      method: req.method,
      correlationId: req.headers['x-correlation-id']
    });

    res.status(err.status || 500).json({
      error: {
        message: err.message || 'Internal server error',
        code: err.code || 'INTERNAL_ERROR',
        correlationId: req.headers['x-correlation-id'],
        timestamp: new Date().toISOString()
      }
    });
  });

  return app;
}

/**
 * Initializes core services and configurations
 */
async function initializeServices(): Promise<void> {
  try {
    // Load and validate database configuration
    const dbConfig = loadDatabaseConfig();
    logger.info('Database configuration loaded successfully');

    // Load and validate GPU configuration
    const gpuConfig = mergeGPUConfig({
      deviceCount: parseInt(process.env.GPU_DEVICE_COUNT || '8'),
      memoryLimit: parseInt(process.env.GPU_MEMORY_LIMIT || '80000')
    });
    validateGPUConfig(gpuConfig);
    logger.info('GPU configuration validated successfully');

    // Initialize metrics collection
    const register = new prometheus.Registry();
    prometheus.collectDefaultMetrics({ register });
    logger.info('Metrics collection initialized');

  } catch (error) {
    logger.error('Service initialization failed', { error });
    throw error;
  }
}

// Start server with graceful shutdown
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT || '10000');

  Promise.all([createApp(), initializeServices()])
    .then(([app]) => {
      const server = app.listen(PORT, () => {
        logger.info(`Server started on port ${PORT}`);
      });

      // Graceful shutdown
      const shutdown = async () => {
        logger.info('Shutting down server...');
        server.close(async () => {
          try {
            await Promise.race([
              // Cleanup tasks
              Promise.all([
                metrics.shutdown(),
                new Promise(resolve => setTimeout(resolve, SHUTDOWN_TIMEOUT))
              ])
            ]);
            logger.info('Server shutdown complete');
            process.exit(0);
          } catch (error) {
            logger.error('Error during shutdown', { error });
            process.exit(1);
          }
        });
      };

      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
    })
    .catch((error) => {
      logger.error('Server startup failed', { error });
      process.exit(1);
    });
}

export default createApp;
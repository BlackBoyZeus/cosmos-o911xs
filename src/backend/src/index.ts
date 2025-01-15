import dotenv from 'dotenv'; // ^16.0.0
import winston from 'winston'; // ^3.8.0
import * as prometheus from 'prom-client'; // ^14.0.0
import { app } from './app';
import { loggerConfig } from './config/logger';
import { loadDatabaseConfig } from './config/database';
import { validateGPUConfig, mergeGPUConfig } from './config/gpu';
import { Logger } from './utils/logger';
import { MetricsCollector } from './utils/metrics';

// Initialize environment variables
dotenv.config();

// Initialize logger
const logger = Logger.getInstance();

// Initialize metrics collector
const metrics = MetricsCollector.getInstance();

// Constants
const PORT = process.env.PORT || 3000;
const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT || '30000');
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Initializes server with comprehensive monitoring and resource management
 */
async function startServer(): Promise<void> {
  try {
    // Load and validate configurations
    const dbConfig = loadDatabaseConfig();
    logger.info('Database configuration loaded successfully');

    const gpuConfig = mergeGPUConfig({
      deviceCount: parseInt(process.env.GPU_DEVICE_COUNT || '8'),
      memoryLimit: parseInt(process.env.GPU_MEMORY_LIMIT || '80000')
    });
    validateGPUConfig(gpuConfig);
    logger.info('GPU configuration validated successfully');

    // Initialize Prometheus metrics
    prometheus.collectDefaultMetrics({
      prefix: 'cosmos_wfm_',
      labels: { service: 'backend', environment: NODE_ENV }
    });

    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info('Server started successfully', {
        port: PORT,
        environment: NODE_ENV,
        gpuDevices: gpuConfig.deviceCount
      });
    });

    // Configure graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown`);

      // Create shutdown timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Shutdown timeout exceeded'));
        }, SHUTDOWN_TIMEOUT);
      });

      try {
        // Close HTTP server first
        await new Promise<void>((resolve) => {
          server.close(() => resolve());
        });
        logger.info('HTTP server closed');

        // Cleanup tasks
        await Promise.race([
          Promise.all([
            // Stop accepting new requests
            app.disable('trust proxy'),
            
            // Flush metrics
            metrics.shutdown(),
            
            // Close database connections
            dbConfig.closeConnections?.(),
            
            // Release GPU resources
            gpuConfig.releaseResources?.()
          ]),
          timeoutPromise
        ]);

        logger.info('Cleanup completed, exiting process');
        process.exit(0);

      } catch (error) {
        logger.error('Error during shutdown', {
          error: error instanceof Error ? error.message : 'Unknown error',
          signal
        });
        process.exit(1);
      }
    };

    // Register process event handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack
      });
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', {
        reason: reason instanceof Error ? reason.message : reason
      });
      gracefulShutdown('unhandledRejection');
    });

  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

// Start server
startServer().catch((error) => {
  logger.error('Server startup failed', {
    error: error instanceof Error ? error.message : 'Unknown error'
  });
  process.exit(1);
});

// Export for testing
export { app };
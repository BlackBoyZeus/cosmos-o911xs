import rateLimit from 'express-rate-limit'; // ^6.0.0
import RedisStore from 'rate-limit-redis'; // ^3.0.0
import Redis from 'ioredis'; // ^5.0.0
import { Request, Response } from 'express'; // ^4.18.0
import { Logger } from '../../utils/logger';
import { databaseConfig } from '../../config/database';
import { MetricsCollector } from '../../utils/metrics';

// Interface definitions
interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message: string;
  statusCode: number;
  skipFailedRequests: boolean;
  requestPropertyName: string;
  store: RedisStore;
  keyGenerator: (req: Request) => string;
  handler: (req: Request, res: Response) => void;
}

interface RateLimitConfig {
  requestsPerMinute: number;
  burstLimit: number;
  throttlingAction: string;
  windowMs: number;
  errorThreshold: number;
}

// Constants for rate limiting tiers
const TIER_LIMITS: Record<string, RateLimitConfig> = {
  basic: {
    requestsPerMinute: 60,
    burstLimit: 100,
    throttlingAction: '429 Response',
    windowMs: 60000,
    errorThreshold: 5
  },
  premium: {
    requestsPerMinute: 300,
    burstLimit: 500,
    throttlingAction: 'Queue Requests',
    windowMs: 60000,
    errorThreshold: 10
  },
  enterprise: {
    requestsPerMinute: 1000,
    burstLimit: 2000,
    throttlingAction: 'Auto-scale',
    windowMs: 60000,
    errorThreshold: 20
  }
};

// Redis client configuration
const REDIS_OPTIONS = {
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
  reconnectOnError: (err: Error) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  }
};

/**
 * Creates a distributed rate limiter middleware with Redis storage
 */
export function createRateLimiter(options: Partial<RateLimiterOptions>) {
  const logger = Logger.getInstance();
  const metrics = MetricsCollector.getInstance();
  let redisClient: Redis;

  try {
    // Initialize Redis client with cluster support
    redisClient = new Redis({
      ...REDIS_OPTIONS,
      host: databaseConfig.redis.host,
      port: databaseConfig.redis.port,
      password: databaseConfig.redis.password,
      tls: databaseConfig.redis.ssl.enabled ? {
        cert: databaseConfig.redis.ssl.cert,
        key: databaseConfig.redis.ssl.key,
        ca: databaseConfig.redis.ssl.ca
      } : undefined
    });

    // Handle Redis connection events
    redisClient.on('error', (err) => {
      logger.error('Redis connection error', { error: err.message });
      metrics.incrementRateLimitViolation('redis_error');
    });

    redisClient.on('connect', () => {
      logger.info('Redis connection established');
    });

    // Create Redis store for rate limiting
    const store = new RedisStore({
      client: redisClient,
      prefix: 'rl:',
      sendCommand: (...args: string[]) => redisClient.call(...args)
    });

    // Configure rate limiter with defaults
    const limiterOptions: RateLimiterOptions = {
      windowMs: 60000,
      max: 60,
      message: 'Too many requests, please try again later',
      statusCode: 429,
      skipFailedRequests: false,
      requestPropertyName: 'rateLimit',
      store,
      keyGenerator: (req: Request) => {
        return `${req.ip}:${req.path}`;
      },
      handler: handleRateLimitError,
      ...options
    };

    return rateLimit(limiterOptions);
  } catch (error) {
    logger.error('Failed to create rate limiter', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // Fallback to memory store if Redis fails
    return rateLimit({
      ...options,
      store: undefined
    });
  }
}

/**
 * Returns rate limit configuration based on user tier
 */
function getTierLimits(tier: string): RateLimitConfig {
  const logger = Logger.getInstance();
  
  if (!TIER_LIMITS[tier]) {
    logger.warn(`Invalid tier ${tier}, falling back to basic`);
    return TIER_LIMITS.basic;
  }

  return TIER_LIMITS[tier];
}

/**
 * Handles rate limit violations with detailed logging
 */
function handleRateLimitError(req: Request, res: Response): void {
  const logger = Logger.getInstance();
  const metrics = MetricsCollector.getInstance();

  const errorContext = {
    ip: req.ip,
    path: req.path,
    method: req.method,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString()
  };

  logger.warn('Rate limit exceeded', errorContext);
  metrics.incrementRateLimitViolation('rate_limit_exceeded');

  // Enhanced error response
  res.status(429).json({
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: Math.ceil(req.rateLimit?.resetTime / 1000) || 60,
    limit: req.rateLimit?.limit,
    current: req.rateLimit?.current,
    remaining: req.rateLimit?.remaining || 0
  });
}

// Export factory function
export default createRateLimiter;
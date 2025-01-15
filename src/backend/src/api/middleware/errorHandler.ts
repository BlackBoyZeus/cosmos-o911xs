import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { ErrorMetrics } from '@monitoring/metrics'; // ^1.0.0
import { Logger } from '../../utils/logger';
import { ProcessingStatus } from '../../types/common';

// Custom error interface with enhanced context
interface CustomError extends Error {
  status?: number;
  code?: string;
  details?: Record<string, any>;
  correlationId?: string;
  userId?: string;
  path?: string;
  method?: string;
  timestamp?: Date;
}

// Standardized error response interface
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    correlationId: string;
    timestamp: Date;
  };
  status: number;
}

// Error code to HTTP status mapping
const ERROR_STATUS_MAP: Record<string, number> = {
  VALIDATION_ERROR: 400,
  AUTHENTICATION_ERROR: 401,
  AUTHORIZATION_ERROR: 403,
  NOT_FOUND: 404,
  RATE_LIMIT_ERROR: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  CIRCUIT_BREAKER_OPEN: 503,
  RETRY_FAILED: 500
};

// Initialize error metrics tracking
const errorMetrics = new ErrorMetrics({
  serviceName: process.env.SERVICE_NAME || 'cosmos-wfm',
  environment: process.env.NODE_ENV || 'development'
});

/**
 * Formats error details into standardized response structure
 */
const formatErrorResponse = (error: CustomError): ErrorResponse => {
  const timestamp = error.timestamp || new Date();
  const code = error.code || 'INTERNAL_SERVER_ERROR';
  const status = error.status || ERROR_STATUS_MAP[code] || 500;

  // Sanitize error details for production
  const details = process.env.NODE_ENV === 'production' 
    ? undefined 
    : error.details;

  return {
    error: {
      code,
      message: error.message,
      details,
      correlationId: error.correlationId || 'unknown',
      timestamp
    },
    status
  };
};

/**
 * Implements error recovery mechanisms including retries and circuit breaking
 */
const handleErrorRecovery = async (error: CustomError): Promise<void> => {
  // Check if error is recoverable
  const isRecoverable = ![
    'AUTHENTICATION_ERROR',
    'AUTHORIZATION_ERROR',
    'VALIDATION_ERROR'
  ].includes(error.code || '');

  if (!isRecoverable) {
    return;
  }

  try {
    // Update error metrics
    await errorMetrics.incrementErrorCount({
      errorCode: error.code || 'UNKNOWN',
      status: error.status || 500,
      path: error.path || 'unknown'
    });

    // Check circuit breaker status
    const isCircuitOpen = await errorMetrics.isCircuitBreakerOpen(error.path || 'unknown');
    if (isCircuitOpen) {
      error.code = 'CIRCUIT_BREAKER_OPEN';
      error.status = ERROR_STATUS_MAP.CIRCUIT_BREAKER_OPEN;
      return;
    }

    // Implement retry logic for recoverable errors
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        
        // Attempt recovery
        // Recovery logic would go here
        
        return;
      } catch (retryError) {
        retryCount++;
        if (retryCount === maxRetries) {
          error.code = 'RETRY_FAILED';
          error.status = ERROR_STATUS_MAP.RETRY_FAILED;
        }
      }
    }
  } catch (recoveryError) {
    Logger.error('Error recovery failed', {
      originalError: error,
      recoveryError,
      correlationId: error.correlationId
    });
  }
};

/**
 * Express middleware for centralized error handling
 */
const errorHandler = async (
  error: Error | CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response> => {
  // Enhance error with request context
  const enhancedError: CustomError = {
    ...error,
    correlationId: req.headers['x-correlation-id'] as string || 'unknown',
    userId: (req as any).user?.id || 'anonymous',
    path: req.path,
    method: req.method,
    timestamp: new Date(),
    status: (error as CustomError).status || 500,
    code: (error as CustomError).code || 'INTERNAL_SERVER_ERROR',
    details: (error as CustomError).details || {}
  };

  // Track error metrics
  await errorMetrics.trackError({
    errorCode: enhancedError.code,
    path: enhancedError.path,
    method: enhancedError.method,
    userId: enhancedError.userId
  });

  // Log error with enhanced context
  Logger.error(enhancedError.message, {
    error: enhancedError,
    correlationId: enhancedError.correlationId,
    userId: enhancedError.userId,
    path: enhancedError.path,
    method: enhancedError.method,
    status: enhancedError.status,
    code: enhancedError.code
  });

  // Audit log for critical errors
  if (enhancedError.status >= 500) {
    Logger.auditLog({
      action: 'ERROR_OCCURRED',
      userId: enhancedError.userId,
      resource: enhancedError.path,
      details: {
        errorCode: enhancedError.code,
        method: enhancedError.method,
        status: enhancedError.status
      }
    });
  }

  // Attempt error recovery
  await handleErrorRecovery(enhancedError);

  // Format error response
  const errorResponse = formatErrorResponse(enhancedError);

  // Set response status and headers
  res.status(errorResponse.status);
  res.setHeader('X-Correlation-ID', enhancedError.correlationId);
  res.setHeader('X-Error-Code', enhancedError.code);

  // Return formatted error response
  return res.json(errorResponse);
};

export default errorHandler;
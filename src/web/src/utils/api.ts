// External imports
import axios, { AxiosError, AxiosResponse } from 'axios'; // ^1.4.0

// Internal imports
import { ApiResponse, ApiRequestConfig, ApiError, RateLimitInfo } from '../types/api';
import { apiClient } from '../config/api';
import { getStoredToken } from './auth';

/**
 * Rate limit configuration constants
 */
const RATE_LIMIT_TIERS = {
  BASIC: 60,
  PREMIUM: 300,
  ENTERPRISE: 1000
} as const;

/**
 * Request configuration constants
 */
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // Base delay in ms
const REQUEST_TIMEOUT = 30000; // Default timeout in ms

/**
 * Rate limit tracking for request throttling
 */
const rateLimitTracker = new Map<string, {
  count: number;
  resetTime: number;
}>();

/**
 * Makes an authenticated HTTP request to the API with comprehensive error handling
 * @param config Request configuration object
 * @returns Promise resolving to API response
 */
export async function makeRequest<T>(config: ApiRequestConfig): Promise<ApiResponse<T>> {
  try {
    // Get and validate authentication token
    const token = getStoredToken();
    if (!token && config.requiresAuth !== false) {
      throw new Error('Authentication required');
    }

    // Configure request headers
    const headers = {
      ...config.headers,
      Authorization: token ? `Bearer ${token}` : undefined,
      'X-Request-ID': crypto.randomUUID(),
      'X-Client-Version': process.env.REACT_APP_VERSION || '1.0.0'
    };

    // Check rate limit before making request
    const rateLimitKey = token || 'anonymous';
    const rateLimitInfo = checkRateLimit(rateLimitKey);
    if (rateLimitInfo.remaining <= 0) {
      throw new Error(`Rate limit exceeded. Reset in ${rateLimitInfo.reset}s`);
    }

    // Configure retry and timeout settings
    const requestConfig = {
      ...config,
      headers,
      timeout: config.timeout || REQUEST_TIMEOUT,
      _retryCount: 0,
      _startTime: Date.now()
    };

    // Make request with circuit breaker pattern
    const response = await executeWithRetry<T>(requestConfig);

    // Update rate limit tracking
    updateRateLimit(rateLimitKey);

    // Transform and return response
    return transformResponse<T>(response.data);
  } catch (error) {
    return handleApiError(error as AxiosError);
  }
}

/**
 * Executes request with exponential backoff retry mechanism
 * @param config Request configuration
 * @returns Promise resolving to axios response
 */
async function executeWithRetry<T>(
  config: ApiRequestConfig & { _retryCount: number; _startTime: number }
): Promise<AxiosResponse<T>> {
  try {
    return await apiClient(config);
  } catch (error) {
    const { _retryCount, _startTime } = config;
    const errorResponse = (error as AxiosError).response;

    // Check if retry is allowed
    if (
      _retryCount < MAX_RETRIES &&
      Date.now() - _startTime < config.timeout &&
      shouldRetry(errorResponse?.status)
    ) {
      // Calculate exponential backoff delay
      const delay = RETRY_DELAY * Math.pow(2, _retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));

      // Retry request
      return executeWithRetry({
        ...config,
        _retryCount: _retryCount + 1
      });
    }

    throw error;
  }
}

/**
 * Transforms API errors into standardized format
 * @param error Axios error object
 * @returns Standardized error response
 */
export function handleApiError(error: AxiosError): ApiResponse<never> {
  const timestamp = Date.now();
  const requestId = error.config?.headers?.['X-Request-ID'] as string;

  const apiError: ApiError = {
    code: error.response?.status?.toString() || 'UNKNOWN_ERROR',
    message: error.response?.data?.message || error.message,
    details: {
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      timestamp,
      requestId
    },
    requestId,
    timestamp
  };

  // Add retry guidance for specific error types
  if (error.response?.status === 429) {
    apiError.details.retryAfter = parseInt(error.response.headers['retry-after'] || '60', 10);
  }

  // Log error for monitoring
  console.error('API Error:', {
    ...apiError,
    stack: error.stack
  });

  return {
    success: false,
    data: null as never,
    error: apiError,
    metadata: {
      timestamp,
      requestId,
      processingTime: Date.now() - (error.config?._startTime || timestamp),
      serverRegion: error.response?.headers?.['x-server-region'] || 'unknown',
      cacheStatus: 'MISS'
    }
  };
}

/**
 * Transforms successful API responses into standardized format
 * @param data Response data
 * @returns Standardized success response
 */
function transformResponse<T>(data: any): ApiResponse<T> {
  const timestamp = Date.now();
  const requestId = data?.metadata?.requestId || crypto.randomUUID();

  return {
    success: true,
    data: data?.data || data,
    error: null,
    metadata: {
      timestamp,
      requestId,
      processingTime: data?.metadata?.processingTime || 0,
      serverRegion: data?.metadata?.serverRegion || 'unknown',
      cacheStatus: data?.metadata?.cacheStatus || 'MISS'
    }
  };
}

/**
 * Checks if request should be retried based on error status
 * @param status HTTP status code
 * @returns Boolean indicating if retry is allowed
 */
function shouldRetry(status?: number): boolean {
  const retryableStatuses = [408, 429, 500, 502, 503, 504];
  return status ? retryableStatuses.includes(status) : false;
}

/**
 * Checks current rate limit status
 * @param key Rate limit tracking key
 * @returns Rate limit information
 */
function checkRateLimit(key: string): RateLimitInfo {
  const now = Date.now();
  const tracking = rateLimitTracker.get(key) || { count: 0, resetTime: now + 60000 };
  
  if (now >= tracking.resetTime) {
    tracking.count = 0;
    tracking.resetTime = now + 60000;
    rateLimitTracker.set(key, tracking);
  }

  const tier = 'BASIC' as keyof typeof RATE_LIMIT_TIERS;
  const limit = RATE_LIMIT_TIERS[tier];

  return {
    limit,
    remaining: Math.max(0, limit - tracking.count),
    reset: Math.ceil((tracking.resetTime - now) / 1000)
  };
}

/**
 * Updates rate limit tracking after request
 * @param key Rate limit tracking key
 */
function updateRateLimit(key: string): void {
  const tracking = rateLimitTracker.get(key) || { count: 0, resetTime: Date.now() + 60000 };
  tracking.count++;
  rateLimitTracker.set(key, tracking);
}
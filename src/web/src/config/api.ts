// External imports
import axios, { AxiosRequestConfig } from 'axios'; // ^1.6.0

// Internal imports
import { ENDPOINTS } from '../constants/apiEndpoints';
import { ApiRequestConfig, ApiRetryConfig, ApiError, RateLimitInfo } from '../types/api';
import { ResourceType, Status } from '../types/common';

/**
 * Global API configuration constants
 */
const API_TIMEOUT = 60000; // 60 seconds default timeout
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second base delay
const MAX_GPU_TEMP = 85; // Maximum safe GPU temperature in Celsius

/**
 * Rate limiting constants (requests per minute)
 */
const RATE_LIMITS = {
  BASIC: 60,
  PREMIUM: 300,
  ENTERPRISE: 1000
} as const;

/**
 * GPU-aware retry configuration
 */
const DEFAULT_RETRY_CONFIG: ApiRetryConfig = {
  maxRetries: MAX_RETRIES,
  retryDelay: RETRY_DELAY,
  retryableStatuses: [408, 429, 500, 502, 503, 504]
};

/**
 * Monitoring configuration for tracking API performance
 */
interface ApiMonitoringConfig {
  enableMetrics: boolean;
  metricsEndpoint: string;
  sampleRate: number;
  gpuMetrics: boolean;
}

/**
 * Rate limiting configuration based on subscription tier
 */
interface ApiRateLimitConfig {
  tier: keyof typeof RATE_LIMITS;
  limit: number;
  windowMs: number;
  enforceGpuLimits: boolean;
}

/**
 * Default API configuration object with enhanced monitoring and GPU awareness
 */
export const apiConfig = {
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000/api/v1',
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Version': process.env.REACT_APP_VERSION || '1.0.0',
    'X-Request-ID': '', // Set dynamically per request
  },
  retryPolicy: DEFAULT_RETRY_CONFIG,
  rateLimits: {
    tier: 'BASIC' as keyof typeof RATE_LIMITS,
    limit: RATE_LIMITS.BASIC,
    windowMs: 60000,
    enforceGpuLimits: true
  },
  monitoring: {
    enableMetrics: true,
    metricsEndpoint: ENDPOINTS.MONITORING.GPU_METRICS,
    sampleRate: 0.1,
    gpuMetrics: true
  }
};

/**
 * Creates an enhanced API configuration object with GPU-aware settings
 * @param config Custom API configuration options
 * @returns Enhanced axios configuration object
 */
export const createApiConfig = (config: Partial<ApiRequestConfig>): AxiosRequestConfig => {
  const finalConfig: AxiosRequestConfig = {
    ...apiConfig,
    ...config,
    headers: {
      ...apiConfig.headers,
      ...config.headers,
      'X-Request-ID': crypto.randomUUID()
    }
  };

  // Configure GPU-aware retry logic
  const retryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...config.retryConfig,
    shouldRetry: async (error: ApiError, retryCount: number) => {
      // Check GPU temperature before retry
      try {
        const gpuMetrics = await axios.get(ENDPOINTS.MONITORING.GPU_METRICS);
        if (gpuMetrics.data.temperature > MAX_GPU_TEMP) {
          return false; // Don't retry if GPU is too hot
        }
      } catch (error) {
        console.warn('Failed to check GPU metrics:', error);
      }

      return retryCount < MAX_RETRIES && 
             DEFAULT_RETRY_CONFIG.retryableStatuses.includes(error?.code);
    }
  };

  // Configure rate limiting interceptor
  const rateLimitInterceptor = (config: AxiosRequestConfig) => {
    const rateLimitInfo: RateLimitInfo = {
      limit: RATE_LIMITS[apiConfig.rateLimits.tier],
      remaining: 0,
      reset: 0
    };

    return {
      ...config,
      headers: {
        ...config.headers,
        'X-RateLimit-Limit': rateLimitInfo.limit.toString(),
      }
    };
  };

  // Configure monitoring interceptor
  const monitoringInterceptor = (config: AxiosRequestConfig) => {
    if (apiConfig.monitoring.enableMetrics) {
      const timestamp = Date.now();
      return {
        ...config,
        headers: {
          ...config.headers,
          'X-Request-Start': timestamp.toString(),
          'X-GPU-Metrics-Enabled': apiConfig.monitoring.gpuMetrics.toString()
        },
        metadata: {
          requestStart: timestamp,
          gpuMetricsEnabled: apiConfig.monitoring.gpuMetrics
        }
      };
    }
    return config;
  };

  // Apply interceptors
  const axiosInstance = axios.create(finalConfig);
  axiosInstance.interceptors.request.use(rateLimitInterceptor);
  axiosInstance.interceptors.request.use(monitoringInterceptor);

  // Configure response interceptor for error handling
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 429) {
        // Handle rate limiting
        const retryAfter = parseInt(error.response.headers['retry-after'] || '60', 10);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return axiosInstance(originalRequest);
      }

      if (await retryConfig.shouldRetry(error, originalRequest._retryCount || 0)) {
        originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
        const delay = retryConfig.retryDelay * Math.pow(2, originalRequest._retryCount - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        return axiosInstance(originalRequest);
      }

      return Promise.reject(error);
    }
  );

  return finalConfig;
};
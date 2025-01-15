// External imports
import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios'; // ^1.6.0

// Internal imports
import { ApiResponse, ApiRequestConfig, ApiError, GenerationResponse, SystemMetricsResponse } from '../types/api';
import { apiConfig, createApiConfig } from '../config/api';
import { getStoredToken, hasPermission } from '../utils/auth';
import { ENDPOINTS, buildApiUrl, TIMEOUTS } from '../constants/apiEndpoints';

/**
 * Circuit breaker states for API resilience
 */
enum CircuitState {
  CLOSED,
  OPEN,
  HALF_OPEN
}

/**
 * GPU metrics collector interface
 */
interface GpuMetrics {
  utilization: number;
  temperature: number;
  memoryUsage: number;
  powerUsage: number;
  timestamp: number;
}

/**
 * Circuit breaker configuration
 */
interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRequests: number;
}

// Global circuit breaker state
let circuitBreakerState: {
  state: CircuitState;
  failures: number;
  lastFailure: number;
  successfulProbes: number;
} = {
  state: CircuitState.CLOSED,
  failures: 0,
  lastFailure: 0,
  successfulProbes: 0
};

// Circuit breaker configuration
const circuitBreakerConfig: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  halfOpenRequests: 3
};

/**
 * Creates and configures axios instance with GPU monitoring and enhanced security
 */
const createAxiosInstance = (): AxiosInstance => {
  const instance = axios.create(createApiConfig({}));

  // Request interceptor for authentication and GPU requirements
  instance.interceptors.request.use(async (config) => {
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add GPU monitoring headers
    const gpuMetrics = await getGpuMetrics();
    if (gpuMetrics) {
      config.headers['X-GPU-Utilization'] = gpuMetrics.utilization.toString();
      config.headers['X-GPU-Temperature'] = gpuMetrics.temperature.toString();
    }

    return config;
  });

  // Response interceptor for error handling and circuit breaker
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      return handleApiError(error);
    }
  );

  return instance;
};

/**
 * Handles API errors with GPU context and circuit breaker pattern
 */
const handleApiError = async <T>(error: AxiosError): Promise<ApiResponse<T>> => {
  // Update circuit breaker state
  if (circuitBreakerState.state === CircuitState.CLOSED) {
    circuitBreakerState.failures++;
    circuitBreakerState.lastFailure = Date.now();

    if (circuitBreakerState.failures >= circuitBreakerConfig.failureThreshold) {
      circuitBreakerState.state = CircuitState.OPEN;
      setTimeout(() => {
        circuitBreakerState.state = CircuitState.HALF_OPEN;
        circuitBreakerState.successfulProbes = 0;
      }, circuitBreakerConfig.resetTimeout);
    }
  }

  const gpuMetrics = await getGpuMetrics();
  const apiError: ApiError = {
    code: error.response?.status?.toString() || '500',
    message: error.message,
    details: {
      gpuContext: gpuMetrics,
      circuitBreakerState: circuitBreakerState.state,
      timestamp: Date.now()
    },
    requestId: error.config?.headers?.['X-Request-ID'] || crypto.randomUUID()
  };

  return {
    success: false,
    data: null as T,
    error: apiError,
    gpuMetrics
  };
};

/**
 * Retrieves current GPU metrics
 */
const getGpuMetrics = async (): Promise<GpuMetrics> => {
  try {
    const response = await axios.get<SystemMetricsResponse>(
      buildApiUrl(ENDPOINTS.MONITORING.GPU_METRICS)
    );
    return {
      utilization: response.data.gpuUtilization,
      temperature: response.data.gpuTemperature,
      memoryUsage: response.data.memoryUsage,
      powerUsage: 0, // Add if available in SystemMetricsResponse
      timestamp: response.data.timestamp
    };
  } catch (error) {
    console.error('Failed to fetch GPU metrics:', error);
    return null;
  }
};

/**
 * Generic request handler with GPU monitoring and circuit breaker
 */
const request = async <T>(config: ApiRequestConfig): Promise<ApiResponse<T>> => {
  // Check circuit breaker state
  if (circuitBreakerState.state === CircuitState.OPEN) {
    return {
      success: false,
      data: null as T,
      error: {
        code: 'CIRCUIT_BREAKER_OPEN',
        message: 'Circuit breaker is open',
        details: {
          lastFailure: circuitBreakerState.lastFailure,
          failures: circuitBreakerState.failures
        },
        requestId: crypto.randomUUID()
      },
      gpuMetrics: await getGpuMetrics()
    };
  }

  try {
    const axiosInstance = createAxiosInstance();
    const response = await axiosInstance.request<T>({
      ...config,
      timeout: config.timeout || TIMEOUTS.DEFAULT
    });

    // Update circuit breaker state for successful requests
    if (circuitBreakerState.state === CircuitState.HALF_OPEN) {
      circuitBreakerState.successfulProbes++;
      if (circuitBreakerState.successfulProbes >= circuitBreakerConfig.halfOpenRequests) {
        circuitBreakerState.state = CircuitState.CLOSED;
        circuitBreakerState.failures = 0;
      }
    }

    return {
      success: true,
      data: response.data,
      error: null,
      gpuMetrics: await getGpuMetrics()
    };
  } catch (error) {
    return handleApiError<T>(error as AxiosError);
  }
};

/**
 * API service object with GPU-aware request methods
 */
export const apiService = {
  async get<T>(endpoint: string, config: Partial<ApiRequestConfig> = {}): Promise<ApiResponse<T>> {
    return request<T>({
      ...config,
      method: 'GET',
      endpoint
    });
  },

  async post<T>(
    endpoint: string,
    data?: any,
    config: Partial<ApiRequestConfig> = {}
  ): Promise<ApiResponse<T>> {
    return request<T>({
      ...config,
      method: 'POST',
      endpoint,
      data
    });
  },

  async put<T>(
    endpoint: string,
    data?: any,
    config: Partial<ApiRequestConfig> = {}
  ): Promise<ApiResponse<T>> {
    return request<T>({
      ...config,
      method: 'PUT',
      endpoint,
      data
    });
  },

  async delete<T>(endpoint: string, config: Partial<ApiRequestConfig> = {}): Promise<ApiResponse<T>> {
    return request<T>({
      ...config,
      method: 'DELETE',
      endpoint
    });
  },

  getGpuMetrics
};
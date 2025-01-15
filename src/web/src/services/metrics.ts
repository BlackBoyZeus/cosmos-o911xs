// External imports
import axios from 'axios'; // ^1.6.0

// Internal imports
import { ISystemMetrics, IModelMetrics, IMetricThresholds, MetricType } from '../interfaces/IMetrics';
import { makeRequest } from '../utils/api';
import { apiConfig } from '../config/api';
import { ENDPOINTS } from '../constants/apiEndpoints';

// Constants for metrics management
const METRICS_POLLING_INTERVAL = 30000; // 30 seconds
const MAX_HISTORY_POINTS = 1000;
const MAX_GPU_TEMP = 85; // Maximum safe GPU temperature in Celsius
const METRIC_CACHE_TTL = 60000; // 1 minute cache TTL

// Metric threshold defaults
const DEFAULT_THRESHOLDS: Record<MetricType, IMetricThresholds> = {
  [MetricType.GPU_TEMPERATURE]: {
    warning: 75,
    critical: 85
  },
  [MetricType.GPU_UTILIZATION]: {
    warning: 90,
    critical: 95
  },
  [MetricType.GPU_MEMORY]: {
    warning: 85,
    critical: 95
  }
};

// In-memory cache for metrics
const metricsCache = new Map<string, {
  data: any;
  timestamp: number;
}>();

/**
 * Fetches current system metrics including GPU utilization, memory usage and temperature
 * with threshold checking
 * @returns Promise resolving to current system metrics with threshold status
 */
export async function getSystemMetrics(): Promise<ISystemMetrics> {
  try {
    const response = await makeRequest<ISystemMetrics>({
      endpoint: ENDPOINTS.MONITORING.GPU_METRICS,
      method: 'GET',
      params: {},
      headers: {},
      timeout: apiConfig.timeout,
      retryConfig: apiConfig.retryPolicy
    });

    if (!response.success || !response.data) {
      throw new Error('Failed to fetch system metrics');
    }

    // Check GPU temperature against thresholds
    const gpuTemp = response.data.gpuTemperature;
    const thresholds = DEFAULT_THRESHOLDS[MetricType.GPU_TEMPERATURE];

    if (gpuTemp >= thresholds.critical) {
      console.error(`Critical GPU temperature: ${gpuTemp}°C`);
    } else if (gpuTemp >= thresholds.warning) {
      console.warn(`High GPU temperature: ${gpuTemp}°C`);
    }

    return {
      ...response.data,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Error fetching system metrics:', error);
    throw error;
  }
}

/**
 * Fetches comprehensive performance metrics for a specific model including quality scores
 * @param modelId Unique identifier of the model
 * @returns Promise resolving to enhanced model performance metrics
 */
export async function getModelMetrics(modelId: string): Promise<IModelMetrics> {
  try {
    // Check cache first
    const cacheKey = `model_metrics_${modelId}`;
    const cached = metricsCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < METRIC_CACHE_TTL) {
      return cached.data;
    }

    const response = await makeRequest<IModelMetrics>({
      endpoint: ENDPOINTS.MODELS.METRICS.replace(':id', modelId),
      method: 'GET',
      params: {},
      headers: {},
      timeout: apiConfig.timeout,
      retryConfig: apiConfig.retryPolicy
    });

    if (!response.success || !response.data) {
      throw new Error('Failed to fetch model metrics');
    }

    // Cache the results
    metricsCache.set(cacheKey, {
      data: response.data,
      timestamp: Date.now()
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching model metrics:', error);
    throw error;
  }
}

/**
 * Interface for metric history response
 */
interface IMetricHistory {
  metricType: string;
  dataPoints: Array<{
    timestamp: number;
    value: number;
  }>;
  interval: number;
}

/**
 * Fetches historical metric data with configurable time ranges and aggregation
 * @param metricType Type of metric to fetch history for
 * @param startTime Start timestamp in milliseconds
 * @param endTime End timestamp in milliseconds
 * @param aggregation Aggregation interval in seconds
 * @returns Promise resolving to aggregated historical metric data
 */
export async function getMetricHistory(
  metricType: string,
  startTime: number,
  endTime: number,
  aggregation: string
): Promise<IMetricHistory> {
  try {
    // Validate time range
    if (startTime >= endTime) {
      throw new Error('Invalid time range: start time must be before end time');
    }

    // Calculate appropriate number of data points
    const timeRange = endTime - startTime;
    const interval = Math.max(
      Math.floor(timeRange / MAX_HISTORY_POINTS),
      parseInt(aggregation, 10)
    );

    const response = await makeRequest<IMetricHistory>({
      endpoint: ENDPOINTS.MONITORING.RESOURCES,
      method: 'GET',
      params: {
        metricType,
        startTime: startTime.toString(),
        endTime: endTime.toString(),
        interval: interval.toString()
      },
      headers: {},
      timeout: apiConfig.timeout,
      retryConfig: apiConfig.retryPolicy
    });

    if (!response.success || !response.data) {
      throw new Error('Failed to fetch metric history');
    }

    return {
      metricType,
      dataPoints: response.data.dataPoints.map(point => ({
        timestamp: point.timestamp,
        value: point.value
      })),
      interval
    };
  } catch (error) {
    console.error('Error fetching metric history:', error);
    throw error;
  }
}

/**
 * Cleans up expired entries from the metrics cache
 */
function cleanupMetricsCache(): void {
  const now = Date.now();
  for (const [key, value] of metricsCache.entries()) {
    if (now - value.timestamp > METRIC_CACHE_TTL) {
      metricsCache.delete(key);
    }
  }
}

// Set up periodic cache cleanup
setInterval(cleanupMetricsCache, METRIC_CACHE_TTL);
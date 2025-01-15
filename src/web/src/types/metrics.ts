// Internal imports
import { ResourceType } from './common';
import { ChartDataPoint } from './charts';

/**
 * Enum for metric collection intervals
 */
export enum MetricInterval {
  REALTIME = 'REALTIME', // Real-time streaming metrics
  MINUTE = 'MINUTE',     // 1-minute aggregated metrics
  HOUR = 'HOUR',        // 1-hour aggregated metrics
  DAY = 'DAY'           // 1-day aggregated metrics
}

/**
 * Type alias for metric data points used in charts
 */
export type MetricDataPoint = ChartDataPoint;

/**
 * Type alias for metric timestamps in milliseconds since epoch
 */
export type MetricTimestamp = number;

/**
 * Type for individual metric values with timestamps
 */
export type MetricValue = {
  value: number;
  timestamp: MetricTimestamp;
};

/**
 * Interface for comprehensive resource utilization metrics
 */
export interface ResourceMetrics {
  resourceType: ResourceType;
  utilization: number;        // Current utilization percentage
  total: number;             // Total available capacity
  used: number;              // Currently used capacity
  temperature?: number;      // Temperature in Celsius (for GPU)
  history: MetricValue[];    // Historical metric values
}

/**
 * Interface for comprehensive model performance metrics
 */
export interface ModelMetrics {
  generationTime: number;    // Video generation time in seconds
  gpuMemoryUsage: number;    // GPU memory usage in GB
  psnrScore: number;         // Peak Signal-to-Noise Ratio
  fidScore: number;          // Fréchet Inception Distance
  fvdScore: number;          // Fréchet Video Distance
  sampsonError: number;      // Sampson error for 3D consistency
}

/**
 * Interface for metric threshold configuration
 */
export interface MetricThreshold {
  warning: number;           // Warning threshold value
  critical: number;          // Critical threshold value
  resourceType: ResourceType;// Associated resource type
}

/**
 * Interface for GPU-specific metrics
 */
export interface GPUMetrics extends ResourceMetrics {
  resourceType: ResourceType.GPU;
  temperature: number;       // GPU temperature in Celsius
  fanSpeed?: number;        // Fan speed percentage
  powerUsage?: number;      // Power usage in watts
  memoryBandwidth?: number; // Memory bandwidth in GB/s
}

/**
 * Interface for memory-specific metrics
 */
export interface MemoryMetrics extends ResourceMetrics {
  resourceType: ResourceType.MEMORY;
  cached: number;           // Cached memory in bytes
  available: number;        // Available memory in bytes
  swapUsed?: number;       // Swap memory usage in bytes
}

/**
 * Interface for storage-specific metrics
 */
export interface StorageMetrics extends ResourceMetrics {
  resourceType: ResourceType.STORAGE;
  readBandwidth: number;    // Read bandwidth in MB/s
  writeBandwidth: number;   // Write bandwidth in MB/s
  iops: number;            // IO operations per second
}

/**
 * Interface for aggregated system metrics
 */
export interface SystemMetrics {
  gpu: GPUMetrics[];
  memory: MemoryMetrics;
  storage: StorageMetrics;
  timestamp: MetricTimestamp;
  modelMetrics?: ModelMetrics;
}

/**
 * Interface for metric alert configuration
 */
export interface MetricAlert {
  threshold: MetricThreshold;
  message: string;
  severity: 'warning' | 'critical';
  timestamp: MetricTimestamp;
  acknowledged: boolean;
}

/**
 * Type for metric collection configuration
 */
export type MetricConfig = {
  interval: MetricInterval;
  retention: {
    realtime: number;      // Retention period for real-time data in hours
    minute: number;        // Retention period for minute data in days
    hour: number;         // Retention period for hourly data in days
    day: number;          // Retention period for daily data in months
  };
  thresholds: MetricThreshold[];
};

/**
 * Interface for metric query parameters
 */
export interface MetricQuery {
  resourceType?: ResourceType;
  interval: MetricInterval;
  startTime: MetricTimestamp;
  endTime: MetricTimestamp;
  limit?: number;
  aggregation?: 'avg' | 'max' | 'min' | 'sum';
}
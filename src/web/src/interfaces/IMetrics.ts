// External imports
// chart.js v4.4.0

// Internal imports
import { ChartDataPoint } from '../types/charts';

/**
 * Interface for system-wide resource metrics
 * Tracks GPU, memory and storage utilization metrics
 */
export interface ISystemMetrics {
  // GPU metrics (0-100%)
  gpuUtilization: number;
  // GPU memory usage in GB
  gpuMemoryUsage: number;
  // GPU temperature in Celsius
  gpuTemperature: number;
  // RAM usage percentage (0-100%)
  ramUsage: number;
  // Storage usage percentage (0-100%) 
  storageUsage: number;
  // Unix timestamp in milliseconds
  timestamp: number;
}

/**
 * Interface for model performance metrics
 * Tracks generation time, memory usage and quality metrics
 */
export interface IModelMetrics {
  // Generation time in seconds
  generationTime: number;
  // Peak GPU memory usage in GB
  gpuMemoryPeak: number;
  // Peak Signal-to-Noise Ratio score
  psnrScore: number;
  // Fréchet Inception Distance score
  fidScore: number;
  // Unique model identifier
  modelId: string;
  // Unix timestamp in milliseconds
  timestamp: number;
}

/**
 * Interface for historical metric data
 * Used for time-series visualization of metrics
 */
export interface IMetricHistory {
  // Type of metric being tracked
  metricType: string;
  // Array of timestamped metric values
  dataPoints: ChartDataPoint[];
  // Sampling interval in seconds
  interval: number;
}

/**
 * Interface for metric threshold configuration
 * Defines warning and critical thresholds for metrics
 */
export interface IMetricThreshold {
  // Type of metric the thresholds apply to
  metricType: string;
  // Warning threshold value
  warningThreshold: number;
  // Critical threshold value  
  criticalThreshold: number;
}

/**
 * Enum for supported metric types
 */
export enum MetricType {
  GPU_UTILIZATION = 'gpu_utilization',
  GPU_MEMORY = 'gpu_memory',
  GPU_TEMPERATURE = 'gpu_temperature',
  RAM_USAGE = 'ram_usage',
  STORAGE_USAGE = 'storage_usage',
  GENERATION_TIME = 'generation_time',
  PSNR_SCORE = 'psnr_score',
  FID_SCORE = 'fid_score'
}

/**
 * Enum for metric threshold severity levels
 */
export enum ThresholdSeverity {
  NORMAL = 'normal',
  WARNING = 'warning', 
  CRITICAL = 'critical'
}
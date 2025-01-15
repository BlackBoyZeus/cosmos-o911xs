// @types/node version: ^18.0.0
import { type } from '@types/node';

/**
 * Interface defining immutable video resolution dimensions with validation
 * Ensures consistent resolution handling across the platform
 */
export interface VideoResolution {
  readonly width: number;
  readonly height: number;
  
  /**
   * Calculate aspect ratio from width and height
   * @returns number - Aspect ratio as width/height
   */
  getAspectRatio(): number;
  
  /**
   * Validate resolution dimensions
   * @returns boolean - True if dimensions are valid (positive, within max bounds)
   */
  validate(): boolean;
}

/**
 * Implementation of VideoResolution interface
 */
export class VideoResolutionImpl implements VideoResolution {
  constructor(
    public readonly width: number,
    public readonly height: number
  ) {}

  getAspectRatio(): number {
    return this.width / this.height;
  }

  validate(): boolean {
    const MAX_DIMENSION = 7680; // 8K resolution max
    return (
      this.width > 0 &&
      this.height > 0 &&
      this.width <= MAX_DIMENSION &&
      this.height <= MAX_DIMENSION
    );
  }
}

/**
 * Enum tracking processing status with type-safe transitions
 * Used across data curation, tokenization and model inference pipelines
 */
export enum ProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING', 
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

/**
 * Type guard for ProcessingStatus
 */
export function isProcessingStatus(status: string): status is ProcessingStatus {
  return Object.values(ProcessingStatus).includes(status as ProcessingStatus);
}

/**
 * Enum for supported model architectures and parameter sizes
 * Defines available foundation models for inference
 */
export enum ModelType {
  DIFFUSION_7B = 'DIFFUSION_7B',
  DIFFUSION_14B = 'DIFFUSION_14B',
  AUTOREGRESSIVE_4B = 'AUTOREGRESSIVE_4B',
  AUTOREGRESSIVE_13B = 'AUTOREGRESSIVE_13B'
}

/**
 * Type guard for ModelType
 */
export function isModelType(type: string): type is ModelType {
  return Object.values(ModelType).includes(type as ModelType);
}

/**
 * Interface tracking system performance metrics with validation
 * Provides comprehensive monitoring of system resources and efficiency
 */
export interface SystemMetrics {
  readonly gpuUtilization: number; // Percentage (0-100)
  readonly memoryUsage: number; // Percentage (0-100)
  readonly throughput: number; // Videos processed per hour
  readonly latency: number; // Milliseconds per inference
  readonly timestamp: Date;
  
  /**
   * Calculate system efficiency score
   * @returns number - Efficiency score (0-100)
   */
  getEfficiency(): number;
  
  /**
   * Validate metric values are within acceptable ranges
   * @returns boolean - True if all metrics are valid
   */
  validate(): boolean;
}

/**
 * Implementation of SystemMetrics interface
 */
export class SystemMetricsImpl implements SystemMetrics {
  constructor(
    public readonly gpuUtilization: number,
    public readonly memoryUsage: number,
    public readonly throughput: number,
    public readonly latency: number,
    public readonly timestamp: Date = new Date()
  ) {}

  getEfficiency(): number {
    // Efficiency calculation based on GPU utilization and throughput
    const utilizationWeight = 0.6;
    const throughputWeight = 0.4;
    const normalizedThroughput = Math.min(this.throughput / 100, 1) * 100;
    
    return (
      this.gpuUtilization * utilizationWeight +
      normalizedThroughput * throughputWeight
    );
  }

  validate(): boolean {
    const MAX_LATENCY = 600000; // 600s max latency
    const MIN_THROUGHPUT = 0;
    const MAX_THROUGHPUT = 1000; // videos per hour
    
    return (
      this.gpuUtilization >= 0 &&
      this.gpuUtilization <= 100 &&
      this.memoryUsage >= 0 &&
      this.memoryUsage <= 100 &&
      this.throughput >= MIN_THROUGHPUT &&
      this.throughput <= MAX_THROUGHPUT &&
      this.latency >= 0 &&
      this.latency <= MAX_LATENCY &&
      this.timestamp instanceof Date
    );
  }
}
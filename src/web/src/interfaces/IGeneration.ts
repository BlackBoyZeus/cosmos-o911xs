// External imports
// uuid v9.0.0
import { UUID } from 'uuid';

// Internal imports
import { VideoMetadata, Status } from '../types/common';

/**
 * Interface for video resolution configuration
 */
export interface VideoResolution {
  width: number;
  height: number;
}

/**
 * Interface for resource utilization metrics during generation
 */
export interface ResourceMetrics {
  gpuUtilization: number;  // GPU utilization percentage
  memoryUsage: number;     // Memory usage in GB
  processingLatency: number; // Processing latency in ms
}

/**
 * Interface for generation safety configuration settings
 * Implements safety requirements from technical specifications
 */
export interface GenerationSafetyConfig {
  enableFaceBlur: boolean;    // Enable automatic face blurring
  contentFiltering: boolean;  // Enable content safety filtering
  autoRemediate: boolean;     // Enable automatic safety violation remediation
}

/**
 * Interface for video generation request parameters
 * Aligns with technical specifications for video generation UI
 */
export interface IGenerationRequest {
  id: UUID;                           // Unique request identifier
  modelType: 'diffusion' | 'autoregressive'; // Model type selection
  prompt: string;                     // Text prompt for generation
  resolution: VideoResolution;        // Output video resolution
  frameCount: number;                 // Number of frames to generate
  safetySettings: GenerationSafetyConfig; // Safety configuration
  guidanceScale?: number;             // Optional guidance scale parameter
  seed?: number;                      // Optional seed for reproducibility
  maxGenerationTime?: number;         // Optional timeout in seconds
}

/**
 * Interface for generation response data with performance metrics
 * Implements performance tracking requirements from specifications
 */
export interface IGenerationResponse {
  requestId: UUID;                    // Reference to original request
  status: Status;                     // Current generation status
  outputUrl: string;                  // URL to generated video
  metadata: VideoMetadata;            // Generated video metadata
  generationTime: number;             // Total generation time in seconds
  estimatedTimeRemaining: number;     // Estimated time remaining in seconds
  progressPercentage: number;         // Generation progress (0-100)
  resourceUtilization: ResourceMetrics; // Resource utilization metrics
  error?: string;                     // Optional error message if failed
  safetyChecksPassed?: boolean;       // Optional safety validation result
  warnings?: string[];               // Optional generation warnings
}

/**
 * Interface for generation batch configuration
 * Supports batch processing requirements
 */
export interface IGenerationBatchConfig {
  maxConcurrent: number;             // Maximum concurrent generations
  priorityLevel: number;             // Batch priority (1-10)
  timeoutPerItem: number;            // Timeout per generation in seconds
}

/**
 * Interface for generation performance metrics
 * Implements performance monitoring requirements
 */
export interface IGenerationMetrics {
  averageLatency: number;            // Average generation latency
  successRate: number;               // Generation success rate
  throughput: number;                // Generations per minute
  resourceEfficiency: number;        // Resource utilization efficiency
  qualityMetrics: {
    psnr: number;                    // Peak signal-to-noise ratio
    ssim: number;                    // Structural similarity index
    fid: number;                     // Fréchet inception distance
  };
}

/**
 * Type for supported model configurations
 */
export type ModelConfig = {
  modelType: 'diffusion' | 'autoregressive';
  modelSize: '7B' | '14B' | '4B' | '13B';
  optimizationLevel: 'speed' | 'quality' | 'balanced';
};

/**
 * Type for generation error details
 */
export type GenerationError = {
  code: string;
  message: string;
  timestamp: number;
  details: Record<string, any>;
};
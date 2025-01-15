// @types/node version: ^18.0.0
import { UUID } from 'crypto';
import { VideoResolution, ModelType, ProcessingStatus } from '../types/common';
import { GuardConfig, SafetyCheckType, SafetyThresholds, SafetyMetrics } from '../types/safety';

/**
 * Interface defining multi-view generation settings
 * Supports multi-view video generation requirement
 */
interface MultiViewSettings {
  readonly enabled: boolean;
  readonly viewCount: number;
  readonly viewAngles: number[];
  readonly viewDistances: number[];
  readonly synchronizeViews: boolean;
}

/**
 * Interface defining performance tracking settings
 * Maps to performance requirements from technical specifications
 */
interface PerformanceSettings {
  readonly maxGenerationTime: number;  // Maximum allowed generation time in ms
  readonly targetFPS: number;          // Target frames per second
  readonly gpuMemoryLimit: number;     // Maximum GPU memory usage in GB
  readonly enableProfiling: boolean;   // Enable detailed performance profiling
  readonly priorityLevel: number;      // Request priority (1-10)
}

/**
 * Interface defining detailed performance metrics
 * Tracks generation performance against requirements
 */
interface PerformanceMetrics {
  readonly generationTimeMs: number;      // Total generation time
  readonly framesPerSecond: number;       // Achieved FPS
  readonly gpuMemoryUsed: number;         // Peak GPU memory usage in GB
  readonly gpuUtilization: number;        // Average GPU utilization %
  readonly modelLoadTime: number;         // Time to load model in ms
  readonly tokenizationTime: number;      // Time for tokenization in ms
  readonly inferenceTime: number;         // Pure inference time in ms
  readonly postProcessingTime: number;    // Post-processing time in ms
}

/**
 * Interface defining generation error details
 * Provides structured error reporting
 */
interface GenerationError {
  readonly code: string;
  readonly message: string;
  readonly details: Record<string, any>;
  readonly timestamp: Date;
  readonly recoverable: boolean;
}

/**
 * Interface defining safety check results
 * Maps to safety requirements and compliance tracking
 */
interface SafetyCheckResult {
  readonly checkType: SafetyCheckType;
  readonly passed: boolean;
  readonly score: number;
  readonly details: Record<string, any>;
  readonly remediationApplied: boolean;
  readonly remediationDetails?: Record<string, any>;
}

/**
 * Interface defining comprehensive generation request structure
 * Includes all required parameters for video generation
 */
export interface IGenerationRequest {
  readonly id: UUID;                          // Unique request identifier
  readonly modelType: ModelType;              // Model type selection
  readonly prompt: string;                    // Generation prompt
  readonly resolution: VideoResolution;        // Output resolution
  readonly frameCount: number;                // Number of frames to generate
  readonly safetyConfig: GuardConfig;         // Safety configuration
  readonly multiViewConfig: MultiViewSettings; // Multi-view settings
  readonly performanceConfig: PerformanceSettings; // Performance settings
  
  // Optional parameters
  readonly inputVideoPath?: string;           // For video-to-video generation
  readonly seedValue?: number;                // For reproducible generation
  readonly customModelParams?: Record<string, any>; // Model-specific parameters
}

/**
 * Interface defining comprehensive generation response structure
 * Includes detailed results and metrics
 */
export interface IGenerationResponse {
  readonly requestId: UUID;                   // Original request ID
  readonly status: ProcessingStatus;          // Current status
  readonly outputPath: string;                // Generated video path
  readonly generationTime: number;            // Total time taken in ms
  readonly error?: GenerationError;           // Error details if failed
  readonly safetyResults: SafetyCheckResult[]; // Safety check results
  readonly performanceMetrics: PerformanceMetrics; // Performance metrics
  
  // Optional response data
  readonly outputMetadata?: Record<string, any>; // Additional metadata
  readonly debugInfo?: Record<string, any>;      // Debug information
  readonly warnings?: string[];                  // Non-critical warnings
}

/**
 * Type guard for IGenerationRequest validation
 */
export function isValidGenerationRequest(request: any): request is IGenerationRequest {
  return (
    request &&
    typeof request.id === 'string' &&
    Object.values(ModelType).includes(request.modelType) &&
    typeof request.prompt === 'string' &&
    request.resolution?.validate?.() &&
    typeof request.frameCount === 'number' &&
    request.frameCount > 0 &&
    request.frameCount <= 1000 &&
    request.safetyConfig !== undefined &&
    request.multiViewConfig !== undefined &&
    request.performanceConfig !== undefined
  );
}

/**
 * Type guard for IGenerationResponse validation
 */
export function isValidGenerationResponse(response: any): response is IGenerationResponse {
  return (
    response &&
    typeof response.requestId === 'string' &&
    Object.values(ProcessingStatus).includes(response.status) &&
    typeof response.outputPath === 'string' &&
    typeof response.generationTime === 'number' &&
    Array.isArray(response.safetyResults) &&
    response.performanceMetrics !== undefined
  );
}
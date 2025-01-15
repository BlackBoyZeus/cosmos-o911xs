import { 
  ModelArchitecture, 
  ModelCapabilities, 
  ModelPerformance,
  TrainingConfig,
  PERFORMANCE_THRESHOLDS,
  MODEL_ARCHITECTURES
} from '../../../types/models';

import { 
  VideoResolution,
  ProcessingStatus,
  SystemMetrics
} from '../../../types/common';

import * as torch from 'torch'; // v2.0.0

/**
 * Core interface definition for World Foundation Models (WFM)
 * Defines the contract that all model implementations must follow
 */
export interface IModel {
  // Core model properties
  readonly architecture: ModelArchitecture;
  readonly capabilities: ModelCapabilities;
  readonly performance: ModelPerformance;

  /**
   * Generate synthetic video with enhanced validation and performance tracking
   * @param prompt - Text prompt describing desired video content
   * @param resolution - Target video resolution
   * @param numFrames - Number of frames to generate
   * @param config - Generation configuration parameters
   * @returns Promise resolving to generated video data with performance metrics
   * @throws Error if input parameters exceed model capabilities
   */
  generate(
    prompt: string,
    resolution: VideoResolution,
    numFrames: number,
    config: GenerationConfig
  ): Promise<GenerationResult>;

  /**
   * Train model with enhanced configuration and monitoring
   * @param datasetPath - Path to training dataset
   * @param config - Training configuration parameters
   * @returns Promise resolving to training completion status with metrics
   * @throws Error if training configuration is invalid
   */
  train(
    datasetPath: string,
    config: TrainingConfig
  ): Promise<TrainingResult>;

  /**
   * Get current model performance metrics
   * @returns Current performance metrics including PSNR scores
   */
  getPerformanceMetrics(): ModelPerformance;

  /**
   * Validate model capabilities against requested parameters
   * @param resolution - Requested video resolution
   * @param numFrames - Requested number of frames
   * @param batchSize - Requested batch size
   * @returns boolean indicating if request is within capabilities
   */
  validateCapabilities(
    resolution: VideoResolution,
    numFrames: number,
    batchSize: number
  ): boolean;

  /**
   * Initialize model resources and validate GPU availability
   * @returns Promise resolving when initialization is complete
   * @throws Error if required GPU resources are unavailable
   */
  initialize(): Promise<void>;

  /**
   * Clean up model resources and free GPU memory
   * @returns Promise resolving when cleanup is complete
   */
  cleanup(): Promise<void>;
}

/**
 * Configuration interface for video generation
 */
export interface GenerationConfig {
  batchSize: number;
  guidanceScale: number;
  numInferenceSteps: number;
  seed?: number;
  progressCallback?: (progress: number) => void;
}

/**
 * Interface for generation results including performance metrics
 */
export interface GenerationResult {
  videoData: Uint8Array;
  metadata: {
    resolution: VideoResolution;
    frameCount: number;
    fps: number;
  };
  performance: ModelPerformance;
  status: ProcessingStatus;
}

/**
 * Interface for training results including metrics
 */
export interface TrainingResult {
  epochsCompleted: number;
  finalLoss: number;
  trainingTime: number;
  checkpoints: string[];
  performance: ModelPerformance;
  status: ProcessingStatus;
}

/**
 * Type guard to validate GenerationConfig
 */
export function isValidGenerationConfig(config: unknown): config is GenerationConfig {
  const config_ = config as GenerationConfig;
  return (
    typeof config_.batchSize === 'number' &&
    config_.batchSize > 0 &&
    typeof config_.guidanceScale === 'number' &&
    config_.guidanceScale > 0 &&
    typeof config_.numInferenceSteps === 'number' &&
    config_.numInferenceSteps > 0 &&
    (config_.seed === undefined || typeof config_.seed === 'number') &&
    (config_.progressCallback === undefined || 
     typeof config_.progressCallback === 'function')
  );
}

/**
 * Constants for generation configuration
 */
export const GENERATION_DEFAULTS = {
  BATCH_SIZE: 1,
  GUIDANCE_SCALE: 7.5,
  NUM_INFERENCE_STEPS: 50,
} as const;

/**
 * Constants for training configuration
 */
export const TRAINING_DEFAULTS = {
  BATCH_SIZE: 32,
  LEARNING_RATE: 1e-4,
  NUM_EPOCHS: 100,
  CHECKPOINT_INTERVAL: 1000,
  EARLY_STOPPING_PATIENCE: 5
} as const;
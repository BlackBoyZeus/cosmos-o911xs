// @types/node version: ^18.0.0
import { type } from '@types/node';
import { VideoResolution, ModelType, VideoMetrics } from '../types/common';

/**
 * Model architecture configuration and capabilities
 */
export interface ModelArchitecture {
  readonly type: ModelType;
  readonly parameterCount: number;
  readonly contextLength: number;
  readonly maxBatchSize: number;
  readonly supportedResolutions: VideoResolution[];
}

/**
 * Model generation and training capabilities
 */
export interface ModelCapabilities {
  readonly maxFrames: number;
  readonly minFrames: number;
  readonly maxVideoDuration: number; // in seconds
  readonly supportedFormats: string[];
  readonly supportsMultiView: boolean;
  readonly supportsCameraControl: boolean;
  readonly supportsActionControl: boolean;
  readonly supportsTrajectoryControl: boolean;
}

/**
 * Model performance metrics and resource utilization
 */
export interface ModelPerformance {
  readonly generationTime: number; // in milliseconds
  readonly gpuMemoryUsage: number; // in GB
  readonly videoQualityMetrics: VideoMetrics;
  readonly throughput: number; // frames per second
  readonly trainingProgress?: number; // 0-1 for training progress
  readonly trainingLoss?: number;
}

/**
 * Generation configuration options
 */
export interface GenerationConfig {
  readonly guidanceScale: number;
  readonly numInferenceSteps: number;
  readonly seed?: number;
  readonly safetyChecks: boolean;
  readonly controlSignals?: {
    cameraPath?: number[][];
    actionSequence?: string[];
    trajectory?: number[][];
  };
}

/**
 * Training configuration options
 */
export interface TrainingConfig {
  readonly batchSize: number;
  readonly learningRate: number;
  readonly maxEpochs: number;
  readonly validationSplit: number;
  readonly checkpointFrequency: number;
  readonly mixedPrecision: boolean;
}

/**
 * Training callback functions
 */
export interface TrainingCallbacks {
  onEpochStart?: (epoch: number) => void;
  onEpochEnd?: (epoch: number, metrics: Record<string, number>) => void;
  onBatchEnd?: (batch: number, metrics: Record<string, number>) => void;
  onCheckpoint?: (checkpoint: number) => void;
}

/**
 * Core interface for World Foundation Models (WFM)
 * Defines contract for both diffusion and autoregressive models
 */
export interface IModel {
  /**
   * Model architecture configuration
   */
  readonly architecture: ModelArchitecture;

  /**
   * Model capabilities and limitations
   */
  readonly capabilities: ModelCapabilities;

  /**
   * Current performance metrics
   */
  readonly performance: ModelPerformance;

  /**
   * Generate synthetic video from input prompt
   * @param prompt Text description of desired video
   * @param resolution Target video resolution
   * @param numFrames Number of frames to generate
   * @param config Generation configuration options
   * @returns Promise resolving to generated video buffer
   * @throws Error if parameters exceed model capabilities
   */
  generate(
    prompt: string,
    resolution: VideoResolution,
    numFrames: number,
    config: GenerationConfig
  ): Promise<Buffer>;

  /**
   * Train model on provided dataset
   * @param config Training configuration
   * @param datasetPath Path to training dataset
   * @param callbacks Optional training callbacks
   * @returns Promise resolving on training completion
   * @throws Error if training configuration is invalid
   */
  train(
    config: TrainingConfig,
    datasetPath: string,
    callbacks?: TrainingCallbacks
  ): Promise<void>;

  /**
   * Get current model performance metrics
   * @returns Current performance metrics
   */
  getPerformanceMetrics(): ModelPerformance;
}
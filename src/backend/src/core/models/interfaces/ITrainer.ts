import { IModel } from './IModel';
import { TrainingConfig } from '../../../types/models';
import { ModelType } from '../../../types/common';
import * as torch from 'torch'; // v2.0.0

/**
 * Interface for distributed training configuration
 */
export interface DistributedConfig {
  worldSize: number;
  rank: number;
  backend: 'nccl' | 'gloo';
  masterAddr: string;
  masterPort: number;
  useShardedDDP: boolean;
  useFSDP: boolean;
  gradientSyncInterval: number;
}

/**
 * Interface for training metrics across distributed setup
 */
export interface TrainingMetrics {
  loss: number;
  learningRate: number;
  epochProgress: number;
  samplesProcessed: number;
  throughputSamplesPerSecond: number;
  gpuMemoryUsed: {
    current: number;
    peak: number;
    allocated: number;
  };
  gradientNorm: number;
  distributedMetrics: {
    syncTime: number;
    replicationFactor: number;
    communicationOverhead: number;
  };
}

/**
 * Core interface for model trainers in the Cosmos WFM Platform
 * Supports both diffusion and autoregressive architectures with distributed capabilities
 */
export interface ITrainer {
  /**
   * Train model on provided dataset with distributed training support
   * @param model - Model instance to train
   * @param datasetPath - Path to training dataset
   * @param config - Training configuration parameters
   * @param distributedConfig - Distributed training configuration
   * @throws Error if training configuration is invalid or resources unavailable
   */
  train(
    model: IModel,
    datasetPath: string,
    config: TrainingConfig,
    distributedConfig: DistributedConfig
  ): Promise<void>;

  /**
   * Evaluate model performance with distributed validation
   * @param model - Model instance to evaluate
   * @param validationDatasetPath - Path to validation dataset
   * @param distributedConfig - Distributed validation configuration
   * @returns Promise resolving to aggregated performance metrics
   */
  evaluate(
    model: IModel,
    validationDatasetPath: string,
    distributedConfig: DistributedConfig
  ): Promise<ModelPerformance>;

  /**
   * Retrieve detailed training metrics across distributed setup
   * @returns Current training metrics including resource usage
   */
  getTrainingMetrics(): TrainingMetrics;

  /**
   * Initialize distributed training environment
   * @param config - Distributed configuration parameters
   * @throws Error if distributed initialization fails
   */
  initializeDistributedTraining(config: DistributedConfig): Promise<void>;
}

/**
 * Default configuration values for training
 */
export const DEFAULT_BATCH_SIZE = 32;
export const DEFAULT_LEARNING_RATE = 1e-4;
export const CHECKPOINT_INTERVAL = 1000;
export const GRADIENT_SYNC_INTERVAL = 16;
export const MEMORY_OPTIMIZATION_LEVEL = 2;

/**
 * Type guard to validate DistributedConfig
 */
export function isValidDistributedConfig(config: unknown): config is DistributedConfig {
  const config_ = config as DistributedConfig;
  return (
    typeof config_.worldSize === 'number' &&
    config_.worldSize > 0 &&
    typeof config_.rank === 'number' &&
    config_.rank >= 0 &&
    config_.rank < config_.worldSize &&
    (config_.backend === 'nccl' || config_.backend === 'gloo') &&
    typeof config_.masterAddr === 'string' &&
    typeof config_.masterPort === 'number' &&
    config_.masterPort > 0 &&
    typeof config_.useShardedDDP === 'boolean' &&
    typeof config_.useFSDP === 'boolean' &&
    typeof config_.gradientSyncInterval === 'number' &&
    config_.gradientSyncInterval > 0
  );
}

/**
 * Type guard to validate TrainingMetrics
 */
export function isValidTrainingMetrics(metrics: unknown): metrics is TrainingMetrics {
  const metrics_ = metrics as TrainingMetrics;
  return (
    typeof metrics_.loss === 'number' &&
    typeof metrics_.learningRate === 'number' &&
    typeof metrics_.epochProgress === 'number' &&
    typeof metrics_.samplesProcessed === 'number' &&
    typeof metrics_.throughputSamplesPerSecond === 'number' &&
    typeof metrics_.gpuMemoryUsed?.current === 'number' &&
    typeof metrics_.gpuMemoryUsed?.peak === 'number' &&
    typeof metrics_.gpuMemoryUsed?.allocated === 'number' &&
    typeof metrics_.gradientNorm === 'number' &&
    typeof metrics_.distributedMetrics?.syncTime === 'number' &&
    typeof metrics_.distributedMetrics?.replicationFactor === 'number' &&
    typeof metrics_.distributedMetrics?.communicationOverhead === 'number'
  );
}
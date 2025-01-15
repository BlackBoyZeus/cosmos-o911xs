// External imports
import { UUID } from 'uuid'; // v9.0.0

// Internal imports
import { IModel } from './IModel';
import { Status, ResourceMetrics } from '../types/common';

/**
 * Interface for parameter validation ranges during model training
 */
export interface ValidationRanges {
  minBatchSize: number;
  maxBatchSize: number;
  minLearningRate: number;
  maxLearningRate: number;
  minEpochs: number;
  maxEpochs: number;
}

/**
 * Interface for gradient statistics monitoring during training
 */
export interface GradientStats {
  meanGradientNorm: number;
  maxGradientNorm: number;
  gradientClipCount: number;
}

/**
 * Interface for training checkpoint information
 */
export interface CheckpointInfo {
  lastCheckpointPath: string;
  checkpointEpoch: number;
  checkpointTime: Date;
}

/**
 * Interface for training configuration parameters
 */
export interface TrainingConfig {
  modelId: UUID;
  batchSize: number;
  learningRate: number;
  maxEpochs: number;
  datasetPath: string;
  validationRanges: ValidationRanges;
}

/**
 * Interface for comprehensive training progress metrics
 */
export interface TrainingMetrics {
  currentEpoch: number;
  loss: number;
  accuracy: number;
  validationLoss: number;
  validationAccuracy: number;
  gradientStats: GradientStats;
  elapsedTime: number;
  estimatedTimeRemaining: number;
  resourceMetrics: ResourceMetrics;
  checkpointInfo: CheckpointInfo;
}

/**
 * Type definition for filtering training jobs in UI
 */
export type TrainingFilter = {
  modelId?: UUID;
  status?: Status;
  dateRange?: {
    start: Date;
    end: Date;
  };
};

/**
 * Main interface for training job management in the Cosmos WFM Platform
 * Provides comprehensive training configuration, metrics, and status tracking
 */
export interface ITraining {
  // Core identifiers
  id: UUID;
  
  // Training configuration and metrics
  config: TrainingConfig;
  metrics: TrainingMetrics;
  
  // Status tracking
  status: Status;
  startedAt: Date;
  completedAt: Date;
  
  // Version control
  version: string;
}